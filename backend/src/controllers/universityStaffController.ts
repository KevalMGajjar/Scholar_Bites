import { Request, Response } from 'express';
import pool from '../config/db';
import { AHMEDABAD_UNIVERSITY_ID } from '../config/constants';
import { auditLog, getRequestIp } from '../services/auditLogger';

// ═══════════════════════════════════════════════════════════════
// University Staff Management (Super Admin)
// Manages users with user_type = 'university_staff' in the users table
// ═══════════════════════════════════════════════════════════════

/** List all university staff users */
export const getUniversityStaff = async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.name, u.phone, u.email, u.user_type, u.dean_id, u.created_at,
                    uni.name as university_name,
                    d.name as dean_name, d.school_name as dean_school
             FROM users u
             LEFT JOIN universities uni ON u.university_id = uni.id
             LEFT JOIN deans d ON u.dean_id = d.id
             WHERE u.user_type = 'university_staff'
             ORDER BY u.created_at DESC`
        );
        res.json(result.rows);
    } catch (error: any) {
        console.error('[UniversityStaff] list error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Create a single university staff user */
export const createUniversityStaff = async (req: Request, res: Response) => {
    const { name, phone, email, dean_id } = req.body;

    if (!name || !phone || !email) {
        return res.status(400).json({ message: 'Name, phone number, and email are required' });
    }

    // Basic phone validation (10-digit Indian number)
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
        return res.status(400).json({ message: 'Invalid phone number. Must be 10 digits.' });
    }

    try {
        // Check if phone already exists
        const existing = await pool.query('SELECT id, user_type FROM users WHERE phone = $1', [cleanPhone]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ 
                message: `Phone number already registered as ${existing.rows[0].user_type === 'university_staff' ? 'staff' : 'student'}` 
            });
        }

        // Check if email already exists
        if (email) {
            const emailExists = await pool.query('SELECT id FROM users WHERE email = $1', [email.trim()]);
            if (emailExists.rows.length > 0) {
                return res.status(409).json({ message: 'Email address already registered' });
            }
        }

        const result = await pool.query(
            `INSERT INTO users (name, phone, email, university_id, user_type, dean_id)
             VALUES ($1, $2, $3, $4, 'university_staff', $5)
             RETURNING id, name, phone, email, user_type, dean_id, created_at`,
            [name.trim(), cleanPhone, email || null, AHMEDABAD_UNIVERSITY_ID, dean_id || null]
        );

        auditLog({
            userId: (req as any).user?.id,
            action: 'UNIVERSITY_STAFF_CREATED',
            resource: `delegate:${result.rows[0].id}`,
            details: `${name.trim()} (${cleanPhone})`,
            ip: getRequestIp(req),
        });

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error('[UniversityStaff] create error:', error.message);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Phone number already registered' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

/** Bulk create university staff from CSV data */
export const bulkCreateUniversityStaff = async (req: Request, res: Response) => {
    const { staff } = req.body;

    if (!Array.isArray(staff) || staff.length === 0) {
        return res.status(400).json({ message: 'Staff array is required and must not be empty' });
    }

    if (staff.length > 500) {
        return res.status(400).json({ message: 'Maximum 500 entries per batch' });
    }

    const created: any[] = [];
    const skipped: { phone: string; name: string; reason: string }[] = [];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const entry of staff) {
            const { name, phone, email } = entry;

            if (!name || !phone) {
                skipped.push({ phone: phone || '?', name: name || '?', reason: 'Missing name or phone' });
                continue;
            }

            const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
            if (cleanPhone.length !== 10) {
                skipped.push({ phone: String(phone), name, reason: 'Invalid phone number' });
                continue;
            }

            const cleanEmail = email ? String(email).trim() : null;

            try {
                // Check for existing user by phone
                const existing = await client.query('SELECT id FROM users WHERE phone = $1', [cleanPhone]);
                if (existing.rows.length > 0) {
                    skipped.push({ phone: cleanPhone, name, reason: 'Phone already registered' });
                    continue;
                }

                // Check for existing email
                if (cleanEmail) {
                    const emailExists = await client.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
                    if (emailExists.rows.length > 0) {
                        skipped.push({ phone: cleanPhone, name, reason: 'Email already registered' });
                        continue;
                    }
                }

                const result = await client.query(
                    `INSERT INTO users (name, phone, email, university_id, user_type)
                     VALUES ($1, $2, $3, $4, 'university_staff')
                     RETURNING id, name, phone, email, user_type, created_at`,
                    [name.trim(), cleanPhone, cleanEmail, AHMEDABAD_UNIVERSITY_ID]
                );

                created.push(result.rows[0]);
            } catch (insertError: any) {
                if (insertError.code === '23505') {
                    skipped.push({ phone: cleanPhone, name, reason: 'Duplicate phone number' });
                } else {
                    skipped.push({ phone: cleanPhone, name, reason: 'Database error' });
                }
            }
        }

        await client.query('COMMIT');

        auditLog({
            userId: (req as any).user?.id,
            action: 'UNIVERSITY_STAFF_CREATED',
            resource: 'delegate:bulk',
            details: `Bulk import — ${created.length} created, ${skipped.length} skipped`,
            ip: getRequestIp(req),
        });

        res.status(201).json({
            created: created.length,
            skipped: skipped.length,
            created_staff: created,
            skipped_details: skipped,
        });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('[UniversityStaff] bulk create error:', error.message);
        res.status(500).json({ message: 'Server error during bulk import' });
    } finally {
        client.release();
    }
};

/** Delete a university staff user */
export const deleteUniversityStaff = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        // Verify the user is actually university_staff
        const check = await pool.query(
            'SELECT id, user_type FROM users WHERE id = $1',
            [id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (check.rows[0].user_type !== 'university_staff') {
            return res.status(400).json({ message: 'This user is not a university staff member' });
        }

        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        auditLog({
            userId: (req as any).user?.id,
            action: 'UNIVERSITY_STAFF_DELETED',
            resource: `delegate:${id}`,
            ip: getRequestIp(req),
        });
        res.json({ message: 'Staff member removed successfully' });
    } catch (error: any) {
        console.error('[UniversityStaff] delete error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** List all deans (for dropdown in Add Representative form) */
export const getDeansList = async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, school_name FROM deans ORDER BY name ASC`
        );
        res.json(result.rows);
    } catch (error: any) {
        console.error('[UniversityStaff] getDeansList error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Update a university staff (admin representative) */
export const updateUniversityStaff = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, phone, email, dean_id } = req.body;

    if (!name && !phone && !email && dean_id === undefined) {
        return res.status(400).json({ message: 'At least one field is required' });
    }

    try {
        const check = await pool.query('SELECT id, user_type FROM users WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        if (check.rows[0].user_type !== 'university_staff') {
            return res.status(400).json({ message: 'This user is not an admin representative' });
        }

        const fields: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (name) { fields.push(`name = $${idx++}`); values.push(name.trim()); }
        if (phone) {
            const cleanPhone = phone.replace(/\D/g, '').slice(-10);
            if (cleanPhone.length !== 10) return res.status(400).json({ message: 'Invalid phone number' });
            const dup = await pool.query('SELECT id FROM users WHERE phone = $1 AND id != $2', [cleanPhone, id]);
            if (dup.rows.length > 0) return res.status(409).json({ message: 'Phone number already registered' });
            fields.push(`phone = $${idx++}`); values.push(cleanPhone);
        }
        if (email) {
            const dup = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email.trim(), id]);
            if (dup.rows.length > 0) return res.status(409).json({ message: 'Email already registered' });
            fields.push(`email = $${idx++}`); values.push(email.trim());
        }
        if (dean_id !== undefined) {
            fields.push(`dean_id = $${idx++}`); values.push(dean_id || null);
        }

        values.push(id);
        const result = await pool.query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}
             RETURNING id, name, phone, email, user_type, dean_id, created_at`,
            values
        );

        auditLog({
            userId: (req as any).user?.id,
            action: 'UNIVERSITY_STAFF_UPDATED',
            resource: `delegate:${id}`,
            details: fields.map((f) => f.split(' = ')[0]).join(', '),
            ip: getRequestIp(req),
        });

        res.json(result.rows[0]);
    } catch (error: any) {
        console.error('[UniversityStaff] update error:', error.message);
        if (error.code === '23505') return res.status(409).json({ message: 'Duplicate phone or email' });
        res.status(500).json({ message: 'Server error' });
    }
};
