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
