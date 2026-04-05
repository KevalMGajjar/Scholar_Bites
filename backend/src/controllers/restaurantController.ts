import { Request, Response } from 'express';
import pool from '../config/db';
import { triggerRestaurantOpen } from './notificationController';
import { uploadToS3 } from './uploadController';
import { auditLog, getRequestIp } from '../services/auditLogger';

export const getRestaurantsByUniversity = async (req: Request, res: Response) => {
    const { university_id } = req.params;

    if (!university_id) {
        return res.status(400).json({ message: 'University ID is required' });
    }

    try {
        // Return all public restaurants, completely hiding 'Event Management' which is private/restricted
        const query = 'SELECT * FROM restaurants WHERE university_id = $1 AND LOWER(name) != $2 ORDER BY rating DESC, name';
        const result = await pool.query(query, [university_id, 'event management']);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching restaurants:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const createRestaurant = async (req: Request, res: Response) => {
    const { university_id, name, rating, tags, is_open, opening_time, closing_time } = req.body;
    let { logo_url, cover_url } = req.body;

    if (!university_id || !name) {
        return res.status(400).json({ message: 'University ID and name are required' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO restaurants (university_id, name, logo_url, cover_url, rating, tags, is_open, opening_time, closing_time) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [university_id, name, logo_url, cover_url, rating || 0.0, tags || [], is_open ?? true, opening_time || null, closing_time || null]
        );
        let r = result.rows[0];

        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        let needsUpdate = false;

        if (files?.logo && files.logo[0]) {
            const f = files.logo[0];
            const ext = f.mimetype.split('/')[1] || 'jpg';
            const s3Url = await uploadToS3(f.buffer, f.mimetype, `restaurants/${r.id}_logo.${ext}`);
            logo_url = `${s3Url}?v=${Date.now()}`;
            needsUpdate = true;
        }

        if (files?.cover && files.cover[0]) {
            const f = files.cover[0];
            const ext = f.mimetype.split('/')[1] || 'jpg';
            const s3Url = await uploadToS3(f.buffer, f.mimetype, `restaurants/${r.id}_cover.${ext}`);
            cover_url = `${s3Url}?v=${Date.now()}`;
            needsUpdate = true;
        }

        if (needsUpdate) {
            const up = await pool.query('UPDATE restaurants SET logo_url=$1, cover_url=$2 WHERE id=$3 RETURNING *', [logo_url || r.logo_url, cover_url || r.cover_url, r.id]);
            r = up.rows[0];
        }

        res.status(201).json(r);
    } catch (error) {
        console.error('Error creating restaurant:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Get ALL restaurants for admin (including closed) ───
export const getAllRestaurants = async (req: Request, res: Response) => {
    const { university_id } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM restaurants WHERE university_id = $1 ORDER BY name', [university_id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Update Restaurant ───
export const updateRestaurant = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, rating, tags, is_open, prep_time_minutes, opening_time, closing_time } = req.body;
    let { logo_url, cover_url } = req.body;

    try {
        // ─── IDOR: verify restaurant belongs to admin's university ───
        const user = (req as any).user;
        const restCheck = await pool.query('SELECT university_id FROM restaurants WHERE id = $1', [id]);
        if (restCheck.rows.length === 0) return res.status(404).json({ message: 'Restaurant not found' });
        if (user?.university_id && restCheck.rows[0].university_id !== user.university_id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        if (files?.logo && files.logo[0]) {
            const f = files.logo[0];
            const ext = f.mimetype.split('/')[1] || 'jpg';
            const s3Url = await uploadToS3(f.buffer, f.mimetype, `restaurants/${id}_logo.${ext}`);
            logo_url = `${s3Url}?v=${Date.now()}`;
        }
        if (files?.cover && files.cover[0]) {
            const f = files.cover[0];
            const ext = f.mimetype.split('/')[1] || 'jpg';
            const s3Url = await uploadToS3(f.buffer, f.mimetype, `restaurants/${id}_cover.${ext}`);
            cover_url = `${s3Url}?v=${Date.now()}`;
        }

        const updates: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (name !== undefined) { updates.push(`name = $${idx++}`); params.push(name); }
        if (logo_url !== undefined) { updates.push(`logo_url = $${idx++}`); params.push(logo_url); }
        if (cover_url !== undefined) { updates.push(`cover_url = $${idx++}`); params.push(cover_url); }
        if (rating !== undefined) { updates.push(`rating = $${idx++}`); params.push(rating); }
        if (tags !== undefined) { updates.push(`tags = $${idx++}`); params.push(tags); }
        if (is_open !== undefined) { updates.push(`is_open = $${idx++}`); params.push(is_open); }
        if (prep_time_minutes !== undefined) { updates.push(`prep_time_minutes = $${idx++}`); params.push(prep_time_minutes); }
        if (opening_time !== undefined) { updates.push(`opening_time = $${idx++}`); params.push(opening_time || null); }
        if (closing_time !== undefined) { updates.push(`closing_time = $${idx++}`); params.push(closing_time || null); }

        if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });

        params.push(id);
        const result = await pool.query(
            `UPDATE restaurants SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, params
        );

        if (result.rows.length === 0) return res.status(404).json({ message: 'Restaurant not found' });

        // Trigger notification if restaurant just opened
        if (is_open === true) {
            triggerRestaurantOpen(id as string).catch(() => {});
        }

        auditLog({ userId: user?.id, action: 'RESTAURANT_UPDATED', resource: `restaurant:${id}`, ip: getRequestIp(req) });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Delete (soft) Restaurant ───
export const deleteRestaurant = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;
    try {
        // ─── IDOR: verify restaurant belongs to admin's university ───
        const restCheck = await pool.query('SELECT university_id FROM restaurants WHERE id = $1', [id]);
        if (restCheck.rows.length === 0) return res.status(404).json({ message: 'Restaurant not found' });
        if (user?.university_id && restCheck.rows[0].university_id !== user.university_id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const result = await pool.query(
            'UPDATE restaurants SET is_open = false WHERE id = $1 RETURNING *', [id]
        );
        auditLog({ userId: user?.id, action: 'RESTAURANT_DELETED', resource: `restaurant:${id}`, ip: getRequestIp(req) });
        res.json({ message: 'Restaurant deactivated', restaurant: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
