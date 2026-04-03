import { Request, Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middlewares/authMiddleware';

export const getStatistics = async (req: AuthRequest, res: Response) => {
    try {
        const staffResult = await pool.query('SELECT university_id, restaurant_id, role FROM staff WHERE id = $1', [req.user.id]);
        if (staffResult.rows.length === 0) return res.sendStatus(403);
        const uniId = staffResult.rows[0].university_id;
        const staffRole = staffResult.rows[0].role;
        const staffRestaurantId = staffResult.rows[0].restaurant_id;

        // Determine restaurant filter:
        // - Staff role: ALWAYS locked to their restaurant (ignore query param)
        // - Admin role: use query param if provided, otherwise show all
        let restaurantId: string | null = null;
        if (staffRole === 'staff') {
            if (!staffRestaurantId) return res.status(403).json({ message: 'Staff member not assigned to a restaurant' });
            restaurantId = staffRestaurantId;
        } else if (req.query.restaurant_id) {
            restaurantId = req.query.restaurant_id as string;
        }

        // Helper: build WHERE clause with optional restaurant filter
        const baseParams: any[] = [uniId];
        let pIdx = 2;
        let restaurantClause = '';
        if (restaurantId) {
            restaurantClause = ` AND o.restaurant_id = $${pIdx}`;
            baseParams.push(restaurantId);
            pIdx++;
        }

        // For non-aliased queries (where table isn't aliased as 'o')
        let restaurantClauseDirect = '';
        if (restaurantId) {
            restaurantClauseDirect = ` AND restaurant_id = $2`;
        }

        // 1. Order counts by status
        const orderStatusResult = await pool.query(
            `SELECT status, COUNT(*)::int as count
             FROM orders WHERE university_id = $1${restaurantClauseDirect}
             GROUP BY status`,
            restaurantId ? [uniId, restaurantId] : [uniId]
        );
        const ordersByStatus: Record<string, number> = {};
        orderStatusResult.rows.forEach((r: any) => { ordersByStatus[r.status] = r.count; });

        // 2. Total revenue
        const revenueResult = await pool.query(
            `SELECT COALESCE(SUM(total_amount), 0)::numeric as total_revenue
             FROM orders WHERE university_id = $1 AND status IN ('preparing', 'ready', 'completed')${restaurantClauseDirect}`,
            restaurantId ? [uniId, restaurantId] : [uniId]
        );
        const totalRevenue = parseFloat(revenueResult.rows[0].total_revenue);

        // 3. Monthly revenue (last 6 months)
        const monthlyParams: any[] = [uniId];
        let monthlyRestaurantClause = '';
        if (restaurantId) {
            monthlyRestaurantClause = ` AND university_id IS NOT NULL AND restaurant_id = $2`;
            monthlyParams.push(restaurantId);
        }
        const monthlyResult = await pool.query(
            `SELECT TO_CHAR(created_at, 'Mon YYYY') as month,
                    TO_CHAR(created_at, 'YYYY-MM') as sort_key,
                    SUM(total_amount)::numeric as revenue,
                    COUNT(*)::int as orders
             FROM orders
             WHERE university_id = $1
               AND status IN ('preparing', 'ready', 'completed')
               AND created_at >= NOW() - INTERVAL '6 months'${monthlyRestaurantClause}
             GROUP BY month, sort_key
             ORDER BY sort_key`,
            monthlyParams
        );

        // 4. Top 5 best-selling items
        const bestSellersParams: any[] = [uniId];
        let bestSellersRestaurantClause = '';
        if (restaurantId) {
            bestSellersRestaurantClause = ` AND o.restaurant_id = $2`;
            bestSellersParams.push(restaurantId);
        }
        const bestSellersResult = await pool.query(
            `SELECT m.name, m.image_url, m.price,
                    SUM(oi.quantity)::int as total_sold,
                    SUM(oi.quantity * oi.price_at_time)::numeric as total_revenue
             FROM order_items oi
             JOIN menu_items m ON oi.menu_item_id = m.id
             JOIN orders o ON oi.order_id = o.id
             WHERE o.university_id = $1 AND o.status IN ('preparing', 'ready', 'completed')${bestSellersRestaurantClause}
             GROUP BY m.id, m.name, m.image_url, m.price
             ORDER BY total_sold DESC
             LIMIT 5`,
            bestSellersParams
        );

        // 5. Average order value
        const avgResult = await pool.query(
            `SELECT COALESCE(AVG(total_amount), 0)::numeric as avg_order_value
             FROM orders WHERE university_id = $1 AND status IN ('preparing', 'ready', 'completed')${restaurantClauseDirect}`,
            restaurantId ? [uniId, restaurantId] : [uniId]
        );
        const avgOrderValue = parseFloat(parseFloat(avgResult.rows[0].avg_order_value).toFixed(2));

        // 6. Today's stats
        const todayResult = await pool.query(
            `SELECT COUNT(*)::int as orders_today,
                    COALESCE(SUM(total_amount), 0)::numeric as revenue_today
             FROM orders
             WHERE university_id = $1
               AND created_at >= CURRENT_DATE
               AND status IN ('preparing', 'ready', 'completed')${restaurantClauseDirect}`,
            restaurantId ? [uniId, restaurantId] : [uniId]
        );

        // 7. Total customers
        const customersResult = await pool.query(
            `SELECT COUNT(DISTINCT user_id)::int as total_customers
             FROM orders WHERE university_id = $1${restaurantClauseDirect}`,
            restaurantId ? [uniId, restaurantId] : [uniId]
        );

        // 8. Daily orders (last 7 days)
        const dailyParams: any[] = [uniId];
        let dailyRestaurantClause = '';
        if (restaurantId) {
            dailyRestaurantClause = ` AND o.restaurant_id = $2`;
            dailyParams.push(restaurantId);
        }
        const dailyResult = await pool.query(
            `SELECT TO_CHAR(d.day, 'Dy') as label,
                    TO_CHAR(d.day, 'YYYY-MM-DD') as date,
                    COALESCE(COUNT(o.id), 0)::int as orders,
                    COALESCE(SUM(o.total_amount), 0)::numeric as revenue
             FROM generate_series(
                 CURRENT_DATE - INTERVAL '6 days',
                 CURRENT_DATE,
                 '1 day'::interval
             ) AS d(day)
             LEFT JOIN orders o ON DATE(o.created_at) = d.day
                 AND o.university_id = $1
                 AND o.status IN ('preparing', 'ready', 'completed')${dailyRestaurantClause}
             GROUP BY d.day
             ORDER BY d.day`,
            dailyParams
        );

        // 9. Peak hours (last 30 days)
        const peakHoursResult = await pool.query(
            `SELECT EXTRACT(HOUR FROM created_at)::int as hour,
                    COUNT(*)::int as orders
             FROM orders
             WHERE university_id = $1
               AND status IN ('preparing', 'ready', 'completed')
               AND created_at >= NOW() - INTERVAL '30 days'${restaurantClauseDirect}
             GROUP BY hour
             ORDER BY hour`,
            restaurantId ? [uniId, restaurantId] : [uniId]
        );

        // Build 24-hour array (fill gaps with 0)
        const peakHours = Array.from({ length: 24 }, (_, i) => {
            const found = peakHoursResult.rows.find((r: any) => r.hour === i);
            return { hour: i, orders: found ? found.orders : 0 };
        });

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
            daily_orders: dailyResult.rows.map((r: any) => ({
                label: r.label,
                date: r.date,
                orders: r.orders,
                revenue: parseFloat(r.revenue),
            })),
            peak_hours: peakHours,
            restaurant_filtered: !!restaurantId,
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
