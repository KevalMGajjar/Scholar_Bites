import cron from 'node-cron';
import pool from '../config/db';
import { notifyUniversityUsers } from '../controllers/notificationController';

/**
 * The restaurants table stores opening_time / closing_time as raw TIME values
 * in IST (Asia/Kolkata, UTC+5:30). The EC2 server clock runs in UTC.
 * We must compare closing_time against the current IST time, not UTC.
 */
const IST_TIMEZONE = 'Asia/Kolkata';

export const startNotificationScheduler = () => {
    // Run exactly every minute to catch the precise 15-minute mark
    cron.schedule('* * * * *', async () => {
        try {
            // Current IST time for logging
            const nowIST = new Date().toLocaleString('en-IN', { timeZone: IST_TIMEZONE });
            console.log(`[Scheduler] Running at IST: ${nowIST} — checking for restaurants closing exactly in 15 mins...`);

            // Target exactly 15 minutes from now. We compare the exact hour and minute 
            // to ensure this query only matches a single time per restaurant each day.
            const query = `
                WITH target_time AS (
                    SELECT (timezone('${IST_TIMEZONE}', now())::time + INTERVAL '15 minutes')::time as raw_target
                )
                SELECT id, name, university_id, closing_time
                FROM restaurants, target_time
                WHERE is_open = true
                  AND closing_time IS NOT NULL
                  AND extract(hour from closing_time) = extract(hour from raw_target)
                  AND extract(minute from closing_time) = extract(minute from raw_target)
            `;

            const { rows: restaurants } = await pool.query(query);

            if (restaurants.length > 0) {
                console.log(`[Scheduler] Found ${restaurants.length} restaurant(s) closing in precisely 15 mins.`);
            }

            for (const restaurant of restaurants) {
                console.log(`[Scheduler] Notifying for "${restaurant.name}" (closing at ${restaurant.closing_time})`);
                
                const dedupeKey = `closing_soon_${restaurant.id}`;

                await notifyUniversityUsers(
                    restaurant.university_id,
                    'restaurant_closing_soon',
                    'LAST CALL 💨',
                    `${restaurant.name} closes in 15 mins!! don't be the one who missed out`,
                    { restaurant_id: restaurant.id },
                    dedupeKey
                );
            }

            if (restaurants.length > 0) {
                console.log(`[Scheduler] ✅ Sent closing-soon notifications successfully.`);
            }
        } catch (error) {
            console.error('[Scheduler] Error:', error);
        }
    });

    console.log('[Scheduler] Notification scheduler started (IST timezone).');
};
