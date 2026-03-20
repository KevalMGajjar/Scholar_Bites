import jwt from 'jsonwebtoken';

/**
 * Lazy-loaded JWT secret.
 * Cannot read process.env at module import time because dotenv.config()
 * hasn't run yet (TypeScript hoists imports above statements in server.ts).
 */
let _secret: string | undefined;

function getSecret(): string {
    if (!_secret) {
        _secret = process.env.JWT_SECRET;
        if (!_secret) {
            console.error('FATAL: JWT_SECRET environment variable is not set.');
            console.error('Set it in .env or environment before starting the server.');
            process.exit(1);
        }
    }
    return _secret;
}

export const generateToken = (payload: object) => {
    return jwt.sign(payload, getSecret(), {
        expiresIn: '8h',
        issuer: 'scholar-bites-api',
        audience: 'scholar-bites-client',
    });
};

export const verifyToken = (token: string) => {
    try {
        return jwt.verify(token, getSecret(), {
            issuer: 'scholar-bites-api',
            audience: 'scholar-bites-client',
        });
    } catch (error) {
        return null;
    }
};
