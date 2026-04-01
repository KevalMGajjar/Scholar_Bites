import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middlewares/authMiddleware';

// ─── GET /api/user/favorites ───
// Returns all menu_item_ids the authenticated user has favorited.
export const getFavorites = async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;

    try {
        const result = await pool.query(
            'SELECT menu_item_id FROM user_favorites WHERE user_id = $1',
            [userId]
        );
        const ids = result.rows.map((r: any) => r.menu_item_id);
        res.json({ favorites: ids });
    } catch (error) {
        console.error('getFavorites error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── POST /api/user/favorites/sync ───
// Accepts full list of favorite IDs from the client and syncs the DB.
// This is an idempotent "set" operation — the DB state becomes exactly
// what the client sends, preventing drift between local and remote.
export const syncFavorites = async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;
    const { menu_item_ids } = req.body;      // string[] of UUIDs

    if (!Array.isArray(menu_item_ids)) {
        return res.status(400).json({ message: 'menu_item_ids must be an array' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Remove any favorites NOT in the incoming list
        if (menu_item_ids.length === 0) {
            await client.query('DELETE FROM user_favorites WHERE user_id = $1', [userId]);
        } else {
            await client.query(
                'DELETE FROM user_favorites WHERE user_id = $1 AND menu_item_id != ALL($2::uuid[])',
                [userId, menu_item_ids]
            );
        }

        // 2. Upsert all incoming favorites (ON CONFLICT DO NOTHING for idempotence)
        for (const itemId of menu_item_ids) {
            await client.query(
                `INSERT INTO user_favorites (user_id, menu_item_id)
                 VALUES ($1, $2)
                 ON CONFLICT (user_id, menu_item_id) DO NOTHING`,
                [userId, itemId]
            );
        }

        await client.query('COMMIT');
        res.json({ message: 'Favorites synced', count: menu_item_ids.length });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('syncFavorites error:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

// ─── POST /api/user/favorites/toggle ───
// Toggle a single favorite. Lighter than full sync for real-time taps.
export const toggleFavorite = async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;
    const { menu_item_id } = req.body;

    if (!menu_item_id) {
        return res.status(400).json({ message: 'menu_item_id is required' });
    }

    try {
        // Try to delete first. If nothing was deleted, insert.
        const deleteResult = await pool.query(
            'DELETE FROM user_favorites WHERE user_id = $1 AND menu_item_id = $2',
            [userId, menu_item_id]
        );

        if ((deleteResult.rowCount ?? 0) > 0) {
            // Was favorited → now removed
            return res.json({ favorited: false });
        }

        // Wasn't favorited → add it
        await pool.query(
            `INSERT INTO user_favorites (user_id, menu_item_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, menu_item_id) DO NOTHING`,
            [userId, menu_item_id]
        );
        res.json({ favorited: true });
    } catch (error) {
        console.error('toggleFavorite error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
