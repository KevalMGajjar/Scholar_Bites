import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/db';
import { generateToken } from '../utils/jwt';

export const register = async (req: Request, res: Response) => {
    const { name, email, password, university_id, phone } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (name, email, password_hash, university_id, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, phone',
            [name, email, hashedPassword, university_id, phone]
        );

        const user = result.rows[0];
        // Default role for students is null or we can infer it. 
        // Wait, role is in 'staff' table. Users table doesn't have role.
        // So token should probably indicate 'student' or check if user is staff.
        // For now, let's assume 'student' if not in staff table. 
        // But payload needs role for RBAC.

        // Standardise token payload: { id, email, role }
        // Users = 'student'

        // TODO: In the future, once the user signs up successfully, query the university's 
        // external DB here using `user.email` to retrieve the student's actual phone number.
        // Then, update the `users` table with the fetched phone number.

        const token = generateToken({ id: user.id, email: user.email, role: 'student' });
        res.status(201).json({ token, user: { ...user, role: 'student' } });
    } catch (error: any) {
        console.error(error);
        if (error.code === '23505') { // unique violation
            return res.status(409).json({ message: 'Email already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        // Check Users table first
        let result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        let user = result.rows[0];
        let role = 'student';

        if (!user) {
            // Check Staff table
            result = await pool.query('SELECT * FROM staff WHERE email = $1', [email]);
            user = result.rows[0];
            if (user) {
                role = user.role;
            }
        }

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = generateToken({ id: user.id, email: user.email, role });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const loginOtp = async (req: Request, res: Response) => {
    const { phone } = req.body;

    try {
        const result = await pool.query(
            `SELECT u.*, uni.name as university_name 
             FROM users u 
             LEFT JOIN universities uni ON u.university_id = uni.id 
             WHERE u.phone = $1`,
            [phone]
        );
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const token = generateToken({ id: user.id, email: user.email, role: 'student' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, university_id: user.university_id, university_name: user.university_name, role: 'student' } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const registerOtp = async (req: Request, res: Response) => {
    const { phone, university_id } = req.body;

    try {
        // Auto-generate missing required fields
        const email = `${phone}@student.university.com`;
        const name = `Student ${phone}`;
        const randomPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        const result = await pool.query(
            'INSERT INTO users (name, email, password_hash, university_id, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, phone, university_id',
            [name, email, hashedPassword, university_id, phone]
        );

        const user = result.rows[0];

        // Fetch university name
        const uniResult = await pool.query('SELECT name FROM universities WHERE id = $1', [university_id]);
        const universityName = uniResult.rows[0]?.name || '';

        const token = generateToken({ id: user.id, email: user.email, role: 'student' });
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
            `UPDATE users SET university_id = $1 WHERE phone = $2 RETURNING id, name, email, phone, university_id`,
            [university_id, phone]
        );

        const user = result.rows[0];
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const uniResult = await pool.query('SELECT name FROM universities WHERE id = $1', [university_id]);
        const universityName = uniResult.rows[0]?.name || '';

        const token = generateToken({ id: user.id, email: user.email, role: 'student' });
        res.json({ token, user: { ...user, university_name: universityName, role: 'student' } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
