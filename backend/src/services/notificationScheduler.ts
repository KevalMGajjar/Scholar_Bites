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
    // Run every 5 minutes to ensure we don't skip any times if a user edits a closing time mid-window
    cron.schedule('*/5 * * * *', async () => {
        try {
            // Current IST time for logging
            const nowIST = new Date().toLocaleString('en-IN', { timeZone: IST_TIMEZONE });
            console.log(`[Scheduler] Running at IST: ${nowIST} — checking for restaurants closing soon...`);

            // We look for restaurants closing exactly 25 to 35 minutes from now.
            // A 10-minute window running every 5 minutes guarantees total coverage (no gaps).
            // The query uses a CTE to elegantly handle "midnight wraparound" where lower_bound > upper_bound.
            const query = `
                WITH bounds AS (
                    SELECT 
                        (timezone('${IST_TIMEZONE}', now())::time + INTERVAL '25 minutes')::time as lower_bound,
                        (timezone('${IST_TIMEZONE}', now())::time + INTERVAL '35 minutes')::time as upper_bound
                )
                SELECT id, name, university_id, closing_time
                FROM restaurants, bounds
                WHERE is_open = true
                  AND closing_time IS NOT NULL
                  AND (
                      (lower_bound <= upper_bound AND closing_time >= lower_bound AND closing_time <= upper_bound)
                      OR
                      (lower_bound > upper_bound AND (closing_time >= lower_bound OR closing_time <= upper_bound))
                  )
            `;

            const { rows: restaurants } = await pool.query(query);

            console.log(`[Scheduler] Found ${restaurants.length} restaurant(s) closing soon.`);

            for (const restaurant of restaurants) {
                console.log(`[Scheduler] Notifying for "${restaurant.name}" (closing at ${restaurant.closing_time})`);
                
                // Dedupe key ensures we don't spam if the job runs slightly overlapping
                const dedupeKey = `closing_soon_${restaurant.id}`;

                await notifyUniversityUsers(
                    restaurant.university_id,
                    'restaurant_closing_soon',
                    'LAST CALL 💨',
                    `${restaurant.name} closes in 30 mins!! don't be the one who missed out`,
                    { restaurant_id: restaurant.id },
                    dedupeKey
                );
            }

            if (restaurants.length > 0) {
                console.log(`[Scheduler] ✅ Sent closing-soon notifications for ${restaurants.length} restaurant(s).`);
            }
        } catch (error) {
            console.error('[Scheduler] Error:', error);
        }
    });

    console.log('[Scheduler] Notification scheduler started (IST timezone).');
};
