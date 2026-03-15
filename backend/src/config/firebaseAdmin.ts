import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// Initialize Firebase Admin SDK
const serviceAccountPath = path.resolve(__dirname, '../../firebase-service-account.json');

if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized');
} else {
    console.warn('⚠️  firebase-service-account.json not found — push notifications disabled');
}

/**
 * Send a push notification via FCM.
 * Silently fails if Firebase is not initialized or token is invalid.
 */
export const sendPush = async (
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>
): Promise<boolean> => {
    if (!admin.apps.length || !fcmToken) return false;

    try {
        await admin.messaging().send({
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
        return true;
    } catch (error: any) {
        // Token is stale/invalid — don't crash
        if (error.code === 'messaging/registration-token-not-registered') {
            console.log(`FCM token expired for a user, skipping`);
        } else {
            console.error('FCM send error:', error.message);
        }
        return false;
    }
};

export default admin;
