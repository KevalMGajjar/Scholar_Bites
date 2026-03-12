import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middlewares/authMiddleware';

// ─── Submit / Update a Rating ────────────────────────
export const submitReview = async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;
    const { menu_item_id, rating } = req.body;

    if (!menu_item_id || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'menu_item_id and rating (1-5) are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Upsert the review (one per user per item)
        await client.query(
            `INSERT INTO reviews (user_id, menu_item_id, rating)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, menu_item_id) DO UPDATE SET rating = $3`,
            [userId, menu_item_id, rating]
        );

        // Recalculate the restaurant's average rating from all its items' reviews
        const restResult = await client.query(
            'SELECT restaurant_id FROM menu_items WHERE id = $1',
            [menu_item_id]
        );
        if (restResult.rows.length > 0) {
            const restaurantId = restResult.rows[0].restaurant_id;
            await client.query(
                `UPDATE restaurants SET rating = COALESCE(
                    (SELECT ROUND(AVG(r.rating)::numeric, 1)
                     FROM reviews r
                     JOIN menu_items m ON r.menu_item_id = m.id
                     WHERE m.restaurant_id = $1), 0)
                 WHERE id = $1`,
                [restaurantId]
            );
        }

        await client.query('COMMIT');
        res.json({ status: 'success', message: 'Rating submitted' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error submitting review:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

// ─── Get Rating Info for a Menu Item ─────────────────
export const getItemRating = async (req: AuthRequest, res: Response) => {
    const { menu_item_id } = req.params;
    const userId = req.user?.id;

    try {
        // Get average rating and count
        const avgResult = await pool.query(
            `SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0) as avg_rating,
                    COUNT(*)::int as review_count
             FROM reviews WHERE menu_item_id = $1`,
            [menu_item_id]
        );

        // Get the user's own rating (if any)
        let userRating = 0;
        if (userId) {
            const userResult = await pool.query(
                'SELECT rating FROM reviews WHERE user_id = $1 AND menu_item_id = $2',
                [userId, menu_item_id]
            );
            if (userResult.rows.length > 0) {
                userRating = userResult.rows[0].rating;
            }
        }

        res.json({
            avg_rating: parseFloat(avgResult.rows[0].avg_rating),
            review_count: avgResult.rows[0].review_count,
            user_rating: userRating,
        });
    } catch (error) {
        console.error('Error fetching rating:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
