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
               AND r.is_event_restaurant = false
               AND o.status IN ('placed', 'preparing', 'ready', 'completed')
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
                SELECT m.*, r.is_open as restaurant_is_open,
                       c.name as category_name, c.cutoff_time as category_cutoff_time, c.lead_time as category_lead_time
                FROM menu_items m 
                JOIN restaurants r ON m.restaurant_id = r.id 
                LEFT JOIN categories c ON m.category_id = c.id
                WHERE m.restaurant_id = $${pIndex++} AND r.name NOT ILIKE '%event management%' AND r.name NOT ILIKE '%club events%'${availFilter}
            `;
            params.push(restaurant_id);
        } else if (university_id) {
            query = `
                SELECT DISTINCT ON (m.name) m.*, r.is_open as restaurant_is_open,
                       c.name as category_name, c.cutoff_time as category_cutoff_time, c.lead_time as category_lead_time
                FROM menu_items m
                JOIN restaurants r ON m.restaurant_id = r.id
                LEFT JOIN categories c ON m.category_id = c.id
                WHERE r.university_id = $${pIndex++} AND r.is_event_restaurant = false${availFilter}
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
    const { name, description, price, category, category_id, image_url, nutritional_info, stock_quantity, restaurant_id, is_veg } = req.body;
    
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
            `INSERT INTO menu_items (restaurant_id, name, description, price, category, category_id, image_url, nutritional_info, stock_quantity, is_veg)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [restaurant_id, name, description, price, category || '', category_id || null, image_url, nutritional_info ? (typeof nutritional_info === 'string' ? JSON.parse(nutritional_info) : nutritional_info) : null, stock_quantity || 0, is_veg !== undefined ? (is_veg === 'true' || is_veg === true) : true]
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
    const { stock_quantity, is_available } = req.body;

    console.log(`[DEBUG updateStock] id=${id}, body=`, JSON.stringify(req.body));

    try {
        const currentRes = await pool.query(
            'SELECT stock_quantity, is_available, name FROM menu_items WHERE id = $1',
            [id]
        );
        if (currentRes.rows.length === 0) {
            console.log(`[DEBUG updateStock] ❌ Item ${id} not found`);
            return res.status(404).json({ message: 'Item not found' });
        }
        const current = currentRes.rows[0];
        const wasAvailable = current.is_available;
        const hadStock = current.stock_quantity > 0;

        console.log(`[DEBUG updateStock] Current state: name="${current.name}", is_available=${wasAvailable}, stock=${current.stock_quantity}`);

        let updates: string[] = [];
        let params: any[] = [];
        let idx = 1;

        const newStockQty = stock_quantity !== undefined ? Number(stock_quantity) : current.stock_quantity;

        if (stock_quantity !== undefined) {
            updates.push(`stock_quantity = $${idx++}`);
            params.push(newStockQty);
        }

        let finalIsAvailable: boolean | undefined;
        if (is_available !== undefined) {
            finalIsAvailable = is_available === true || is_available === 'true';
        } else if (stock_quantity !== undefined) {
            if (newStockQty <= 0 && current.is_available) {
                finalIsAvailable = false;
            } else if (newStockQty > 0 && !current.is_available && !hadStock) {
                finalIsAvailable = true;
            }
        }

        if (finalIsAvailable !== undefined) {
            updates.push(`is_available = $${idx++}`);
            params.push(finalIsAvailable);
        }

        if (updates.length === 0) return res.sendStatus(400);

        params.push(id);
        const query = `UPDATE menu_items SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
        const result = await pool.query(query, params);
        const updatedItem = result.rows[0];

        const isNowAvailable = updatedItem.is_available && updatedItem.stock_quantity > 0;
        const wasUnavailable = !wasAvailable || !hadStock;

        console.log(`[DEBUG updateStock] After update: is_available=${updatedItem.is_available}, stock=${updatedItem.stock_quantity}`);
        console.log(`[DEBUG updateStock] Transition check: isNowAvailable=${isNowAvailable}, wasUnavailable=${wasUnavailable}, willNotify=${isNowAvailable && wasUnavailable}`);

        if (isNowAvailable && wasUnavailable) {
            console.log(`[Menu] 📦 "${updatedItem.name}" restocked → triggering item_available notification`);
            triggerItemAvailable(id as string, updatedItem.name).catch((err) => console.error('[Menu] triggerItemAvailable failed:', err));
        }

        if (finalIsAvailable === false && current.is_available) {
            console.log(`[Menu] 📦 Auto-disabled "${updatedItem.name}" (stock set to ${newStockQty})`);
        }

        res.json(updatedItem);
    } catch (error) {
        console.error('[updateStock] error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Admin: Update Menu Item (full edit) ───
export const updateMenuItem = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description, price, category, category_id, nutritional_info, stock_quantity, is_available, is_veg } = req.body;
    let { image_url } = req.body;

    console.log(`[DEBUG updateMenuItem] id=${id}, body keys=[${Object.keys(req.body).join(', ')}], is_available=${is_available}, stock_quantity=${stock_quantity}`);

    try {
        const user = (req as any).user;

        // ─── IDOR check — LEFT JOIN so items without restaurant_id still work ───
        const ownerCheck = await pool.query(
            `SELECT mi.stock_quantity, mi.is_available, mi.name,
                    r.university_id
             FROM menu_items mi
             LEFT JOIN restaurants r ON mi.restaurant_id = r.id
             WHERE mi.id = $1`, [id]
        );
        if (ownerCheck.rows.length === 0) {
            console.log(`[DEBUG updateMenuItem] ❌ Item ${id} not found in DB`);
            return res.status(404).json({ message: 'Menu item not found' });
        }
        if (user?.university_id && ownerCheck.rows[0].university_id !== user.university_id) {
            console.log(`[DEBUG updateMenuItem] ❌ IDOR block: user uni=${user.university_id}, item uni=${ownerCheck.rows[0].university_id}`);
            return res.status(403).json({ message: 'Forbidden' });
        }

        const current = ownerCheck.rows[0];
        const wasAvailable = current.is_available;
        const hadStock = current.stock_quantity > 0;

        console.log(`[DEBUG updateMenuItem] Current state: name="${current.name}", is_available=${wasAvailable}, stock=${current.stock_quantity}`);

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
        if (is_veg !== undefined) { updates.push(`is_veg = $${idx++}`); params.push(is_veg === 'true' || is_veg === true); }
        if (category_id !== undefined) { updates.push(`category_id = $${idx++}`); params.push(category_id || null); }

        // ─── Smart stock → availability sync ───
        const newStockQty = stock_quantity !== undefined ? Number(stock_quantity) : current.stock_quantity;
        if (stock_quantity !== undefined) { updates.push(`stock_quantity = $${idx++}`); params.push(newStockQty); }

        let finalIsAvailable: boolean | undefined;
        if (is_available !== undefined) {
            finalIsAvailable = is_available === true || is_available === 'true';
        } else if (stock_quantity !== undefined) {
            if (newStockQty <= 0 && current.is_available) {
                finalIsAvailable = false;
            } else if (newStockQty > 0 && !current.is_available && !hadStock) {
                finalIsAvailable = true;
            }
        }
        if (finalIsAvailable !== undefined) { updates.push(`is_available = $${idx++}`); params.push(finalIsAvailable); }

        console.log(`[DEBUG updateMenuItem] finalIsAvailable=${finalIsAvailable}, updates=[${updates.join(', ')}]`);

        if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });

        params.push(id);
        const result = await pool.query(
            `UPDATE menu_items SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, params
        );

        if (result.rows.length === 0) return res.status(404).json({ message: 'Menu item not found' });
        
        const updatedItem = result.rows[0];

        // ─── Notification transition detection ───
        const isNowAvailable = updatedItem.is_available && updatedItem.stock_quantity > 0;
        const wasUnavailable = !wasAvailable || !hadStock;

        console.log(`[DEBUG updateMenuItem] After update: is_available=${updatedItem.is_available}, stock=${updatedItem.stock_quantity}`);
        console.log(`[DEBUG updateMenuItem] Transition: isNowAvailable=${isNowAvailable}, wasUnavailable=${wasUnavailable}, willNotify=${isNowAvailable && wasUnavailable}`);

        if (isNowAvailable && wasUnavailable) {
            console.log(`[Menu] 🔔 "${updatedItem.name}" became available → calling triggerItemAvailable`);
            triggerItemAvailable(id as string, updatedItem.name).catch((err) => console.error('[Menu] triggerItemAvailable failed:', err));
        } else {
            console.log(`[DEBUG updateMenuItem] ⏭️ Notification skipped (no unavailable→available transition)`);
        }

        auditLog({ userId: user?.id, action: 'MENU_UPDATED', resource: `menu:${id}`, ip: getRequestIp(req) });
        res.json(updatedItem);
    } catch (error) {
        console.error('[updateMenuItem] error:', error);
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

        // Try a real delete. If the item is referenced by past orders/reviews, the FK
        // constraint blocks it (code 23503) — fall back to archiving (hiding) it instead
        // so we never orphan order history.
        try {
            await pool.query('DELETE FROM menu_items WHERE id = $1', [id]);
            auditLog({ userId: user?.id, action: 'MENU_DELETED', resource: `menu:${id}`, details: 'Permanently deleted', ip: getRequestIp(req) });
            return res.json({ message: 'Item permanently deleted', deleted: true });
        } catch (err: any) {
            if (err.code === '23503') {
                const result = await pool.query(
                    'UPDATE menu_items SET is_available = false WHERE id = $1 RETURNING *', [id]
                );
                auditLog({ userId: user?.id, action: 'MENU_DELETED', resource: `menu:${id}`, details: 'Archived (had order history)', ip: getRequestIp(req) });
                return res.json({
                    message: 'This item has order history, so it was archived (hidden from the menu) instead of being permanently deleted.',
                    deleted: false,
                    item: result.rows[0],
                });
            }
            throw err;
        }
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
