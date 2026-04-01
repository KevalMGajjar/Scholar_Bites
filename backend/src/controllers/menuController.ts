import { Request, Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import { triggerItemAvailable } from './notificationController';
import { uploadToS3 } from './uploadController';
import { auditLog, getRequestIp } from '../services/auditLogger';

// ─── Get Trending Items (most ordered) ───────────────
export const getTrendingItems = async (req: Request, res: Response) => {
    const { university_id } = req.params;

    if (!university_id) {
        return res.status(400).json({ message: 'University ID is required' });
    }

    try {
        const result = await pool.query(
            `SELECT m.*, COUNT(oi.id)::int as order_count, r.is_open as restaurant_is_open
             FROM menu_items m
             JOIN order_items oi ON m.id = oi.menu_item_id
             JOIN orders o ON oi.order_id = o.id
             JOIN restaurants r ON m.restaurant_id = r.id
             WHERE o.university_id = $1
               AND o.status IN ('preparing', 'ready', 'completed')
             GROUP BY m.id, r.is_open
             ORDER BY order_count DESC
             LIMIT 5`,
            [university_id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching trending items:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getMenu = async (req: Request, res: Response) => {
    const { restaurant_id, university_id, category, include_unavailable } = req.query;

    if (!restaurant_id && !university_id) {
        return res.status(400).json({ message: 'Restaurant ID or University ID is required' });
    }

    try {
        let query = '';
        let params: any[] = [];
        let pIndex = 1;
        const availFilter = '';

        if (restaurant_id) {
            query = `
                SELECT m.*, r.is_open as restaurant_is_open 
                FROM menu_items m 
                JOIN restaurants r ON m.restaurant_id = r.id 
                WHERE m.restaurant_id = $${pIndex++}${availFilter}
            `;
            params.push(restaurant_id);
        } else if (university_id) {
            query = `
                SELECT DISTINCT ON (m.name) m.*, r.is_open as restaurant_is_open 
                FROM menu_items m 
                JOIN restaurants r ON m.restaurant_id = r.id 
                WHERE r.university_id = $${pIndex++}${availFilter}
            `;
            params.push(university_id);
        }

        if (category) {
            query += ` AND m.category = $${pIndex++}`;
            params.push(category);
        }

        query += ' ORDER BY m.name, m.category';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const addMenuItem = async (req: AuthRequest, res: Response) => {
    const { name, description, price, category, image_url, nutritional_info, stock_quantity, restaurant_id, is_veg } = req.body;
    
    if (!restaurant_id) {
        return res.status(400).json({ message: 'Restaurant ID is required' });
    }

    try {
        // Fetch staff university_id to ensure they have access to this restaurant (simplified for now)
        const staffParams = await pool.query('SELECT university_id FROM staff WHERE id = $1', [req.user.id]);
        if (staffParams.rows.length === 0) return res.sendStatus(403);
        const uniId = staffParams.rows[0].university_id;

        // Verify restaurant belongs to university
        const restCheck = await pool.query('SELECT id FROM restaurants WHERE id = $1 AND university_id = $2', [restaurant_id, uniId]);
        if (restCheck.rows.length === 0) return res.sendStatus(403);

        const result = await pool.query(
            `INSERT INTO menu_items (restaurant_id, name, description, price, category, image_url, nutritional_info, stock_quantity, is_veg)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [restaurant_id, name, description, price, category, image_url, nutritional_info ? (typeof nutritional_info === 'string' ? JSON.parse(nutritional_info) : nutritional_info) : null, stock_quantity || 0, is_veg !== undefined ? (is_veg === 'true' || is_veg === true) : true]
        );
        
        let item = result.rows[0];

        if (req.file) {
            const ext = req.file.mimetype.split('/')[1] || 'jpg';
            const s3Url = await uploadToS3(req.file.buffer, req.file.mimetype, `food_items/${item.id}.${ext}`);
            const finalUrl = `${s3Url}?v=${Date.now()}`;
            const updated = await pool.query(
                `UPDATE menu_items SET image_url=$1 WHERE id=$2 RETURNING *`,
                [finalUrl, item.id]
            );
            item = updated.rows[0];
        }

        res.status(201).json(item);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateStock = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { stock_quantity, is_available } = req.body; // allow updating availability too

    try {
        // Should verify if item belongs to staff's university? 
        // Ideally yes, but for MVP just update.

        // Construct dynamic query
        let updates = [];
        let params = [];
        let idx = 1;

        if (stock_quantity !== undefined) {
            updates.push(`stock_quantity = $${idx++}`);
            params.push(stock_quantity);
        }
        if (is_available !== undefined) {
            updates.push(`is_available = $${idx++}`);
            params.push(is_available);
        }

        if (updates.length === 0) return res.sendStatus(400);

        params.push(id);
        const query = `UPDATE menu_items SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;

        const result = await pool.query(query, params);

        if (result.rows.length === 0) return res.status(404).json({ message: 'Item not found' });

        // Trigger notification if item just became available
        const updatedItem = result.rows[0];
        if (is_available === true || is_available === 'true') {
            // Fire async, don't block response
            triggerItemAvailable(id as string, updatedItem.name).catch(() => {});
        }

        res.json(updatedItem);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Admin: Update Menu Item (full edit) ───
export const updateMenuItem = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description, price, category, nutritional_info, stock_quantity, is_available, is_veg } = req.body;
    let { image_url } = req.body;

    try {
        // ─── IDOR: verify menu item belongs to staff's university ───
        const user = (req as any).user;
        const ownerCheck = await pool.query(
            `SELECT r.university_id FROM menu_items mi JOIN restaurants r ON mi.restaurant_id = r.id WHERE mi.id = $1`, [id]
        );
        if (ownerCheck.rows.length === 0) return res.status(404).json({ message: 'Menu item not found' });
        if (user?.university_id && ownerCheck.rows[0].university_id !== user.university_id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        if (req.file) {
            const ext = req.file.mimetype.split('/')[1] || 'jpg';
            const s3Url = await uploadToS3(req.file.buffer, req.file.mimetype, `food_items/${id}.${ext}`);
            image_url = `${s3Url}?v=${Date.now()}`;
        }

        const updates: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (name !== undefined) { updates.push(`name = $${idx++}`); params.push(name); }
        if (description !== undefined) { updates.push(`description = $${idx++}`); params.push(description); }
        if (price !== undefined) { updates.push(`price = $${idx++}`); params.push(price); }
        if (category !== undefined) { updates.push(`category = $${idx++}`); params.push(category); }
        if (image_url !== undefined) { updates.push(`image_url = $${idx++}`); params.push(image_url); }
        if (nutritional_info !== undefined) { updates.push(`nutritional_info = $${idx++}`); params.push(typeof nutritional_info === 'string' ? JSON.parse(nutritional_info) : nutritional_info); }
        if (stock_quantity !== undefined) { updates.push(`stock_quantity = $${idx++}`); params.push(stock_quantity); }
        if (is_available !== undefined) { updates.push(`is_available = $${idx++}`); params.push(is_available); }
        if (is_veg !== undefined) { updates.push(`is_veg = $${idx++}`); params.push(is_veg === 'true' || is_veg === true); }

        if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });

        params.push(id);
        const result = await pool.query(
            `UPDATE menu_items SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, params
        );

        if (result.rows.length === 0) return res.status(404).json({ message: 'Menu item not found' });
        
        const updatedItem = result.rows[0];

        // Trigger notification if item just became available
        if (is_available === true || is_available === 'true') {
            triggerItemAvailable(id as string, updatedItem.name).catch(() => {});
        }

        auditLog({ userId: user?.id, action: 'MENU_UPDATED', resource: `menu:${id}`, ip: getRequestIp(req) });
        res.json(updatedItem);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Admin: Delete (soft) Menu Item ───
export const deleteMenuItem = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;
    try {
        // ─── IDOR: verify menu item belongs to staff's university ───
        const ownerCheck = await pool.query(
            `SELECT r.university_id FROM menu_items mi JOIN restaurants r ON mi.restaurant_id = r.id WHERE mi.id = $1`, [id]
        );
        if (ownerCheck.rows.length === 0) return res.status(404).json({ message: 'Menu item not found' });
        if (user?.university_id && ownerCheck.rows[0].university_id !== user.university_id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const result = await pool.query(
            'UPDATE menu_items SET is_available = false WHERE id = $1 RETURNING *', [id]
        );
        auditLog({ userId: user?.id, action: 'MENU_DELETED', resource: `menu:${id}`, ip: getRequestIp(req) });
        res.json({ message: 'Item deactivated', item: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Check Availability (for Cart) ───
export const checkAvailability = async (req: Request, res: Response) => {
    const { item_ids } = req.body;
    
    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
        return res.status(400).json({ message: 'An array of item_ids is required' });
    }

    try {
        const result = await pool.query(
            `SELECT id, is_available, stock_quantity, price FROM menu_items WHERE id = ANY($1::uuid[])`,
            [item_ids]
        );
        
        // Create a map of availability keyed by item id
        const availabilityMap: Record<string, any> = {};
        for (const row of result.rows) {
            availabilityMap[row.id] = {
                is_available: row.is_available,
                stock_quantity: row.stock_quantity,
                price: parseFloat(row.price),
            };
        }
        
        res.json(availabilityMap);
    } catch (error) {
        console.error('Error checking availability:', error);
        res.status(500).json({ message: 'Server error check availability' });
    }
};
