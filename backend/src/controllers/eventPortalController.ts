import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import ExcelJS from 'exceljs';
import pool from '../config/db';
import { generateToken } from '../utils/jwt';
import { sendVoucherEmail } from '../services/emailService';
import { auditLog, getRequestIp } from '../services/auditLogger';

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
            auditLog({ action: 'DEAN_LOGIN_FAILED', resource: `email:${email}`, details: 'No such dean', ip: getRequestIp(req) });
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const dean = result.rows[0];
        const valid = await bcrypt.compare(password, dean.password_hash);

        if (!valid) {
            auditLog({ userId: dean.id, action: 'DEAN_LOGIN_FAILED', resource: `dean:${dean.id}`, details: 'Wrong password', ip: getRequestIp(req) });
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

        auditLog({ userId: dean.id, action: 'DEAN_LOGIN_SUCCESS', resource: `dean:${dean.id}`, details: dean.email, ip: getRequestIp(req) });

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

    if (!staff_email) {
        return res.status(400).json({ message: 'Staff email is required' });
    }

    if (parsedAmount < 10) {
        return res.status(400).json({ message: 'Minimum coupon amount is ₹10' });
    }

    try {
        // Verify staff exists in university_staff section
        const staffResult = await pool.query(
            "SELECT id FROM users WHERE email = $1 AND user_type = 'university_staff'",
            [staff_email]
        );

        if (staffResult.rows.length === 0) {
            return res.status(404).json({ message: 'The particular staff is not registered' });
        }

        // Budget check + coupon issue must be atomic. Without locking the dean
        // row, two concurrent requests both read the same used_budget, both pass
        // the remaining-budget check, and both issue coupons → used_budget exceeds
        // total_budget (coupons are spendable wallet credit = real money leak).
        const client = await pool.connect();
        let coupon: any;
        let dean: any;
        try {
            await client.query('BEGIN');

            const deanResult = await client.query(
                'SELECT total_budget, used_budget, name, school_name FROM deans WHERE id = $1 FOR UPDATE',
                [deanId]
            );

            if (deanResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Dean not found' });
            }

            dean = deanResult.rows[0];
            const remaining = Number(dean.total_budget) - Number(dean.used_budget);

            if (parsedAmount > remaining) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Insufficient budget. Available: ₹${remaining.toFixed(2)}`,
                });
            }

            // Generate unique 10-character coupon code
            const code = `DC${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

            // 30-day expiry
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

            const result = await client.query(
                `INSERT INTO dean_coupons (dean_id, code, amount, expires_at, staff_email)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [deanId, code, parsedAmount, expiresAt, staff_email || null]
            );

            // Update used_budget on dean (under the same lock)
            await client.query(
                'UPDATE deans SET used_budget = used_budget + $1 WHERE id = $2',
                [parsedAmount, deanId]
            );

            await client.query('COMMIT');
            coupon = result.rows[0];
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }

        const code = coupon.code;
        const expiresAt = coupon.expires_at;

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

        auditLog({
            userId: deanId,
            action: 'COUPON_GENERATED',
            resource: `coupon:${coupon.code}`,
            details: `₹${parsedAmount} voucher for ${staff_email}`,
            ip: getRequestIp(req),
        });

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

        auditLog({
            userId: deanId,
            action: 'COUPON_REVOKED',
            resource: `coupon:${coupon.code}`,
            details: `₹${Number(coupon.amount)} voucher revoked`,
            ip: getRequestIp(req),
        });

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

/** Export voucher ledger as a styled, well-structured Excel workbook (.xlsx) */
export const exportFundDistributionExcel = async (req: Request, res: Response) => {
    const deanId = (req as any).user?.id;

    try {
        const deanResult = await pool.query(
            'SELECT name, school_name, total_budget, used_budget FROM deans WHERE id = $1',
            [deanId]
        );
        if (deanResult.rows.length === 0) {
            return res.status(404).json({ message: 'Dean not found' });
        }
        const dean = deanResult.rows[0];

        const result = await pool.query(
            `SELECT dc.code, dc.amount, dc.status, dc.event_name, dc.staff_email,
                    dc.created_at, dc.expires_at, dc.redeemed_at,
                    u.name as redeemed_by_name, u.phone as redeemed_by_phone
             FROM dean_coupons dc
             LEFT JOIN users u ON dc.redeemed_by = u.id
             WHERE dc.dean_id = $1
             ORDER BY dc.created_at DESC`,
            [deanId]
        );
        const coupons = result.rows;

        // ── Aggregate figures for the summary sheet ──
        const totalIssued = coupons.reduce((s: number, c: any) => s + Number(c.amount), 0);
        const redeemed = coupons.filter((c: any) => c.status === 'redeemed');
        const totalRedeemed = redeemed.reduce((s: number, c: any) => s + Number(c.amount), 0);
        const active = coupons.filter((c: any) => c.status === 'active');
        const totalActive = active.reduce((s: number, c: any) => s + Number(c.amount), 0);
        const totalBudget = Number(dean.total_budget);
        const usedBudget = Number(dean.used_budget);

        const fmtDate = (d: any) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Event Head Portal';
        workbook.created = new Date();

        const BRAND = 'FF8B1C28';      // deep red header fill
        const BRAND_LIGHT = 'FFF7E9EA'; // soft red zebra stripe
        const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 } as const;

        // ═══ Sheet 1: Summary ═══
        const summary = workbook.addWorksheet('Summary', {
            properties: { defaultRowHeight: 20 },
            views: [{ showGridLines: false }],
        });
        summary.columns = [
            { key: 'label', width: 32 },
            { key: 'value', width: 30 },
        ];

        const titleRow = summary.addRow(['Voucher Distribution Report', '']);
        summary.mergeCells(`A${titleRow.number}:B${titleRow.number}`);
        titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: BRAND } };
        titleRow.height = 28;

        const subRow = summary.addRow([`${dean.name} — ${dean.school_name}`, '']);
        summary.mergeCells(`A${subRow.number}:B${subRow.number}`);
        subRow.getCell(1).font = { italic: true, size: 11, color: { argb: 'FF6B6B6B' } };
        summary.addRow(['Generated', new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })]);
        summary.addRow([]);

        const addSection = (heading: string) => {
            const r = summary.addRow([heading, '']);
            summary.mergeCells(`A${r.number}:B${r.number}`);
            r.getCell(1).font = HEADER_FONT;
            r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
            r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
        };
        const addMetric = (label: string, value: string | number, isCurrency = false) => {
            const r = summary.addRow([label, value]);
            r.getCell(1).font = { color: { argb: 'FF444444' } };
            r.getCell(2).font = { bold: true };
            r.getCell(2).alignment = { horizontal: 'right' };
            if (isCurrency) r.getCell(2).numFmt = '₹#,##0.00';
        };

        addSection('Budget');
        addMetric('Total Budget', totalBudget, true);
        addMetric('Used Budget', usedBudget, true);
        addMetric('Remaining Budget', totalBudget - usedBudget, true);
        summary.addRow([]);

        addSection('Vouchers');
        addMetric('Total Vouchers Issued', coupons.length);
        addMetric('Total Value Issued', totalIssued, true);
        addMetric('Redeemed Vouchers', redeemed.length);
        addMetric('Value Redeemed', totalRedeemed, true);
        addMetric('Active Vouchers', active.length);
        addMetric('Value Active', totalActive, true);

        // ═══ Sheet 2: Vouchers ═══
        const sheet = workbook.addWorksheet('Vouchers', {
            views: [{ state: 'frozen', ySplit: 1 }],
        });
        sheet.columns = [
            { header: 'Code', key: 'code', width: 16 },
            { header: 'Amount', key: 'amount', width: 14 },
            { header: 'Status', key: 'status', width: 14 },
            { header: 'Event', key: 'event', width: 26 },
            { header: 'Issued To (Email)', key: 'email', width: 30 },
            { header: 'Redeemed By', key: 'redeemed_by', width: 22 },
            { header: 'Phone', key: 'phone', width: 16 },
            { header: 'Created', key: 'created', width: 22 },
            { header: 'Expires', key: 'expires', width: 22 },
            { header: 'Redeemed At', key: 'redeemed_at', width: 22 },
        ];

        // Header styling
        const headerRow = sheet.getRow(1);
        headerRow.height = 22;
        headerRow.eachCell((cell) => {
            cell.font = HEADER_FONT;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.border = { bottom: { style: 'thin', color: { argb: BRAND } } };
        });

        const statusColors: Record<string, string> = {
            redeemed: 'FF2E7D32',
            active: 'FF1565C0',
            expired: 'FF9E9E9E',
            revoked: 'FFB71C1C',
        };

        coupons.forEach((c: any, idx: number) => {
            const row = sheet.addRow({
                code: c.code,
                amount: Number(c.amount),
                status: String(c.status || '').toUpperCase(),
                event: c.event_name || '—',
                email: c.staff_email || '—',
                redeemed_by: c.redeemed_by_name || '—',
                phone: c.redeemed_by_phone || '—',
                created: fmtDate(c.created_at),
                expires: fmtDate(c.expires_at),
                redeemed_at: fmtDate(c.redeemed_at),
            });
            row.getCell('amount').numFmt = '₹#,##0.00';
            row.getCell('code').font = { bold: true, name: 'Consolas' };
            const statusCell = row.getCell('status');
            statusCell.font = { bold: true, color: { argb: statusColors[c.status] || 'FF444444' } };
            // Zebra striping
            if (idx % 2 === 1) {
                row.eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_LIGHT } };
                });
            }
        });

        // Total row
        if (coupons.length > 0) {
            const totalRow = sheet.addRow({ code: 'TOTAL', amount: totalIssued });
            totalRow.getCell('code').font = { bold: true };
            totalRow.getCell('amount').numFmt = '₹#,##0.00';
            totalRow.getCell('amount').font = { bold: true };
            totalRow.eachCell((cell) => {
                cell.border = { top: { style: 'double', color: { argb: BRAND } } };
            });
        }

        sheet.autoFilter = { from: 'A1', to: 'J1' };

        const fileName = `voucher_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error: any) {
        console.error('[DeanPortal] exportExcel error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Get representatives assigned to this dean with voucher analytics */
export const getRepresentatives = async (req: Request, res: Response) => {
    const deanId = (req as any).user?.id;

    try {
        // Get all reps assigned to this dean
        const repsResult = await pool.query(
            `SELECT u.id, u.name, u.phone, u.email, u.created_at
             FROM users u
             WHERE u.dean_id = $1 AND u.user_type = 'university_staff'
             ORDER BY u.name ASC`,
            [deanId]
        );

        if (repsResult.rows.length === 0) {
            return res.json({ representatives: [] });
        }

        const repIds = repsResult.rows.map((r: any) => r.id);

        // Get voucher stats per representative (coupons redeemed BY each rep)
        const voucherStats = await pool.query(
            `SELECT dc.redeemed_by,
                    COUNT(*)::int as voucher_count,
                    COALESCE(SUM(dc.amount), 0) as total_amount,
                    MAX(dc.redeemed_at) as last_redeemed_at,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'code', dc.code,
                                'amount', dc.amount,
                                'event_name', dc.event_name,
                                'redeemed_at', dc.redeemed_at,
                                'status', dc.status
                            ) ORDER BY dc.redeemed_at DESC
                        ) FILTER (WHERE dc.redeemed_by IS NOT NULL), '[]'
                    ) as vouchers
             FROM dean_coupons dc
             WHERE dc.dean_id = $1 AND dc.redeemed_by = ANY($2) AND dc.status = 'redeemed'
             GROUP BY dc.redeemed_by`,
            [deanId, repIds]
        );

        // Also get vouchers issued TO each rep by email
        const issuedStats = await pool.query(
            `SELECT dc.staff_email,
                    COUNT(*)::int as issued_count,
                    COALESCE(SUM(dc.amount), 0) as issued_amount,
                    COUNT(*) FILTER (WHERE dc.status = 'active')::int as active_count,
                    COUNT(*) FILTER (WHERE dc.status = 'redeemed')::int as redeemed_count,
                    COUNT(*) FILTER (WHERE dc.status = 'revoked')::int as revoked_count
             FROM dean_coupons dc
             WHERE dc.dean_id = $1 AND dc.staff_email = ANY(
                 SELECT email FROM users WHERE id = ANY($2) AND email IS NOT NULL
             )
             GROUP BY dc.staff_email`,
            [deanId, repIds]
        );

        // Build lookup maps
        const voucherMap: Record<string, any> = {};
        for (const row of voucherStats.rows) {
            voucherMap[row.redeemed_by] = {
                voucher_count: row.voucher_count,
                total_amount: Number(row.total_amount),
                last_redeemed_at: row.last_redeemed_at,
                vouchers: row.vouchers,
            };
        }

        const issuedMap: Record<string, any> = {};
        for (const row of issuedStats.rows) {
            issuedMap[row.staff_email] = {
                issued_count: row.issued_count,
                issued_amount: Number(row.issued_amount),
                active_count: row.active_count,
                redeemed_count: row.redeemed_count,
                revoked_count: row.revoked_count,
            };
        }

        // Merge data
        const representatives = repsResult.rows.map((rep: any) => {
            const redeemed = voucherMap[rep.id] || { voucher_count: 0, total_amount: 0, last_redeemed_at: null, vouchers: [] };
            const issued = issuedMap[rep.email] || { issued_count: 0, issued_amount: 0, active_count: 0, redeemed_count: 0, revoked_count: 0 };

            return {
                id: rep.id,
                name: rep.name,
                phone: rep.phone,
                email: rep.email,
                created_at: rep.created_at,
                // Vouchers redeemed by this rep
                redeemed_count: redeemed.voucher_count,
                redeemed_amount: redeemed.total_amount,
                last_redeemed_at: redeemed.last_redeemed_at,
                recent_vouchers: redeemed.vouchers.slice(0, 5),
                // Vouchers issued to this rep
                issued_count: issued.issued_count,
                issued_amount: issued.issued_amount,
                active_vouchers: issued.active_count,
                revoked_vouchers: issued.revoked_count,
            };
        });

        // Aggregated totals
        const totals = {
            total_reps: representatives.length,
            total_redeemed: representatives.reduce((s: number, r: any) => s + r.redeemed_amount, 0),
            total_issued: representatives.reduce((s: number, r: any) => s + r.issued_amount, 0),
            total_vouchers_redeemed: representatives.reduce((s: number, r: any) => s + r.redeemed_count, 0),
        };

        res.json({ representatives, totals });
    } catch (error: any) {
        console.error('[DeanPortal] getRepresentatives error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};
