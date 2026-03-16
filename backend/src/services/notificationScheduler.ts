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
    // Run every 15 minutes to check for restaurants closing soon
    cron.schedule('*/15 * * * *', async () => {
        try {
            // Current IST time for logging
            const nowIST = new Date().toLocaleString('en-IN', { timeZone: IST_TIMEZONE });
            console.log(`[Scheduler] Running at IST: ${nowIST} — checking for restaurants closing soon...`);

            // Query restaurants closing within the next 15–45 minutes (IST).
            // closing_time is stored as a raw TIME in IST, so we compare against
            // CURRENT_TIME converted to IST.
            const query = `
                SELECT id, name, university_id, closing_time
                FROM restaurants
                WHERE is_open = true
                  AND closing_time IS NOT NULL
                  AND closing_time::time > (CURRENT_TIME AT TIME ZONE '${IST_TIMEZONE}' + INTERVAL '15 minutes')::time
                  AND closing_time::time <= (CURRENT_TIME AT TIME ZONE '${IST_TIMEZONE}' + INTERVAL '45 minutes')::time
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
