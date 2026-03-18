import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '../config/db';
import { generateToken } from '../utils/jwt';

/** Hash a JWT token to a short 64-char hex string for storage */
function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/** Save the active token hash on the user row (single-device enforcement) */
async function saveActiveToken(userId: string, token: string, table: 'users' | 'staff' = 'users') {
    const hash = hashToken(token);
    await pool.query(`UPDATE ${table} SET active_token = $1 WHERE id = $2`, [hash, userId]);
}

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

        // Industry-standard approach: allow re-login and invalidate old session.
        // If the user logs in again, we overwrite the old token. The old device
        // will be kicked out via the DEVICE_CONFLICT check in authMiddleware.

        const token = generateToken({ id: user.id, phone: user.phone, role });

        // Save token hash for single-device enforcement
        const table = role === 'student' ? 'users' : 'staff';
        await saveActiveToken(user.id, token, table);

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

        // Save token hash for single-device enforcement
        await saveActiveToken(user.id, token);

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

        // Save token hash for single-device enforcement
        await saveActiveToken(user.id, token);

        res.json({ token, user: { ...user, university_name: universityName, role: 'student' } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Staff Login (Email + Password) for Admin Panel ───
export const staffLogin = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const result = await pool.query(
            `SELECT s.*, uni.name as university_name 
             FROM staff s 
             LEFT JOIN universities uni ON s.university_id = uni.id 
             WHERE s.email = $1`,
            [email]
        );

        const staff = result.rows[0];
        if (!staff) {
            return res.status(404).json({ message: 'Staff member not found' });
        }

        const isValidPassword = await bcrypt.compare(password, staff.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        // Industry-standard approach: allow re-login and invalidate old session.
        // If the staff logs in again, we overwrite the old token. The old device
        // will be kicked out via the DEVICE_CONFLICT check in authMiddleware.

        const token = generateToken({ id: staff.id, email: staff.email, role: staff.role, university_id: staff.university_id });

        // Save token hash for single-device enforcement
        await saveActiveToken(staff.id, token, 'staff');

        res.json({
            token,
            user: {
                id: staff.id,
                name: staff.name,
                email: staff.email,
                role: staff.role,
                university_id: staff.university_id,
                university_name: staff.university_name,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Register Staff (Admin-only) ───
export const registerStaff = async (req: Request, res: Response) => {
    const { email, password, name, role, university_id } = req.body;

    if (!email || !password || !name || !role || !university_id) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO staff (email, password_hash, name, role, university_id)
             VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, university_id`,
            [email, hashedPassword, name, role, university_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Email already registered' });
        }
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Logout (Clears active session) ───
export const logout = async (req: Request, res: Response) => {
    // We expect the auth middleware to pass req.user
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const table = user.role === 'student' ? 'users' : 'staff';
        await pool.query(`UPDATE ${table} SET active_token = NULL WHERE id = $1`, [user.id]);
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
