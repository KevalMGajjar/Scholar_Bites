import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// ─── Initialize Firebase Admin SDK ───
const serviceAccountPath = path.resolve(__dirname, '../../firebase-service-account.json');

console.log(`[Firebase] Looking for service account at: ${serviceAccountPath}`);

if (fs.existsSync(serviceAccountPath)) {
    try {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log(`✅ Firebase Admin initialized (project: ${serviceAccount.project_id})`);
    } catch (error: any) {
        console.error('❌ Firebase Admin initialization FAILED:', error.message);
    }
} else {
    console.warn('⚠️  firebase-service-account.json NOT FOUND — push notifications DISABLED');
    console.warn(`    Resolved path: ${serviceAccountPath}`);
    console.warn('    To fix: copy the file to the backend root directory on the server');
}

/**
 * Send a push notification via FCM.
 * Returns true on success, false on failure.
 */
export const sendPush = async (
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>
): Promise<boolean> => {
    if (!admin.apps.length) {
        console.warn('[FCM] Cannot send push — Firebase Admin not initialized');
        return false;
    }
    if (!fcmToken) {
        console.warn('[FCM] Cannot send push — no FCM token provided');
        return false;
    }

    try {
        const messageId = await admin.messaging().send({
            token: fcmToken,
            notification: { title, body },
            data: data || {},
            android: {
                priority: 'high',
                notification: {
                    channelId: 'scholar_bites_notifications',
                    priority: 'high',
                    defaultSound: true,
                },
            },
            apns: {
                payload: {
                    aps: {
                        alert: { title, body },
                        sound: 'default',
                        badge: 1,
                    },
                },
            },
        });
        console.log(`[FCM] ✅ Push sent (messageId: ${messageId})`);
        return true;
    } catch (error: any) {
        if (error.code === 'messaging/registration-token-not-registered') {
            console.warn(`[FCM] Token expired/invalid — skipping`);
        } else if (error.code === 'messaging/invalid-argument') {
            console.error(`[FCM] Invalid argument:`, error.message);
        } else {
            console.error(`[FCM] ❌ Send failed:`, error.code, error.message);
        }
        return false;
    }
};

export default admin;
