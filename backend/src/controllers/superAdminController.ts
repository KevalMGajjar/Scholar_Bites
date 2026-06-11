import { Request, Response } from 'express';
import pool from '../config/db';

import bcrypt from 'bcrypt';
import { unlockAccount as unlockBruteForce, getLockedAccounts as getBruteForceLocked } from '../middlewares/security';
import { auditLog, getRequestIp } from '../services/auditLogger';
import { passwordStrengthError } from '../middlewares/validators';


// ─── 1. System Health ───
export const getSystemHealth = async (req: Request, res: Response) => {
    try {
        const orderStatusResult = await pool.query(`
            SELECT status, COUNT(*)::int as count 
            FROM orders 
            WHERE created_at >= CURRENT_DATE
            GROUP BY status
        `);
        const ordersToday: Record<string, number> = {};
        let totalOrdersToday = 0;
        orderStatusResult.rows.forEach(r => {
            ordersToday[r.status] = r.count;
            totalOrdersToday += r.count;
        });

        const eventsResult = await pool.query(`
            SELECT COUNT(*)::int as count
            FROM audit_logs 
            WHERE created_at >= CURRENT_DATE
        `);
        const systemEventsToday = eventsResult.rows[0].count;

        const staffResult = await pool.query(`
            SELECT COUNT(DISTINCT user_id)::int as count
            FROM audit_logs
            WHERE action = 'LOGIN_SUCCESS' AND created_at >= CURRENT_DATE
        `);
        const activeStaffToday = staffResult.rows[0].count;

        const anomalyResult = await pool.query(`
            SELECT action, details, created_at, user_id
            FROM audit_logs
            WHERE action IN (
                'LOGIN_FAILED', 'LOGIN_LOCKED', 'LOGIN_PANEL_DENIED',
                'LOGIN_OTP_BURNED', 'LOGIN_GOOGLE_FAILED', 'REFUND_REJECTED'
            )
            ORDER BY created_at DESC
            LIMIT 10
        `);

        res.json({
            ordersToday,
            totalOrdersToday,
            systemEventsToday,
            activeStaffToday,
            recentAnomalies: anomalyResult.rows
        });
    } catch (err) {
        console.error('Error fetching system health:', err);
        res.status(500).json({ message: 'Server error retrieving system health.' });
    }
};

// ─── 2. Staff Management ───
export const getStaffMembers = async (req: Request, res: Response) => {
    try {
        const staff = await pool.query(`
            SELECT s.id, s.name, s.email, s.phone, s.role, s.restaurant_id, s.created_at,
                   r.name as restaurant_name
            FROM staff s
            LEFT JOIN restaurants r ON s.restaurant_id = r.id
            ORDER BY s.created_at DESC
        `);
        res.json(staff.rows);
    } catch (err) {
        console.error('Error fetching staff members:', err);
        res.status(500).json({ message: 'Server error retrieving staff.' });
    }
};

export const addStaffMember = async (req: Request, res: Response) => {
    const { name, email, password, role, restaurant_id } = req.body;
    try {
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'Name, email, password, and role are all required.' });
        }
        if (!['staff', 'admin', 'super_admin'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role provided.' });
        }
        // Staff (kitchen) accounts must be tied to a restaurant so they can see that
        // restaurant's order board. Admins/super_admins are not restaurant-scoped.
        if (role === 'staff' && !restaurant_id) {
            return res.status(400).json({ message: 'A restaurant must be selected for staff accounts.' });
        }
        // These accounts can be admin / super_admin — enforce the same strong
        // password rule used everywhere else (validators.ts passwordSchema).
        const pwErr = passwordStrengthError(password);
        if (pwErr) {
            return res.status(400).json({ message: pwErr });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        // Dynamically fetch the first university
        const uniResult = await pool.query('SELECT id FROM universities LIMIT 1');
        if (uniResult.rows.length === 0) {
            return res.status(500).json({ message: 'No university found in the system.' });
        }
        const uniId = uniResult.rows[0].id;

        // Validate the restaurant belongs to this university (when provided)
        let restaurantId: string | null = null;
        if (restaurant_id) {
            const restRes = await pool.query('SELECT id FROM restaurants WHERE id = $1 AND university_id = $2', [restaurant_id, uniId]);
            if (restRes.rows.length === 0) {
                return res.status(400).json({ message: 'Selected restaurant was not found.' });
            }
            restaurantId = restRes.rows[0].id;
        }

        const newStaff = await pool.query(`
            INSERT INTO staff (university_id, name, email, password_hash, role, restaurant_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, name, email, role, restaurant_id, created_at
        `, [uniId, name, email, passwordHash, role, restaurantId]);

        const caller = (req as any).user;
        auditLog({
            userId: caller?.id,
            action: 'STAFF_CREATED',
            resource: `staff:${newStaff.rows[0].id}`,
            details: `Created ${role} account for ${email}`,
            ip: getRequestIp(req),
        });

        res.status(201).json(newStaff.rows[0]);
    } catch (err: any) {
        if (err.code === '23505') {
            return res.status(409).json({ message: 'Email already exists.' });
        }
        console.error('Error adding staff member:', err);
        res.status(500).json({ message: 'Server error adding staff.' });
    }
};

// ─── Update Staff Member ───
export const updateStaffMember = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, email, role, password, restaurant_id } = req.body;
    const caller = (req as any).user;
    const ip = getRequestIp(req);

    try {
        if (role && !['staff', 'admin', 'super_admin'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role provided.' });
        }

        const target = await pool.query('SELECT id, name, email, role FROM staff WHERE id = $1', [id]);
        if (target.rows.length === 0) {
            return res.status(404).json({ message: 'Staff member not found.' });
        }

        // Resolve the effective role after this update to validate restaurant assignment.
        const effectiveRole = role !== undefined ? role : target.rows[0].role;
        if (restaurant_id !== undefined && restaurant_id) {
            const restRes = await pool.query('SELECT id FROM restaurants WHERE id = $1', [restaurant_id]);
            if (restRes.rows.length === 0) {
                return res.status(400).json({ message: 'Selected restaurant was not found.' });
            }
        }
        if (effectiveRole === 'staff' && restaurant_id === undefined) {
            // Editing a staff account but no restaurant context provided — ignore silently.
        } else if (effectiveRole === 'staff' && !restaurant_id) {
            return res.status(400).json({ message: 'A restaurant must be selected for staff accounts.' });
        }

        // Prevent locking yourself out by changing your own role
        if (caller?.id === id && role && role !== target.rows[0].role) {
            return res.status(403).json({ message: 'You cannot change your own role.' });
        }

        const updates: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (name !== undefined) { updates.push(`name = $${idx++}`); params.push(name); }
        if (email !== undefined) { updates.push(`email = $${idx++}`); params.push(email); }
        if (role !== undefined) { updates.push(`role = $${idx++}`); params.push(role); }
        if (restaurant_id !== undefined) {
            // Admins/super_admins are not restaurant-scoped; clear it if role flips away from staff.
            const restToSet = effectiveRole === 'staff' ? restaurant_id : null;
            updates.push(`restaurant_id = $${idx++}`);
            params.push(restToSet);
        }
        if (password) {
            const pwErr = passwordStrengthError(password);
            if (pwErr) {
                return res.status(400).json({ message: pwErr });
            }
            const passwordHash = await bcrypt.hash(password, 10);
            updates.push(`password_hash = $${idx++}`);
            params.push(passwordHash);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'No fields to update.' });
        }

        params.push(id);
        const result = await pool.query(
            `UPDATE staff SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, email, role, restaurant_id, created_at`,
            params
        );

        auditLog({
            userId: caller?.id,
            action: 'STAFF_UPDATED',
            resource: `staff:${id}`,
            details: `Updated ${updates.map(u => u.split(' = ')[0]).join(', ')} for ${target.rows[0].email || target.rows[0].name}`,
            ip,
        });

        res.json(result.rows[0]);
    } catch (err: any) {
        if (err.code === '23505') {
            return res.status(409).json({ message: 'Email already exists.' });
        }
        console.error('Error updating staff member:', err);
        res.status(500).json({ message: 'Server error updating staff.' });
    }
};

// ─── Delete Staff Member ───
export const deleteStaffMember = async (req: Request, res: Response) => {
    const { id } = req.params;
    const caller = (req as any).user;
    const ip = getRequestIp(req);

    try {
        // Prevent self-deletion
        if (caller?.id === id) {
            return res.status(403).json({ message: 'You cannot delete your own account.' });
        }

        // Fetch target to verify existence and prevent deleting other super admins
        const target = await pool.query('SELECT id, name, email, role FROM staff WHERE id = $1', [id]);
        if (target.rows.length === 0) {
            return res.status(404).json({ message: 'Staff member not found.' });
        }

        const staff = target.rows[0];

        await pool.query('DELETE FROM staff WHERE id = $1', [id]);

        auditLog({
            userId: caller?.id,
            action: 'STAFF_DELETED',
            resource: `staff:${id}`,
            details: `Deleted ${staff.role} account: ${staff.name} (${staff.email})`,
            ip,
        });

        res.json({ message: `${staff.name} has been permanently deleted.` });
    } catch (err) {
        console.error('Error deleting staff member:', err);
        res.status(500).json({ message: 'Server error deleting staff.' });
    }
};

export const getStaffAnalytics = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const loginResult = await pool.query(`
            SELECT created_at as last_login 
            FROM audit_logs 
            WHERE user_id = $1 AND action = 'LOGIN_SUCCESS' 
            ORDER BY created_at DESC LIMIT 1
        `, [id]);

        const orderResult = await pool.query(`
            SELECT COUNT(*)::int as count 
            FROM audit_logs 
            WHERE user_id = $1 AND action = 'ORDER_STATUS_CHANGED' AND details ILIKE '%status=completed%'
        `, [id]);

        const refundResult = await pool.query(`
            SELECT COUNT(*)::int as count 
            FROM audit_logs 
            WHERE user_id = $1 AND action IN ('REFUND_APPROVED', 'REFUND_REQUESTED')
        `, [id]);

        const recentActivity = await pool.query(`
            SELECT action, resource, details, created_at 
            FROM audit_logs 
            WHERE user_id = $1 
            ORDER BY created_at DESC LIMIT 15
        `, [id]);

        res.json({
            lastLogin: loginResult.rows[0]?.last_login || null,
            totalOrdersCompleted: orderResult.rows[0].count,
            totalRefundsHandled: refundResult.rows[0].count,
            recentActivity: recentActivity.rows
        });
    } catch (err) {
        console.error('Error fetching staff analytics:', err);
        res.status(500).json({ message: 'Server error retrieving staff analytics.' });
    }
};

// ─── Audit Logs ───
const AUDIT_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action VARCHAR(50) NOT NULL,
    resource VARCHAR(255),
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
`;

async function queryAuditLogs(page: number, limit: number, offset: number, action?: string, search?: string) {
    let whereClause = '';
    const params: any[] = [];
    let idx = 1;

    if (action) {
        whereClause += ` AND al.action = $${idx++}`;
        params.push(action);
    }
    if (search) {
        whereClause += ` AND (al.resource ILIKE $${idx} OR al.details ILIKE $${idx} OR s.email ILIKE $${idx} OR s.name ILIKE $${idx})`;
        params.push(`%${search}%`);
        idx++;
    }

    const countResult = await pool.query(
        `SELECT COUNT(*)::int as total
         FROM audit_logs al
         LEFT JOIN staff s ON al.user_id = s.id
         WHERE 1=1 ${whereClause}`,
        params
    );

    const logsResult = await pool.query(
        `SELECT al.id, al.action, al.resource, al.details, al.ip_address, al.created_at,
                al.user_id,
                COALESCE(s.name, u.name, 'System') as user_name,
                COALESCE(s.email, u.phone, '') as user_identifier,
                COALESCE(CAST(s.role AS VARCHAR), 'student') as user_role
         FROM audit_logs al
         LEFT JOIN staff s ON al.user_id = s.id
         LEFT JOIN users u ON al.user_id = u.id AND s.id IS NULL
         WHERE 1=1 ${whereClause}
         ORDER BY al.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
    );

    return { countResult, logsResult };
}

export const getAuditLogs = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const action = req.query.action as string;
    const search = req.query.search as string;

    try {
        let result;
        try {
            result = await queryAuditLogs(page, limit, offset, action, search);
        } catch (firstErr: any) {
            // Auto-create table if it doesn't exist (migration not run on this server)
            if (firstErr.code === '42P01') {  // relation does not exist
                console.warn('[AuditLogs] Table missing — auto-creating audit_logs...');
                await pool.query(AUDIT_TABLE_DDL);
                result = await queryAuditLogs(page, limit, offset, action, search);
            } else {
                throw firstErr;
            }
        }

        res.json({
            logs: result.logsResult.rows,
            total: result.countResult.rows[0].total,
            page,
            limit,
            totalPages: Math.ceil(result.countResult.rows[0].total / limit),
        });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Account Lockout Management ───

/** GET /api/superadmin/locked-accounts — list all currently locked accounts */
export const getLockedAccountsList = async (_req: Request, res: Response) => {
    try {
        const locked = await getBruteForceLocked();
        res.json({ lockedAccounts: locked });
    } catch (error) {
        console.error('Error fetching locked accounts:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/** POST /api/superadmin/unlock-account — unlock a brute-force locked account */
export const unlockAccountHandler = async (req: Request, res: Response) => {
    const { email } = req.body;
    const caller = (req as any).user;
    const ip = getRequestIp(req);

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        const wasLocked = await unlockBruteForce(email);

        if (!wasLocked) {
            return res.status(404).json({ message: 'This account is not currently locked.' });
        }

        auditLog({
            userId: caller?.id,
            action: 'ACCOUNT_UNLOCKED',
            resource: `email:${email}`,
            details: `Unlocked by super admin ${caller?.email || caller?.id}`,
            ip,
        });

        res.json({ message: `Account ${email} has been unlocked successfully.` });
    } catch (error) {
        console.error('Error unlocking account:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Per-Restaurant "Preparing" Capacity Limits ───

/** GET /api/superadmin/restaurants — list restaurants with their prep_limit */
export const getRestaurantsForLimits = async (_req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT id, name, COALESCE(prep_limit, 0) AS prep_limit, is_event_restaurant
             FROM restaurants ORDER BY name ASC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching restaurants for limits:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/** PATCH /api/superadmin/restaurants/:id/prep-limit — set how many orders may be 'preparing' at once (0 = unlimited) */
export const updateRestaurantPrepLimit = async (req: Request, res: Response) => {
    const { id } = req.params;
    const limit = Math.max(0, parseInt(req.body?.prep_limit) || 0);
    try {
        const result = await pool.query(
            'UPDATE restaurants SET prep_limit = $1 WHERE id = $2 RETURNING id, name, prep_limit',
            [limit, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'Restaurant not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating prep limit:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
