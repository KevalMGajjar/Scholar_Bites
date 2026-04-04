import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '../config/db';
import { generateToken } from '../utils/jwt';
import { checkBruteForce, recordFailedLogin, clearFailedLogins } from '../middlewares/security';
import { auditLog, getRequestIp } from '../services/auditLogger';
import { sendLoginOtpEmail } from '../services/emailService';
import { OAuth2Client } from 'google-auth-library';
import { AHMEDABAD_UNIVERSITY_ID } from '../config/constants';

const BCRYPT_ROUNDS = 12;
const OTP_EXPIRY_MINUTES = 5;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/** Hash a JWT token to a short 64-char hex string for storage */
function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/** Save the active token hash on the user row (single-device enforcement) */
async function saveActiveToken(userId: string, token: string, table: 'users' | 'staff' = 'users') {
    const hash = hashToken(token);
    await pool.query(`UPDATE ${table} SET active_token = $1 WHERE id = $2`, [hash, userId]);
}

export const loginOtp = async (req: Request, res: Response) => {
    const { phone } = req.body;

    try {
        let result = await pool.query(
            `SELECT u.*, uni.name as university_name 
             FROM users u 
             LEFT JOIN universities uni ON u.university_id = uni.id 
             WHERE u.phone = $1`,
            [phone]
        );
        let user = result.rows[0];
        let role = 'student';

        // Check if staff
        if (!user) {
            result = await pool.query(
                `SELECT s.*, uni.name as university_name
                 FROM staff s
                 LEFT JOIN universities uni ON s.university_id = uni.id
                 WHERE s.phone = $1`,
                [phone]
            );
            user = result.rows[0];
            if (user) role = user.role;
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Industry-standard approach: allow re-login and invalidate old session.
        // If the user logs in again, we overwrite the old token. The old device
        // will be kicked out via the DEVICE_CONFLICT check in authMiddleware.

        const token = generateToken({ id: user.id, phone: user.phone, role, user_type: user.user_type || 'student' });

        // Save token hash for single-device enforcement
        const table = role === 'student' ? 'users' : 'staff';
        await saveActiveToken(user.id, token, table);

        res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, university_id: user.university_id, university_name: user.university_name, role, user_type: user.user_type || 'student' } });
    } catch (error: any) {
        console.error('[Auth] loginOtp error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

export const registerOtp = async (req: Request, res: Response) => {
    const { phone } = req.body;
    // Single-university mode: always assign to Ahmedabad University
    const university_id = AHMEDABAD_UNIVERSITY_ID;

    try {
        const name = `Student ${phone}`;

        const result = await pool.query(
            'INSERT INTO users (name, university_id, phone) VALUES ($1, $2, $3) RETURNING id, name, phone, university_id',
            [name, university_id, phone]
        );

        const user = result.rows[0];

        // Fetch university name
        const uniResult = await pool.query('SELECT name FROM universities WHERE id = $1', [university_id]);
        const universityName = uniResult.rows[0]?.name || '';

        const token = generateToken({ id: user.id, phone: user.phone, role: 'student', user_type: 'student' });

        // Save token hash for single-device enforcement
        await saveActiveToken(user.id, token);

        res.status(201).json({ token, user: { ...user, university_name: universityName, role: 'student', user_type: 'student' } });
    } catch (error: any) {
        console.error('[Auth] register error:', error.message);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Phone number already registered' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateUniversity = async (req: Request, res: Response) => {
    const { phone, university_id } = req.body;

    try {
        const result = await pool.query(
            `UPDATE users SET university_id = $1 WHERE phone = $2 RETURNING id, name, phone, university_id`,
            [university_id, phone]
        );

        const user = result.rows[0];
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const uniResult = await pool.query('SELECT name FROM universities WHERE id = $1', [university_id]);
        const universityName = uniResult.rows[0]?.name || '';

        const token = generateToken({ id: user.id, phone: user.phone, role: 'student' });

        // Save token hash for single-device enforcement
        await saveActiveToken(user.id, token);

        res.json({ token, user: { ...user, university_name: universityName, role: 'student' } });
    } catch (error: any) {
        console.error('[Auth] updateUniversity error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Staff Login Step 1: Email + Password → Send OTP ───
export const staffLogin = async (req: Request, res: Response) => {
    const { email, password, panel } = req.body;
    const ip = getRequestIp(req);

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    // ─── Brute-force check ───
    const lockSeconds = checkBruteForce(email.toLowerCase());
    if (lockSeconds > 0) {
        auditLog({ action: 'LOGIN_LOCKED', details: `Account locked, ${lockSeconds}s remaining`, resource: `email:${email}`, ip });
        return res.status(423).json({ message: `Account temporarily locked. Try again in ${Math.ceil(lockSeconds / 60)} minutes.` });
    }

    try {
        const result = await pool.query(
            `SELECT s.*, uni.name as university_name 
             FROM staff s 
             LEFT JOIN universities uni ON s.university_id = uni.id 
             WHERE s.email = $1`,
            [email]
        );

        const staff = result.rows[0];

        // ─── Generic error to prevent user enumeration ───
        if (!staff) {
            recordFailedLogin(email.toLowerCase());
            auditLog({ action: 'LOGIN_FAILED', details: 'Email not found', resource: `email:${email}`, ip });
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, staff.password_hash);
        if (!isValidPassword) {
            const locked = recordFailedLogin(email.toLowerCase());
            auditLog({ userId: staff.id, action: 'LOGIN_FAILED', details: locked ? 'Wrong password → locked' : 'Wrong password', resource: `email:${email}`, ip });
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // ─── Role-based panel isolation ───
        // Admin panel: only staff/admin can login, NOT super_admin
        if (panel === 'admin' && staff.role === 'super_admin') {
            auditLog({ userId: staff.id, action: 'LOGIN_PANEL_DENIED', details: 'Super Admin tried admin panel', resource: `email:${email}`, ip });
            return res.status(403).json({ message: 'Super Admin accounts cannot log in to the Admin Panel. Please use the Super Admin Panel instead.' });
        }
        // Super admin panel: only super_admin can login, NOT staff/admin
        if (panel === 'superadmin' && staff.role !== 'super_admin') {
            auditLog({ userId: staff.id, action: 'LOGIN_PANEL_DENIED', details: `${staff.role} tried superadmin panel`, resource: `email:${email}`, ip });
            return res.status(403).json({ message: 'This account does not have Super Admin access. Please use the Admin Panel instead.' });
        }

        // ─── Credentials valid: generate OTP ───
        clearFailedLogins(email.toLowerCase());

        // Invalidate any existing unused OTPs for this staff
        await pool.query(
            "UPDATE staff_login_otps SET used = TRUE WHERE staff_id = $1 AND used = FALSE",
            [staff.id]
        );

        // Generate 6-digit OTP and hash it
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

        const otpResult = await pool.query(
            `INSERT INTO staff_login_otps (staff_id, otp_hash, expires_at)
             VALUES ($1, $2, $3) RETURNING id`,
            [staff.id, otpHash, expiresAt]
        );

        // Send OTP email (fire and don't block on failure)
        try {
            await sendLoginOtpEmail(staff.email, otp, staff.name);
        } catch (emailErr: any) {
            console.warn('[Auth] Failed to send login OTP email:', emailErr.message);
            return res.status(500).json({ message: 'Failed to send verification email. Please try again.' });
        }

        auditLog({ userId: staff.id, action: 'LOGIN_OTP_SENT', resource: `email:${email}`, ip });

        res.json({
            requires_otp: true,
            otp_session_id: otpResult.rows[0].id,
            message: 'Verification code sent to your email',
        });
    } catch (error: any) {
        console.error('[Auth] staffLogin error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Staff Login Step 2: Verify OTP → Issue JWT ───
const MAX_OTP_VERIFY_ATTEMPTS = 5;

export const verifyLoginOtp = async (req: Request, res: Response) => {
    const { otp_session_id, otp } = req.body;
    const ip = getRequestIp(req);

    if (!otp_session_id || !otp) {
        return res.status(400).json({ message: 'Session ID and OTP are required' });
    }

    try {
        // Fetch OTP record with staff details
        const result = await pool.query(
            `SELECT lo.*, s.id as sid, s.email, s.name, s.role, s.university_id, s.restaurant_id,
                    uni.name as university_name, r.name as restaurant_name
             FROM staff_login_otps lo
             JOIN staff s ON lo.staff_id = s.id
             LEFT JOIN universities uni ON s.university_id = uni.id
             LEFT JOIN restaurants r ON s.restaurant_id = r.id
             WHERE lo.id = $1`,
            [otp_session_id]
        );

        const record = result.rows[0];

        if (!record) {
            return res.status(404).json({ message: 'Invalid or expired session. Please log in again.' });
        }

        if (record.used) {
            return res.status(410).json({ message: 'This code has already been used. Please log in again.' });
        }

        if (new Date(record.expires_at) < new Date()) {
            auditLog({ userId: record.sid, action: 'LOGIN_OTP_FAILED', details: 'OTP expired', resource: `email:${record.email}`, ip });
            return res.status(410).json({ message: 'Verification code has expired. Please log in again.' });
        }

        // ─── Server-side attempt limiting ───
        const currentAttempts = record.attempts || 0;
        if (currentAttempts >= MAX_OTP_VERIFY_ATTEMPTS) {
            // Already burned — mark used to prevent further attempts
            await pool.query("UPDATE staff_login_otps SET used = TRUE WHERE id = $1", [otp_session_id]);
            auditLog({ userId: record.sid, action: 'LOGIN_OTP_BURNED', details: `Exceeded ${MAX_OTP_VERIFY_ATTEMPTS} attempts`, resource: `email:${record.email}`, ip });
            return res.status(429).json({ message: 'Too many failed attempts. This verification code has been invalidated. Please log in again.', locked: true });
        }

        // Verify OTP hash
        const otpHash = crypto.createHash('sha256').update(String(otp)).digest('hex');
        if (otpHash !== record.otp_hash) {
            // Increment attempt counter in DB
            const newAttempts = currentAttempts + 1;
            await pool.query("UPDATE staff_login_otps SET attempts = $1 WHERE id = $2", [newAttempts, otp_session_id]);

            // If this was the last attempt, burn the OTP
            if (newAttempts >= MAX_OTP_VERIFY_ATTEMPTS) {
                await pool.query("UPDATE staff_login_otps SET used = TRUE WHERE id = $1", [otp_session_id]);
                auditLog({ userId: record.sid, action: 'LOGIN_OTP_BURNED', details: `${MAX_OTP_VERIFY_ATTEMPTS} wrong attempts — OTP burned`, resource: `email:${record.email}`, ip });
                return res.status(429).json({
                    message: 'Too many failed attempts. This verification code has been invalidated. Please log in again.',
                    locked: true,
                    attempts_remaining: 0,
                });
            }

            const remaining = MAX_OTP_VERIFY_ATTEMPTS - newAttempts;
            auditLog({ userId: record.sid, action: 'LOGIN_OTP_FAILED', details: `Wrong OTP (attempt ${newAttempts}/${MAX_OTP_VERIFY_ATTEMPTS})`, resource: `email:${record.email}`, ip });
            return res.status(401).json({
                message: 'Incorrect verification code',
                attempts_remaining: remaining,
            });
        }

        // ─── OTP valid: mark used and issue JWT ───
        await pool.query("UPDATE staff_login_otps SET used = TRUE WHERE id = $1", [otp_session_id]);

        const token = generateToken({ id: record.sid, email: record.email, role: record.role, university_id: record.university_id, restaurant_id: record.restaurant_id || null });
        await saveActiveToken(record.sid, token, 'staff');

        auditLog({ userId: record.sid, action: 'LOGIN_OTP_VERIFIED', resource: `email:${record.email}`, ip });

        res.json({
            token,
            user: {
                id: record.sid,
                name: record.name,
                email: record.email,
                role: record.role,
                university_id: record.university_id,
                university_name: record.university_name,
                restaurant_id: record.restaurant_id || null,
                restaurant_name: record.restaurant_name || null,
            },
        });
    } catch (error: any) {
        console.error('[Auth] verifyLoginOtp error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Google Sign-In for Admin Panel ───
export const googleLogin = async (req: Request, res: Response) => {
    const { credential, panel } = req.body;
    const ip = getRequestIp(req);

    if (!credential) {
        return res.status(400).json({ message: 'Google credential is required' });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(500).json({ message: 'Google Sign-In is not configured on this server' });
    }

    try {
        // Verify the Google ID token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            return res.status(401).json({ message: 'Invalid Google token' });
        }

        const googleEmail = payload.email.toLowerCase();

        // Look up staff by email
        const result = await pool.query(
            `SELECT s.*, uni.name as university_name, r.name as restaurant_name
             FROM staff s
             LEFT JOIN universities uni ON s.university_id = uni.id
             LEFT JOIN restaurants r ON s.restaurant_id = r.id
             WHERE LOWER(s.email) = $1`,
            [googleEmail]
        );

        const staff = result.rows[0];

        if (!staff) {
            auditLog({ action: 'LOGIN_GOOGLE_FAILED', details: 'No staff account for this Google email', resource: `email:${googleEmail}`, ip });
            return res.status(403).json({ message: 'No admin account found for this Google email. Contact your administrator.' });
        }

        // ─── Role-based panel isolation (Google) ───
        if (panel === 'admin' && staff.role === 'super_admin') {
            auditLog({ userId: staff.id, action: 'LOGIN_PANEL_DENIED', details: 'Super Admin tried admin panel via Google', resource: `email:${googleEmail}`, ip });
            return res.status(403).json({ message: 'Super Admin accounts cannot log in to the Admin Panel. Please use the Super Admin Panel instead.' });
        }
        if (panel === 'superadmin' && staff.role !== 'super_admin') {
            auditLog({ userId: staff.id, action: 'LOGIN_PANEL_DENIED', details: `${staff.role} tried superadmin panel via Google`, resource: `email:${googleEmail}`, ip });
            return res.status(403).json({ message: 'This account does not have Super Admin access. Please use the Admin Panel instead.' });
        }

        // ─── Google is 2FA by default — issue JWT directly ───
        const token = generateToken({ id: staff.id, email: staff.email, role: staff.role, university_id: staff.university_id, restaurant_id: staff.restaurant_id || null });
        await saveActiveToken(staff.id, token, 'staff');

        auditLog({ userId: staff.id, action: 'LOGIN_GOOGLE_SUCCESS', resource: `email:${googleEmail}`, ip });

        res.json({
            token,
            user: {
                id: staff.id,
                name: staff.name,
                email: staff.email,
                role: staff.role,
                university_id: staff.university_id,
                university_name: staff.university_name,
                restaurant_id: staff.restaurant_id || null,
                restaurant_name: staff.restaurant_name || null,
            },
        });
    } catch (error: any) {
        console.error('[Auth] googleLogin error:', error.message);
        if (error.message?.includes('Token used too late') || error.message?.includes('Invalid token')) {
            return res.status(401).json({ message: 'Google token is invalid or expired. Please try again.' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Register Staff (Admin-only) ───
export const registerStaff = async (req: Request, res: Response) => {
    const { email, password, name, role, restaurant_id } = req.body;
    // Single-university mode: always assign to Ahmedabad University
    const university_id = req.body.university_id || AHMEDABAD_UNIVERSITY_ID;
    const caller = (req as any).user;
    const ip = getRequestIp(req);

    if (!email || !password || !name || !role) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // ─── Role escalation prevention ───
    if (role === 'super_admin') {
        return res.status(403).json({ message: 'Cannot create super_admin accounts via this endpoint' });
    }
    // Admin can only create staff, not other admins (unless they're super_admin)
    if (role === 'admin' && caller?.role !== 'super_admin') {
        return res.status(403).json({ message: 'Only super admins can create admin accounts' });
    }

    // Staff role requires restaurant assignment
    if (role === 'staff' && !restaurant_id) {
        return res.status(400).json({ message: 'Staff members must be assigned to a restaurant' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const result = await pool.query(
            `INSERT INTO staff (email, password_hash, name, role, university_id, restaurant_id)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, university_id, restaurant_id`,
            [email, hashedPassword, name, role, university_id, restaurant_id || null]
        );

        auditLog({ userId: caller?.id, action: 'STAFF_CREATED', resource: `staff:${result.rows[0].id}`, details: `role=${role}, restaurant=${restaurant_id || 'all'}`, ip });
        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Email already registered' });
        }
        console.error('[Auth] registerStaff error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Logout (Clears active session) ───
export const logout = async (req: Request, res: Response) => {
    // We expect the auth middleware to pass req.user
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const table = user.role === 'student' ? 'users' : 'staff';
        await pool.query(`UPDATE ${table} SET active_token = NULL WHERE id = $1`, [user.id]);
        res.json({ message: 'Logged out successfully' });
    } catch (error: any) {
        console.warn('[Auth] Logout error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// ═══════════════════════════════════════════════════════════════
// OTP-Based Password Change (Industry-grade two-step flow)
// ═══════════════════════════════════════════════════════════════

import { sendOtpEmail } from '../services/emailService';

// In-memory OTP store: staffId → { otp, expiresAt }
// In production at scale, use Redis. For a single-server deployment this is ideal.
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_COOLDOWN_MS = 60 * 1000;     // 1-minute cooldown between requests
const cooldownStore = new Map<string, number>();

function generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
}

// Step 1: Request OTP → sends a 6-digit code to the staff member's email
export const requestPasswordOtp = async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    try {
        // Rate limit: 1 OTP per minute
        const lastSent = cooldownStore.get(user.id);
        if (lastSent && Date.now() - lastSent < OTP_COOLDOWN_MS) {
            const waitSecs = Math.ceil((OTP_COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
            return res.status(429).json({ message: `Please wait ${waitSecs}s before requesting another OTP` });
        }

        // Fetch email
        const result = await pool.query('SELECT email FROM staff WHERE id = $1', [user.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        const email = result.rows[0].email;
        const otp = generateOtp();
        const expiresAt = Date.now() + OTP_EXPIRY_MS;

        // Store OTP first, but set cooldown ONLY after successful send
        otpStore.set(user.id, { otp, expiresAt });

        try {
            await sendOtpEmail(email, otp);
        } catch (emailError) {
            // Email failed — clean up OTP so user can retry immediately
            otpStore.delete(user.id);
            console.error('SMTP send failed:', emailError);
            return res.status(500).json({ message: 'Failed to send OTP email. Please check SMTP configuration on the server.' });
        }

        // Only set cooldown AFTER successful email delivery
        cooldownStore.set(user.id, Date.now());

        // Mask email for privacy: j***n@example.com
        const [local, domain] = email.split('@');
        const masked = local.length > 2
            ? `${local[0]}${'•'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`
            : `${local[0]}•@${domain}`;

        res.json({ message: 'OTP sent successfully', email: masked });
    } catch (error) {
        console.error('Request OTP error:', error);
        res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
    }
};

// Step 2: Verify OTP + current password → set new password
export const verifyOtpAndChangePassword = async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const { otp, current_password, new_password } = req.body;

    if (!otp || !current_password || !new_password) {
        return res.status(400).json({ message: 'OTP, current password, and new password are all required' });
    }

    if (new_password.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    try {
        // Validate OTP
        const stored = otpStore.get(user.id);
        if (!stored) {
            return res.status(400).json({ message: 'No OTP requested. Please request one first.' });
        }
        if (Date.now() > stored.expiresAt) {
            otpStore.delete(user.id);
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }
        if (stored.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP. Please check and try again.' });
        }

        // OTP is valid — consume it (single-use)
        otpStore.delete(user.id);

        // Validate current password
        const result = await pool.query('SELECT password_hash FROM staff WHERE id = $1', [user.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        const isValid = await bcrypt.compare(current_password, result.rows[0].password_hash);
        if (!isValid) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        // Set new password
        const newHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
        await pool.query('UPDATE staff SET password_hash = $1 WHERE id = $2', [newHash, user.id]);

        auditLog({ userId: user.id, action: 'PASSWORD_CHANGE', ip: getRequestIp(req) });

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Verify OTP + change password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Get Staff by University ───
export const getStaffByUniversity = async (req: Request, res: Response) => {
    const { university_id } = req.params;
    try {
        const result = await pool.query(
            `SELECT s.id, s.name, s.email, s.role, s.restaurant_id, s.created_at, r.name as restaurant_name
             FROM staff s
             LEFT JOIN restaurants r ON s.restaurant_id = r.id
             WHERE s.university_id = $1
             ORDER BY s.created_at DESC`,
            [university_id]
        );
        res.json(result.rows);
    } catch (error: any) {
        console.error('[Auth] getStaffByUniversity error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Delete Staff ───
export const deleteStaff = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;
    const ip = getRequestIp(req);

    // Prevent self-deletion
    if (user.id === id) {
        return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    try {
        // ─── IDOR: verify target staff belongs to same university ───
        const staffCheck = await pool.query('SELECT id, university_id FROM staff WHERE id = $1', [id]);
        if (staffCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Staff not found' });
        }
        if (staffCheck.rows[0].university_id !== user.university_id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        await pool.query('DELETE FROM staff WHERE id = $1', [id]);
        auditLog({ userId: user.id, action: 'STAFF_DELETED', resource: `staff:${id}`, ip });
        res.json({ message: 'Staff member removed' });
    } catch (error: any) {
        console.error('[Auth] deleteStaff error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};
