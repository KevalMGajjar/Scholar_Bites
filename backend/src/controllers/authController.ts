import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/db';
import { generateToken } from '../utils/jwt';

export const loginOtp = async (req: Request, res: Response) => {
    const { phone } = req.body;

    try {
        let result = await pool.query(
            `SELECT u.*, uni.name as university_name 
             FROM users u 
             LEFT JOIN universities uni ON u.university_id = uni.id 
             WHERE u.phone = $1`,
            [phone]
        );
        let user = result.rows[0];
        let role = 'student';

        // Check if staff
        if (!user) {
            result = await pool.query(
                `SELECT s.*, uni.name as university_name
                 FROM staff s
                 LEFT JOIN universities uni ON s.university_id = uni.id
                 WHERE s.phone = $1`,
                [phone]
            );
            user = result.rows[0];
            if (user) role = user.role;
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const token = generateToken({ id: user.id, phone: user.phone, role });
        res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, university_id: user.university_id, university_name: user.university_name, role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const registerOtp = async (req: Request, res: Response) => {
    const { phone, university_id } = req.body;

    try {
        const name = `Student ${phone}`;

        const result = await pool.query(
            'INSERT INTO users (name, university_id, phone) VALUES ($1, $2, $3) RETURNING id, name, phone, university_id',
            [name, university_id, phone]
        );

        const user = result.rows[0];

        // Fetch university name
        const uniResult = await pool.query('SELECT name FROM universities WHERE id = $1', [university_id]);
        const universityName = uniResult.rows[0]?.name || '';

        const token = generateToken({ id: user.id, phone: user.phone, role: 'student' });
        res.status(201).json({ token, user: { ...user, university_name: universityName, role: 'student' } });
    } catch (error: any) {
        console.error(error);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Phone number already registered' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateUniversity = async (req: Request, res: Response) => {
    const { phone, university_id } = req.body;

    try {
        const result = await pool.query(
            `UPDATE users SET university_id = $1 WHERE phone = $2 RETURNING id, name, phone, university_id`,
            [university_id, phone]
        );

        const user = result.rows[0];
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const uniResult = await pool.query('SELECT name FROM universities WHERE id = $1', [university_id]);
        const universityName = uniResult.rows[0]?.name || '';

        const token = generateToken({ id: user.id, phone: user.phone, role: 'student' });
        res.json({ token, user: { ...user, university_name: universityName, role: 'student' } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
