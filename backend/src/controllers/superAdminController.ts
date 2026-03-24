import { Request, Response } from 'express';
import pool from '../config/db';

export const getAllUniversitiesWithStats = async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.id, 
                u.name, 
                u.logo_url, 
                u.address, 
                u.created_at,
                COUNT(DISTINCT o.id)::int as total_orders,
                COALESCE(SUM(o.total_amount), 0)::numeric as total_revenue
            FROM universities u
            LEFT JOIN orders o ON u.id = o.university_id AND o.status IN ('preparing', 'ready', 'completed')
            GROUP BY u.id
            ORDER BY u.name ASC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching universities with stats:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getUniversityDetailedStats = async (req: Request, res: Response) => {
    const { id: uniId } = req.params;

    try {
        // Verify university exists
        const uniCheck = await pool.query('SELECT id FROM universities WHERE id = $1', [uniId]);
        if (uniCheck.rows.length === 0) {
            return res.status(404).json({ message: 'University not found' });
        }

        // 1. Order counts by status
        const orderStatusResult = await pool.query(
            `SELECT status, COUNT(*)::int as count
             FROM orders WHERE university_id = $1
             GROUP BY status`,
            [uniId]
        );
        const ordersByStatus: Record<string, number> = {};
        orderStatusResult.rows.forEach((r: any) => { ordersByStatus[r.status] = r.count; });

        // 2. Total revenue
        const revenueResult = await pool.query(
            `SELECT COALESCE(SUM(total_amount), 0)::numeric as total_revenue
             FROM orders WHERE university_id = $1 AND status IN ('preparing', 'ready', 'completed')`,
            [uniId]
        );
        const totalRevenue = parseFloat(revenueResult.rows[0].total_revenue);

        // 3. Monthly revenue (last 6 months)
        const monthlyResult = await pool.query(
            `SELECT TO_CHAR(created_at, 'Mon YYYY') as month,
                    TO_CHAR(created_at, 'YYYY-MM') as sort_key,
                    SUM(total_amount)::numeric as revenue,
                    COUNT(*)::int as orders
             FROM orders
             WHERE university_id = $1
               AND status IN ('preparing', 'ready', 'completed')
               AND created_at >= NOW() - INTERVAL '6 months'
             GROUP BY month, sort_key
             ORDER BY sort_key`,
            [uniId]
        );

        // 4. Top 5 best-selling items
        const bestSellersResult = await pool.query(
            `SELECT m.name, m.image_url, m.price,
                    SUM(oi.quantity)::int as total_sold,
                    SUM(oi.quantity * oi.price_at_time)::numeric as total_revenue
             FROM order_items oi
             JOIN menu_items m ON oi.menu_item_id = m.id
             JOIN orders o ON oi.order_id = o.id
             WHERE o.university_id = $1 AND o.status IN ('preparing', 'ready', 'completed')
             GROUP BY m.id, m.name, m.image_url, m.price
             ORDER BY total_sold DESC
             LIMIT 5`,
            [uniId]
        );

        // 5. Average order value
        const avgResult = await pool.query(
            `SELECT COALESCE(AVG(total_amount), 0)::numeric as avg_order_value
             FROM orders WHERE university_id = $1 AND status IN ('preparing', 'ready', 'completed')`,
            [uniId]
        );
        const avgOrderValue = parseFloat(parseFloat(avgResult.rows[0].avg_order_value).toFixed(2));

        // 6. Today's stats
        const todayResult = await pool.query(
            `SELECT COUNT(*)::int as orders_today,
                    COALESCE(SUM(total_amount), 0)::numeric as revenue_today
             FROM orders
             WHERE university_id = $1
               AND created_at >= CURRENT_DATE
               AND status IN ('preparing', 'ready', 'completed')`,
            [uniId]
        );

        // 7. Total customers
        const customersResult = await pool.query(
            `SELECT COUNT(DISTINCT user_id)::int as total_customers
             FROM orders WHERE university_id = $1`,
            [uniId]
        );

        res.json({
            orders_by_status: ordersByStatus,
            total_revenue: totalRevenue,
            monthly_revenue: monthlyResult.rows.map((r: any) => ({
                month: r.month,
                revenue: parseFloat(r.revenue),
                orders: r.orders,
            })),
            best_sellers: bestSellersResult.rows.map((r: any) => ({
                name: r.name,
                image_url: r.image_url,
                price: parseFloat(r.price),
                total_sold: r.total_sold,
                total_revenue: parseFloat(r.total_revenue),
            })),
            avg_order_value: avgOrderValue,
            orders_today: todayResult.rows[0].orders_today,
            revenue_today: parseFloat(todayResult.rows[0].revenue_today),
            total_customers: customersResult.rows[0].total_customers,
        });
    } catch (error) {
        console.error('Error fetching university detailed stats:', error);
        res.status(500).json({ message: 'Server error' });
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
                COALESCE(s.role, 'student') as user_role
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
