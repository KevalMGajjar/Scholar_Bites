import { Request, Response } from 'express';
import pool from '../config/db';

export const createUniversity = async (req: Request, res: Response) => {
    const { name, address, logo_url } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO universities (name, address, logo_url) VALUES ($1, $2, $3) RETURNING *',
            [name, address, logo_url]
        );
        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        if (error.code === '23505') {
            return res.status(409).json({ message: 'University already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

export const getUniversities = async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM universities ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const getUniversityById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM universities WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'University not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const searchUniversities = async (req: Request, res: Response) => {
    const q = (req.query.q as string || '').trim();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const lat = parseFloat(req.query.lat as string) || null;
    const lng = parseFloat(req.query.lng as string) || null;

    try {
        let query: string;
        let params: any[];

        if (q) {
            // Search by name with paging
            query = 'SELECT * FROM universities WHERE LOWER(name) LIKE LOWER($1) ORDER BY name LIMIT $2 OFFSET $3';
            params = [`%${q}%`, limit, offset];
        } else if (lat && lng) {
            // Sort by distance using Haversine formula (accurate for GPS coordinates)
            query = `SELECT *, 
                ( 6371 * acos( 
                    cos( radians($1) ) * cos( radians(latitude) ) * 
                    cos( radians(longitude) - radians($2) ) + 
                    sin( radians($1) ) * sin( radians(latitude) ) 
                )) as distance 
                FROM universities 
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL 
                ORDER BY distance 
                LIMIT $3 OFFSET $4`;
            params = [lat, lng, limit, offset];
        } else {
            query = 'SELECT * FROM universities ORDER BY name LIMIT $1 OFFSET $2';
            params = [limit, offset];
        }

        const result = await pool.query(query, params);

        // Get total count for paging metadata
        let countQuery: string;
        let countParams: any[];
        if (q) {
            countQuery = 'SELECT COUNT(*) FROM universities WHERE LOWER(name) LIKE LOWER($1)';
            countParams = [`%${q}%`];
        } else {
            countQuery = 'SELECT COUNT(*) FROM universities';
            countParams = [];
        }

        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            universities: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
