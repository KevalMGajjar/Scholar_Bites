import { Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../config/db';
import { generateToken } from '../utils/jwt';
import { AHMEDABAD_UNIVERSITY_ID } from '../config/constants';

/** Hash a JWT token to a short 64-char hex string for storage */
function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/** Save the active token hash on the user row (single-device enforcement) */
async function saveActiveToken(userId: string, token: string) {
    const hash = hashToken(token);
    await pool.query('UPDATE users SET active_token = $1 WHERE id = $2', [hash, userId]);
}

// ═══════════════════════════════════════════════════════════════
// Step 1: Verify Staff Access Code
// The app sends the staff code → we verify it against the university's
// auto-rotating code in university_settings
// ═══════════════════════════════════════════════════════════════
export const verifyStaffCode = async (req: Request, res: Response) => {
    const { staff_code } = req.body;

    if (!staff_code || typeof staff_code !== 'string' || staff_code.trim().length === 0) {
        return res.status(400).json({ message: 'Staff access code is required' });
    }

    try {
        // Single-university mode: check against Ahmedabad University's code
        const result = await pool.query(
            `SELECT s.staff_access_code, s.university_id, u.name as university_name
             FROM university_settings s
             JOIN universities u ON s.university_id = u.id
             WHERE s.university_id = $1`,
            [AHMEDABAD_UNIVERSITY_ID]
        );

        if (result.rows.length === 0) {
            return res.status(500).json({ message: 'University settings not configured. Contact administrator.' });
        }

        const settings = result.rows[0];

        // Constant-time comparison to prevent timing attacks
        const codeBuffer = Buffer.from(staff_code.toUpperCase().trim());
        const storedBuffer = Buffer.from(settings.staff_access_code);

        if (codeBuffer.length !== storedBuffer.length || !crypto.timingSafeEqual(codeBuffer, storedBuffer)) {
            return res.status(401).json({ message: 'Invalid staff access code' });
        }

        res.json({
            valid: true,
            university_id: settings.university_id,
            university_name: settings.university_name,
        });
    } catch (error: any) {
        console.error('[StaffAuth] verifyStaffCode error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// ═══════════════════════════════════════════════════════════════
// Step 2: Login for University Staff (app user, not admin panel staff)
// Checks users table where user_type = 'university_staff'
// ═══════════════════════════════════════════════════════════════
export const loginOtpStaff = async (req: Request, res: Response) => {
    const { phone } = req.body;

    if (!phone || typeof phone !== 'string') {
        return res.status(400).json({ message: 'Phone number is required' });
    }

    try {
        const result = await pool.query(
            `SELECT u.*, uni.name as university_name
             FROM users u
             LEFT JOIN universities uni ON u.university_id = uni.id
             WHERE u.phone = $1 AND u.user_type = 'university_staff'`,
            [phone]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'Staff account not found' });
        }

        const token = generateToken({
            id: user.id,
            phone: user.phone,
            role: 'student', // JWT role is 'student' because they use the users table
            user_type: 'university_staff',
        });

        await saveActiveToken(user.id, token);

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                university_id: user.university_id,
                university_name: user.university_name,
                role: 'student',
                user_type: 'university_staff',
            },
        });
    } catch (error: any) {
        console.error('[StaffAuth] loginOtpStaff error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// ═══════════════════════════════════════════════════════════════
// Step 3: Register University Staff (app user)
// Creates a new user with user_type = 'university_staff'
// ═══════════════════════════════════════════════════════════════
export const registerOtpStaff = async (req: Request, res: Response) => {
    const { phone, staff_code } = req.body;

    if (!phone || typeof phone !== 'string') {
        return res.status(400).json({ message: 'Phone number is required' });
    }

    if (!staff_code || typeof staff_code !== 'string') {
        return res.status(400).json({ message: 'Staff access code is required for registration' });
    }

    const university_id = AHMEDABAD_UNIVERSITY_ID;

    try {
        // Re-validate the staff code during registration for security
        const settingsResult = await pool.query(
            'SELECT staff_access_code FROM university_settings WHERE university_id = $1',
            [university_id]
        );

        if (settingsResult.rows.length === 0) {
            return res.status(500).json({ message: 'University settings not configured' });
        }

        const codeBuffer = Buffer.from(staff_code.toUpperCase().trim());
        const storedBuffer = Buffer.from(settingsResult.rows[0].staff_access_code);

        if (codeBuffer.length !== storedBuffer.length || !crypto.timingSafeEqual(codeBuffer, storedBuffer)) {
            return res.status(401).json({ message: 'Invalid staff access code' });
        }

        // Check if phone already exists (any user type)
        const existingUser = await pool.query('SELECT id, user_type FROM users WHERE phone = $1', [phone]);
        if (existingUser.rows.length > 0) {
            if (existingUser.rows[0].user_type === 'university_staff') {
                return res.status(409).json({ message: 'This phone number is already registered as staff' });
            }
            return res.status(409).json({ message: 'This phone number is already registered. Please use the student login.' });
        }

        const name = `Staff ${phone}`;

        const result = await pool.query(
            `INSERT INTO users (name, university_id, phone, user_type)
             VALUES ($1, $2, $3, 'university_staff')
             RETURNING id, name, phone, university_id, user_type`,
            [name, university_id, phone]
        );

        const user = result.rows[0];

        // Fetch university name
        const uniResult = await pool.query('SELECT name FROM universities WHERE id = $1', [university_id]);
        const universityName = uniResult.rows[0]?.name || '';

        const token = generateToken({
            id: user.id,
            phone: user.phone,
            role: 'student',
            user_type: 'university_staff',
        });

        await saveActiveToken(user.id, token);

        res.status(201).json({
            token,
            user: {
                ...user,
                university_name: universityName,
                role: 'student',
                user_type: 'university_staff',
            },
        });
    } catch (error: any) {
        console.error('[StaffAuth] registerOtpStaff error:', error.message);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Phone number already registered' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

// ═══════════════════════════════════════════════════════════════
// University Settings Endpoints (for admin panel)
// ═══════════════════════════════════════════════════════════════

/** Get university settings (staff code + group order toggle) */
export const getUniversitySettings = async (req: Request, res: Response) => {
    const { university_id } = req.params;

    try {
        const result = await pool.query(
            `SELECT s.*, u.name as university_name
             FROM university_settings s
             JOIN universities u ON s.university_id = u.id
             WHERE s.university_id = $1`,
            [university_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Settings not found' });
        }

        res.json(result.rows[0]);
    } catch (error: any) {
        console.error('[Settings] getUniversitySettings error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Update university settings (admin only) */
export const updateUniversitySettings = async (req: Request, res: Response) => {
    const { university_id } = req.params;
    const { group_order_visible_students } = req.body;

    try {
        const result = await pool.query(
            `UPDATE university_settings
             SET group_order_visible_students = COALESCE($1, group_order_visible_students),
                 updated_at = NOW()
             WHERE university_id = $2
             RETURNING *`,
            [group_order_visible_students, university_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Settings not found' });
        }

        res.json(result.rows[0]);
    } catch (error: any) {
        console.error('[Settings] updateUniversitySettings error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};
