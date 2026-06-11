import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middlewares/authMiddleware';

// ─── List categories for a restaurant ─────────────────
export const getCategories = async (req: AuthRequest, res: Response) => {
    const { restaurant_id } = req.params;
    if (!restaurant_id) return res.status(400).json({ message: 'Restaurant ID is required' });

    try {
        const result = await pool.query(
            `SELECT c.*,
                    (SELECT COUNT(*)::int FROM menu_items mi WHERE mi.category_id = c.id) AS item_count
             FROM categories c
             WHERE c.restaurant_id = $1
             ORDER BY c.name ASC`,
            [restaurant_id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('[getCategories] error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Create a new category ────────────────────────────
export const createCategory = async (req: AuthRequest, res: Response) => {
    const { restaurant_id, name, cutoff_time, lead_time } = req.body;

    if (!restaurant_id || !name) {
        return res.status(400).json({ message: 'Restaurant ID and category name are required' });
    }

    try {
        // Verify restaurant belongs to the staff's university
        const staffRes = await pool.query('SELECT university_id FROM staff WHERE id = $1', [req.user.id]);
        if (staffRes.rows.length === 0) return res.sendStatus(403);
        const uniId = staffRes.rows[0].university_id;

        const restCheck = await pool.query(
            'SELECT id FROM restaurants WHERE id = $1 AND university_id = $2',
            [restaurant_id, uniId]
        );
        if (restCheck.rows.length === 0) return res.status(403).json({ message: 'Restaurant not found or access denied' });

        const result = await pool.query(
            `INSERT INTO categories (restaurant_id, name, cutoff_time, lead_time)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [restaurant_id, name.trim(), cutoff_time || null, lead_time || 0]
        );

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        if (error.code === '23505') {
            return res.status(409).json({ message: 'A category with this name already exists for this restaurant' });
        }
        console.error('[createCategory] error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Update a category ────────────────────────────────
export const updateCategory = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, cutoff_time, lead_time } = req.body;

    try {
        // IDOR check
        const ownerCheck = await pool.query(
            `SELECT c.id, r.university_id
             FROM categories c
             JOIN restaurants r ON c.restaurant_id = r.id
             WHERE c.id = $1`,
            [id]
        );
        if (ownerCheck.rows.length === 0) return res.status(404).json({ message: 'Category not found' });

        const user = req.user;
        if (user?.university_id && ownerCheck.rows[0].university_id !== user.university_id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const updates: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (name !== undefined) { updates.push(`name = $${idx++}`); params.push(name.trim()); }
        if (cutoff_time !== undefined) { updates.push(`cutoff_time = $${idx++}`); params.push(cutoff_time || null); }
        if (lead_time !== undefined) { updates.push(`lead_time = $${idx++}`); params.push(lead_time); }

        if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });

        params.push(id);
        const result = await pool.query(
            `UPDATE categories SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );

        // Keep the denormalized menu_items.category text in sync with the category name,
        // otherwise reports that read the string column mis-bucket items after a rename.
        if (name !== undefined) {
            await pool.query(
                'UPDATE menu_items SET category = $1 WHERE category_id = $2',
                [name.trim(), id]
            );
        }

        res.json(result.rows[0]);
    } catch (error: any) {
        if (error.code === '23505') {
            return res.status(409).json({ message: 'A category with this name already exists for this restaurant' });
        }
        console.error('[updateCategory] error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Delete a category (blocked if items exist) ──────
export const deleteCategory = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        // IDOR check
        const ownerCheck = await pool.query(
            `SELECT c.id, r.university_id
             FROM categories c
             JOIN restaurants r ON c.restaurant_id = r.id
             WHERE c.id = $1`,
            [id]
        );
        if (ownerCheck.rows.length === 0) return res.status(404).json({ message: 'Category not found' });

        const user = req.user;
        if (user?.university_id && ownerCheck.rows[0].university_id !== user.university_id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        // Block deletion if items are linked
        const itemCount = await pool.query(
            'SELECT COUNT(*)::int AS count FROM menu_items WHERE category_id = $1',
            [id]
        );
        if (itemCount.rows[0].count > 0) {
            return res.status(409).json({
                message: `Cannot delete: ${itemCount.rows[0].count} menu item(s) are still linked to this category. Reassign or remove them first.`
            });
        }

        await pool.query('DELETE FROM categories WHERE id = $1', [id]);
        res.json({ message: 'Category deleted' });
    } catch (error) {
        console.error('[deleteCategory] error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
