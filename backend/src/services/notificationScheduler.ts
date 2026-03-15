import cron from 'node-cron';
import pool from '../config/db';
import { notifyUniversityUsers } from '../controllers/notificationController';

export const startNotificationScheduler = () => {
    // Run every 15 minutes to check for restaurants closing soon
    cron.schedule('*/15 * * * *', async () => {
        try {
            console.log('Running scheduler: Checking for restaurants closing soon...');

            // Query restaurants closing in ~30 minutes (between 15 to 45 mins from now)
            // Using ::time converts it to a comparable time type.
            const query = `
                SELECT id, name, university_id, closing_time 
                FROM restaurants 
                WHERE is_open = true 
                  AND closing_time IS NOT NULL 
                  AND closing_time::time > (CURRENT_TIME AT TIME ZONE 'UTC' + INTERVAL '15 minutes')::time 
                  AND closing_time::time <= (CURRENT_TIME AT TIME ZONE 'UTC' + INTERVAL '45 minutes')::time
            `;

            const { rows: restaurants } = await pool.query(query);

            for (const restaurant of restaurants) {
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
                console.log(`Sent closing soon notifications for ${restaurants.length} restaurants.`);
            }
        } catch (error) {
            console.error('Error in notification scheduler:', error);
        }
    });

    console.log('Notification scheduler started.');
};
