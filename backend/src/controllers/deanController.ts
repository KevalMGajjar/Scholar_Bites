import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '../config/db';
import exceljs from 'exceljs';
import { AHMEDABAD_UNIVERSITY_ID } from '../config/constants';

// ═══════════════════════════════════════════════════════════════
// Dean Management — Admin Panel Endpoints
// ═══════════════════════════════════════════════════════════════

/** Create a new dean */
export const createDean = async (req: AuthRequest, res: Response) => {
    const { name, email, school_name, password } = req.body;

    if (!name || !email || !school_name || !password) {
        return res.status(400).json({ message: 'Name, email, school name, and password are required' });
    }

    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    try {
        const existing = await pool.query('SELECT id FROM deans WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ message: 'A dean with this email already exists' });
        }

        const password_hash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO deans (university_id, name, email, password_hash, school_name)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, university_id, name, email, school_name, total_budget, used_budget, created_at`,
            [AHMEDABAD_UNIVERSITY_ID, name, email, password_hash, school_name]
        );

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error('[Dean] createDean error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** List all deans */
export const getAllDeans = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT d.id, d.name, d.email, d.school_name, d.total_budget, d.used_budget, d.created_at,
                    (SELECT COUNT(*) FROM dean_coupons dc WHERE dc.dean_id = d.id) as total_coupons,
                    (SELECT COUNT(*) FROM dean_coupons dc WHERE dc.dean_id = d.id AND dc.status = 'redeemed') as redeemed_coupons
             FROM deans d
             WHERE d.university_id = $1
             ORDER BY d.created_at DESC`,
            [AHMEDABAD_UNIVERSITY_ID]
        );

        res.json(result.rows.map((r: any) => ({
            ...r,
            total_budget: Number(r.total_budget),
            used_budget: Number(r.used_budget),
            remaining_budget: Number(r.total_budget) - Number(r.used_budget),
        })));
    } catch (error: any) {
        console.error('[Dean] getAllDeans error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Update dean budget */
export const updateDeanBudget = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { amount } = req.body;
    const parsedAmount = Number(amount);

    if (amount === undefined || isNaN(parsedAmount)) {
        return res.status(400).json({ message: 'Valid numeric amount is required' });
    }

    try {
        const result = await pool.query(
            `UPDATE deans SET total_budget = total_budget + $1 WHERE id = $2
             RETURNING id, name, email, school_name, total_budget, used_budget`,
            [parsedAmount, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Dean not found' });
        }

        const dean = result.rows[0];
        res.json({
            ...dean,
            total_budget: Number(dean.total_budget),
            used_budget: Number(dean.used_budget),
            remaining_budget: Number(dean.total_budget) - Number(dean.used_budget),
        });
    } catch (error: any) {
        console.error('[Dean] updateDeanBudget error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Update dean details (name, email, school_name) */
export const updateDeanDetails = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, email, school_name } = req.body;

    if (!name && !email && !school_name) {
        return res.status(400).json({ message: 'At least one field (name, email, school_name) is required' });
    }

    try {
        // If email is being updated, check for duplicates
        if (email) {
            const existing = await pool.query('SELECT id FROM deans WHERE email = $1 AND id != $2', [email, id]);
            if (existing.rows.length > 0) {
                return res.status(409).json({ message: 'A dean with this email already exists' });
            }
        }

        const fields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (name) { fields.push(`name = $${paramIndex++}`); values.push(name); }
        if (email) { fields.push(`email = $${paramIndex++}`); values.push(email); }
        if (school_name) { fields.push(`school_name = $${paramIndex++}`); values.push(school_name); }

        values.push(id);

        const result = await pool.query(
            `UPDATE deans SET ${fields.join(', ')} WHERE id = $${paramIndex}
             RETURNING id, name, email, school_name, total_budget, used_budget, created_at`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Dean not found' });
        }

        const dean = result.rows[0];
        res.json({
            ...dean,
            total_budget: Number(dean.total_budget),
            used_budget: Number(dean.used_budget),
            remaining_budget: Number(dean.total_budget) - Number(dean.used_budget),
        });
    } catch (error: any) {
        console.error('[Dean] updateDeanDetails error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Delete a dean */
export const deleteDean = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        // Check for active coupons
        const activeCoupons = await pool.query(
            "SELECT COUNT(*) FROM dean_coupons WHERE dean_id = $1 AND status = 'active'",
            [id]
        );

        if (parseInt(activeCoupons.rows[0].count) > 0) {
            return res.status(400).json({ message: 'Cannot delete dean with active coupons. Revoke them first.' });
        }

        // Delete associated coupons first (CASCADE)
        await pool.query('DELETE FROM dean_coupons WHERE dean_id = $1', [id]);
        const result = await pool.query('DELETE FROM deans WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Dean not found' });
        }

        res.json({ message: 'Dean deleted successfully' });
    } catch (error: any) {
        console.error('[Dean] deleteDean error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// ═══════════════════════════════════════════════════════════════
// Events Calendar/List — Admin Panel Endpoints
// ═══════════════════════════════════════════════════════════════

/** Get all event pre-orders with optional filters */
export const getAllEvents = async (req: AuthRequest, res: Response) => {
    const { status, month, year } = req.query;

    try {
        let query = `
            SELECT e.*, u.name as creator_name, u.phone as creator_phone,
                   COALESCE(json_agg(
                       json_build_object(
                           'id', ei.id,
                           'menu_item_id', ei.menu_item_id,
                           'quantity', ei.quantity,
                           'price_at_time', ei.price_at_time,
                           'item_name', mi.name,
                           'item_image', mi.image_url
                       )
                   ) FILTER (WHERE ei.id IS NOT NULL), '[]') as items
            FROM event_pre_orders e
            LEFT JOIN users u ON e.user_id = u.id
            LEFT JOIN event_pre_order_items ei ON ei.event_order_id = e.id
            LEFT JOIN menu_items mi ON ei.menu_item_id = mi.id
            WHERE e.university_id = $1
        `;
        const params: any[] = [AHMEDABAD_UNIVERSITY_ID];

        if (status && status !== 'all') {
            params.push(status);
            query += ` AND e.status = $${params.length}::\"EventStatus\"`;
        }

        if (month && year) {
            params.push(Number(month), Number(year));
            query += ` AND EXTRACT(MONTH FROM e.event_date) = $${params.length - 1}
                        AND EXTRACT(YEAR FROM e.event_date) = $${params.length}`;
        }

        query += ` GROUP BY e.id, u.name, u.phone ORDER BY e.event_date DESC`;

        const result = await pool.query(query, params);

        res.json(result.rows.map((r: any) => ({
            ...r,
            total_amount: Number(r.total_amount),
        })));
    } catch (error: any) {
        console.error('[Events] getAllEvents error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Get events for calendar view (grouped by date) */
export const getEventsCalendar = async (req: AuthRequest, res: Response) => {
    const { month, year } = req.query;

    const m = Number(month) || new Date().getMonth() + 1;
    const y = Number(year) || new Date().getFullYear();

    try {
        const result = await pool.query(
            `SELECT id, event_name, event_date, event_time, member_count, status, total_amount, staff_name
             FROM event_pre_orders
             WHERE university_id = $1
               AND EXTRACT(MONTH FROM event_date) = $2
               AND EXTRACT(YEAR FROM event_date) = $3
             ORDER BY event_date ASC, event_time ASC`,
            [AHMEDABAD_UNIVERSITY_ID, m, y]
        );

        // Group by date
        const calendar: Record<string, any[]> = {};
        for (const event of result.rows) {
            const dateKey = new Date(event.event_date).toISOString().split('T')[0];
            if (!calendar[dateKey]) calendar[dateKey] = [];
            calendar[dateKey].push({
                ...event,
                total_amount: Number(event.total_amount),
            });
        }

        res.json({ month: m, year: y, events: calendar });
    } catch (error: any) {
        console.error('[Events] getEventsCalendar error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Export events as nicely formatted Excel */
export const exportEventsExcel = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT e.event_name, e.event_date, e.event_time, e.member_count,
                    e.staff_name, e.staff_email, e.status, e.total_amount, e.created_at,
                    u.name as created_by
             FROM event_pre_orders e
             LEFT JOIN users u ON e.user_id = u.id
             WHERE e.university_id = $1
             ORDER BY e.event_date DESC`,
            [AHMEDABAD_UNIVERSITY_ID]
        );

        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('Events List');

        worksheet.columns = [
            { header: 'Event Name', key: 'event_name', width: 30 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Time', key: 'time', width: 12 },
            { header: 'Members', key: 'members', width: 12 },
            { header: 'Staff Name', key: 'staff_name', width: 20 },
            { header: 'Staff Email', key: 'staff_email', width: 25 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Total Amount (₹)', key: 'amount', width: 18 },
            { header: 'Created By', key: 'created_by', width: 20 },
            { header: 'Created At', key: 'created_at', width: 20 },
        ];

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B1C28' } }; 
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        result.rows.forEach((r: any) => {
            worksheet.addRow({
                event_name: r.event_name,
                date: new Date(r.event_date).toLocaleDateString('en-IN'),
                time: r.event_time,
                members: r.member_count,
                staff_name: r.staff_name,
                staff_email: r.staff_email,
                status: String(r.status).toUpperCase(),
                amount: Number(r.total_amount),
                created_by: r.created_by,
                created_at: new Date(r.created_at).toLocaleString('en-IN')
            });
        });

        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell, colNumber) => {
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                if (rowNumber > 1 && colNumber === 8) {
                    cell.numFmt = '₹#,##0.00'; 
                }
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="events_export.xlsx"');
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error: any) {
        console.error('[Events] exportEventsExcel error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};
/** Get fund distribution for a specific dean */
export const getDeanFundDistribution = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const dean = await pool.query(
            'SELECT id, name, email, school_name, total_budget, used_budget FROM deans WHERE id = $1',
            [id]
        );

        if (dean.rows.length === 0) {
            return res.status(404).json({ message: 'Dean not found' });
        }

        const coupons = await pool.query(
            `SELECT dc.*, u.name as redeemed_by_name, u.phone as redeemed_by_phone
             FROM dean_coupons dc
             LEFT JOIN users u ON dc.redeemed_by = u.id
             WHERE dc.dean_id = $1
             ORDER BY dc.created_at DESC`,
            [id]
        );

        const d = dean.rows[0];
        res.json({
            dean: {
                ...d,
                total_budget: Number(d.total_budget),
                used_budget: Number(d.used_budget),
                remaining_budget: Number(d.total_budget) - Number(d.used_budget),
            },
            coupons: coupons.rows.map((c: any) => ({
                ...c,
                amount: Number(c.amount),
            })),
        });
    } catch (error: any) {
        console.error('[Dean] getDeanFundDistribution error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Export fund distribution as CSV */
export const exportFundDistributionCSV = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `SELECT dc.code, dc.amount, dc.status, dc.created_at, dc.expires_at, dc.redeemed_at,
                    u.name as redeemed_by_name, u.phone as redeemed_by_phone,
                    d.name as dean_name, d.school_name
             FROM dean_coupons dc
             LEFT JOIN users u ON dc.redeemed_by = u.id
             JOIN deans d ON dc.dean_id = d.id
             WHERE dc.dean_id = $1
             ORDER BY dc.created_at DESC`,
            [id]
        );

        const headers = ['Code', 'Amount', 'Status', 'Created At', 'Expires At', 'Redeemed At', 'Redeemed By', 'Phone', 'Dean', 'School'];
        const rows = result.rows.map((r: any) => [
            r.code, Number(r.amount).toFixed(2), r.status,
            new Date(r.created_at).toLocaleString('en-IN'),
            new Date(r.expires_at).toLocaleString('en-IN'),
            r.redeemed_at ? new Date(r.redeemed_at).toLocaleString('en-IN') : 'N/A',
            r.redeemed_by_name || 'N/A', r.redeemed_by_phone || 'N/A',
            r.dean_name, r.school_name,
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

        const csv = [headers.join(','), ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="fund_distribution_${id}.csv"`);
        res.send(csv);
    } catch (error: any) {
        console.error('[Dean] exportFundDistributionCSV error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Export Overall Funds Ledger as formatted Excel */
export const exportFundsLedgerExcel = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT name as dean_name, school_name, email, total_budget, used_budget, (total_budget - used_budget) as remaining_budget 
             FROM deans
             ORDER BY name ASC`
        );

        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('Dean Fund Distribution Ledger');

        worksheet.columns = [
            { header: 'Dean Name', key: 'dean_name', width: 25 },
            { header: 'School Name', key: 'school_name', width: 30 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Total Budget (₹)', key: 'total_budget', width: 18 },
            { header: 'Used Budget (₹)', key: 'used_budget', width: 18 },
            { header: 'Remaining Budget (₹)', key: 'remaining_budget', width: 22 },
        ];

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B1C28' } }; 
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        result.rows.forEach((row: any) => {
            worksheet.addRow({
                dean_name: row.dean_name,
                school_name: row.school_name,
                email: row.email,
                total_budget: Number(row.total_budget || 0),
                used_budget: Number(row.used_budget || 0),
                remaining_budget: Number(row.remaining_budget || 0),
            });
        });

        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell, colNumber) => {
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                if (rowNumber > 1 && colNumber >= 4) {
                    cell.numFmt = '₹#,##0.00'; 
                }
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="fund_distribution_ledger.xlsx"');
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error: any) {
        console.error('[Dean] exportFundsLedgerExcel error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};
