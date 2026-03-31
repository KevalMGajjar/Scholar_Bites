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
        expiresIn: '30d',
        issuer: 'scholar-bites-api',
        audience: 'scholar-bites-client',
    });
};

export const verifyToken = (token: string) => {
    if (!token || token === 'null' || token === 'undefined') {
        console.warn('[JWT] Received empty/null token string');
        return null;
    }

    try {
        // Primary: strict verification with issuer + audience claims
        return jwt.verify(token, getSecret(), {
            issuer: 'scholar-bites-api',
            audience: 'scholar-bites-client',
        });
    } catch (strictError: any) {
        // Fallback: verify without issuer/audience for legacy tokens
        // issued before the security update added these claims
        try {
            const decoded = jwt.verify(token, getSecret());
            console.warn('[JWT] Legacy token accepted (missing iss/aud claims) — user should re-login for a new token');
            return decoded;
        } catch (fallbackError: any) {
            // Log the actual reason for failure to aid debugging
            const reason = fallbackError.name === 'TokenExpiredError'
                ? `expired at ${fallbackError.expiredAt}`
                : fallbackError.message;
            console.warn(`[JWT] Token verification failed: ${reason}`);
            return null;
        }
    }
};
