import { Request, Response } from 'express';
import pool from '../config/db';

// ═══════════════════════════════════════════════════════════════
// University Settings Endpoints (for admin panel)
// Staff code login has been removed — staff are now pre-created
// by admin and use the normal phone OTP login flow.
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
