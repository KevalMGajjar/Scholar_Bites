import { Request, Response } from 'express';
import pool from '../config/db';

export const getRestaurantsByUniversity = async (req: Request, res: Response) => {
    const { university_id } = req.params;

    if (!university_id) {
        return res.status(400).json({ message: 'University ID is required' });
    }

    try {
        const query = 'SELECT * FROM restaurants WHERE university_id = $1 AND is_open = TRUE ORDER BY rating DESC, name';
        const result = await pool.query(query, [university_id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching restaurants:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const createRestaurant = async (req: Request, res: Response) => {
    const { university_id, name, logo_url, cover_url, rating, tags, is_open } = req.body;

    if (!university_id || !name) {
        return res.status(400).json({ message: 'University ID and name are required' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO restaurants (university_id, name, logo_url, cover_url, rating, tags, is_open) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [university_id, name, logo_url, cover_url, rating || 0.0, tags || [], is_open ?? true]
        );
        res.status(201).json(result.rows[0]);
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
    const { name, logo_url, cover_url, rating, tags, is_open, prep_time_minutes } = req.body;

    try {
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

        if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });

        params.push(id);
        const result = await pool.query(
            `UPDATE restaurants SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, params
        );

        if (result.rows.length === 0) return res.status(404).json({ message: 'Restaurant not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Delete (soft) Restaurant ───
export const deleteRestaurant = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'UPDATE restaurants SET is_open = false WHERE id = $1 RETURNING *', [id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'Restaurant not found' });
        res.json({ message: 'Restaurant deactivated', restaurant: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
