import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '../config/db';
import { generateToken } from '../utils/jwt';
import { sendVoucherEmail } from '../services/emailService';

// ═══════════════════════════════════════════════════════════════
// Dean Portal Controller — Standalone dean-facing endpoints
// ═══════════════════════════════════════════════════════════════

function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/** Dean login with email + password → JWT */
export const deanLogin = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const result = await pool.query(
            `SELECT d.*, u.name as university_name
             FROM deans d
             LEFT JOIN universities u ON d.university_id = u.id
             WHERE d.email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const dean = result.rows[0];
        const valid = await bcrypt.compare(password, dean.password_hash);

        if (!valid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = generateToken({
            id: dean.id,
            email: dean.email,
            role: 'dean',
        });

        // Save active token hash for single-device enforcement
        const tokenHash = hashToken(token);
        await pool.query('UPDATE deans SET active_token = $1 WHERE id = $2', [tokenHash, dean.id]);

        res.json({
            token,
            dean: {
                id: dean.id,
                name: dean.name,
                email: dean.email,
                school_name: dean.school_name,
                university_name: dean.university_name,
                total_budget: Number(dean.total_budget),
                used_budget: Number(dean.used_budget),
                remaining_budget: Number(dean.total_budget) - Number(dean.used_budget),
            },
        });
    } catch (error: any) {
        console.error('[DeanPortal] login error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Get dean profile with budget info */
export const getDeanProfile = async (req: Request, res: Response) => {
    const deanId = (req as any).user?.id;

    try {
        const result = await pool.query(
            `SELECT d.id, d.name, d.email, d.school_name, d.total_budget, d.used_budget, d.created_at,
                    u.name as university_name,
                    (SELECT COUNT(*) FROM dean_coupons dc WHERE dc.dean_id = d.id) as total_coupons,
                    (SELECT COUNT(*) FROM dean_coupons dc WHERE dc.dean_id = d.id AND dc.status = 'active') as active_coupons,
                    (SELECT COUNT(*) FROM dean_coupons dc WHERE dc.dean_id = d.id AND dc.status = 'redeemed') as redeemed_coupons
             FROM deans d
             LEFT JOIN universities u ON d.university_id = u.id
             WHERE d.id = $1`,
            [deanId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Dean not found' });
        }

        const d = result.rows[0];
        res.json({
            ...d,
            total_budget: Number(d.total_budget),
            used_budget: Number(d.used_budget),
            remaining_budget: Number(d.total_budget) - Number(d.used_budget),
        });
    } catch (error: any) {
        console.error('[DeanPortal] getDeanProfile error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Generate a coupon code for budget distribution */
export const generateCoupon = async (req: Request, res: Response) => {
    const deanId = (req as any).user?.id;
    const { amount, staff_email } = req.body;
    const parsedAmount = Number(amount);

    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: 'Valid positive amount is required' });
    }

    if (parsedAmount < 10) {
        return res.status(400).json({ message: 'Minimum coupon amount is ₹10' });
    }

    try {
        // Check remaining budget
        const deanResult = await pool.query(
            'SELECT total_budget, used_budget, name, school_name FROM deans WHERE id = $1',
            [deanId]
        );

        if (deanResult.rows.length === 0) {
            return res.status(404).json({ message: 'Dean not found' });
        }

        const dean = deanResult.rows[0];
        const remaining = Number(dean.total_budget) - Number(dean.used_budget);

        if (parsedAmount > remaining) {
            return res.status(400).json({
                message: `Insufficient budget. Available: ₹${remaining.toFixed(2)}`,
            });
        }

        // Generate unique 10-character coupon code
        const code = `DC${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        // 30-day expiry
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        const result = await pool.query(
            `INSERT INTO dean_coupons (dean_id, code, amount, expires_at, staff_email)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [deanId, code, parsedAmount, expiresAt, staff_email || null]
        );

        // Update used_budget on dean
        await pool.query(
            'UPDATE deans SET used_budget = used_budget + $1 WHERE id = $2',
            [parsedAmount, deanId]
        );

        const coupon = result.rows[0];

        // Send voucher email to staff (non-blocking)
        if (staff_email) {
            sendVoucherEmail({
                to: staff_email,
                code,
                amount: parsedAmount,
                deanName: dean.name,
                schoolName: dean.school_name,
                expiresAt,
            }).catch((err: any) => console.warn('[DeanPortal] Voucher email failed:', err.message));
        }

        res.status(201).json({
            coupon: {
                ...coupon,
                amount: Number(coupon.amount),
            },
            used_budget: String(Number(dean.used_budget) + parsedAmount)
        });
    } catch (error: any) {
        console.error('[DeanPortal] generateCoupon error:', error.message);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Coupon code collision. Please try again.' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

/** List all coupons for this dean */
export const getDeanCoupons = async (req: Request, res: Response) => {
    const deanId = (req as any).user?.id;

    try {
        const result = await pool.query(
            `SELECT dc.*, u.name as redeemed_by_name, u.phone as redeemed_by_phone
             FROM dean_coupons dc
             LEFT JOIN users u ON dc.redeemed_by = u.id
             WHERE dc.dean_id = $1
             ORDER BY dc.created_at DESC`,
            [deanId]
        );

        res.json(result.rows.map((c: any) => ({
            ...c,
            amount: Number(c.amount),
        })));
    } catch (error: any) {
        console.error('[DeanPortal] getDeanCoupons error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Revoke an active coupon */
export const revokeCoupon = async (req: Request, res: Response) => {
    const deanId = (req as any).user?.id;
    const { id } = req.params;

    try {
        const result = await pool.query(
            `UPDATE dean_coupons SET status = 'revoked'
             WHERE id = $1 AND dean_id = $2 AND status = 'active'
             RETURNING *`,
            [id, deanId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Coupon not found or already used/revoked' });
        }

        // Return the used_budget since coupon was revoked
        const coupon = result.rows[0];
        await pool.query(
            'UPDATE deans SET used_budget = used_budget - $1 WHERE id = $2',
            [Number(coupon.amount), deanId]
        );

        res.json({ message: 'Coupon revoked', coupon: { ...coupon, amount: Number(coupon.amount) } });
    } catch (error: any) {
        console.error('[DeanPortal] revokeCoupon error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Get fund distribution breakdown */
export const getFundDistribution = async (req: Request, res: Response) => {
    const deanId = (req as any).user?.id;

    try {
        const deanResult = await pool.query(
            'SELECT id, name, total_budget, used_budget FROM deans WHERE id = $1',
            [deanId]
        );

        if (deanResult.rows.length === 0) {
            return res.status(404).json({ message: 'Dean not found' });
        }

        const coupons = await pool.query(
            `SELECT dc.code, dc.amount, dc.status, dc.created_at, dc.expires_at, dc.redeemed_at, dc.event_name, dc.staff_email,
                    u.name as redeemed_by_name, u.phone as redeemed_by_phone, u.user_type as redeemed_by_role
             FROM dean_coupons dc
             LEFT JOIN users u ON dc.redeemed_by = u.id
             WHERE dc.dean_id = $1
             ORDER BY dc.created_at DESC`,
            [deanId]
        );

        // Summary stats
        const allCoupons = coupons.rows;
        const totalIssued = allCoupons.reduce((s: number, c: any) => s + Number(c.amount), 0);
        const redeemed = allCoupons.filter((c: any) => c.status === 'redeemed');
        const totalRedeemed = redeemed.reduce((s: number, c: any) => s + Number(c.amount), 0);
        const active = allCoupons.filter((c: any) => c.status === 'active');
        const totalActive = active.reduce((s: number, c: any) => s + Number(c.amount), 0);

        // Per-user demographic breakdown
        const userMap: Record<string, { name: string; phone: string; role: string; count: number; totalAmount: number; events: string[] }> = {};
        redeemed.forEach((c: any) => {
            const key = c.redeemed_by_phone || c.redeemed_by_name || 'unknown';
            if (!userMap[key]) {
                userMap[key] = {
                    name: c.redeemed_by_name || 'Unknown',
                    phone: c.redeemed_by_phone || '-',
                    role: c.redeemed_by_role || 'unknown',
                    count: 0,
                    totalAmount: 0,
                    events: [],
                };
            }
            userMap[key].count += 1;
            userMap[key].totalAmount += Number(c.amount);
            if (c.event_name) userMap[key].events.push(c.event_name);
        });

        const distributionsArray = Object.values(userMap).sort((a, b) => b.totalAmount - a.totalAmount);

        // Role-level aggregation
        const roleMap: Record<string, { count: number; totalAmount: number }> = {};
        redeemed.forEach((c: any) => {
            const role = c.redeemed_by_role || 'unknown';
            if (!roleMap[role]) roleMap[role] = { count: 0, totalAmount: 0 };
            roleMap[role].count += 1;
            roleMap[role].totalAmount += Number(c.amount);
        });
        const roleSummary = Object.entries(roleMap).map(([role, data]) => ({
            role, count: data.count, totalAmount: data.totalAmount
        }));

        const d = deanResult.rows[0];
        res.json({
            budget: {
                total: Number(d.total_budget),
                used: Number(d.used_budget),
                remaining: Number(d.total_budget) - Number(d.used_budget),
            },
            summary: {
                total_coupons: allCoupons.length,
                total_issued_amount: totalIssued,
                total_redeemed_amount: totalRedeemed,
                total_active_amount: totalActive,
                redeemed_count: redeemed.length,
                active_count: active.length,
            },
            coupons: allCoupons.map((c: any) => ({
                ...c,
                amount: Number(c.amount),
            })),
            distributions: distributionsArray,
            roleSummary,
        });
    } catch (error: any) {
        console.error('[DeanPortal] getFundDistribution error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Export fund distribution CSV */
export const exportFundDistributionCSV = async (req: Request, res: Response) => {
    const deanId = (req as any).user?.id;

    try {
        const result = await pool.query(
            `SELECT dc.code, dc.amount, dc.status, dc.created_at, dc.expires_at, dc.redeemed_at,
                    u.name as redeemed_by_name, u.phone as redeemed_by_phone
             FROM dean_coupons dc
             LEFT JOIN users u ON dc.redeemed_by = u.id
             WHERE dc.dean_id = $1
             ORDER BY dc.created_at DESC`,
            [deanId]
        );

        const headers = ['Code', 'Amount (₹)', 'Status', 'Created', 'Expires', 'Redeemed At', 'Redeemed By', 'Phone'];
        const rows = result.rows.map((r: any) => [
            r.code, Number(r.amount).toFixed(2), r.status,
            new Date(r.created_at).toLocaleString('en-IN'),
            new Date(r.expires_at).toLocaleString('en-IN'),
            r.redeemed_at ? new Date(r.redeemed_at).toLocaleString('en-IN') : 'N/A',
            r.redeemed_by_name || 'N/A', r.redeemed_by_phone || 'N/A',
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

        const csv = [headers.join(','), ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="fund_distribution.csv"');
        res.send(csv);
    } catch (error: any) {
        console.error('[DeanPortal] exportCSV error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};
