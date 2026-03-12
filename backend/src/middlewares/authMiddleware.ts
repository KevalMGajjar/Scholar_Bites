import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import pool from '../config/db';
import { verifyToken } from '../utils/jwt';

export interface AuthRequest extends Request {
    user?: any;
}

export const authenticateJWT = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.sendStatus(401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token) as any;

    if (!decoded) {
        return res.sendStatus(403);
    }

    // ─── Single-device check: compare token hash against stored active_token ───
    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // Determine which table to check based on role
        const table = decoded.role === 'student' ? 'users' : 'staff';
        const result = await pool.query(
            `SELECT active_token FROM ${table} WHERE id = $1`,
            [decoded.id]
        );

        if (result.rows.length > 0) {
            const storedHash = result.rows[0].active_token;
            // If a stored hash exists and doesn't match, this token was superseded
            if (storedHash && storedHash !== tokenHash) {
                return res.status(401).json({
                    message: 'Session expired. You have been logged in on another device.',
                    code: 'DEVICE_CONFLICT',
                });
            }
        }
    } catch (err) {
        // Don't block auth if the check fails — log and continue
        console.error('Single-device check error:', err);
    }

    req.user = decoded;
    next();
};

export const authorizeRole = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (req.user && roles.includes(req.user.role)) {
            next();
        } else {
            res.sendStatus(403);
        }
    };
};
