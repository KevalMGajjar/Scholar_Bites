import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set.');
    console.error('Set it in .env or environment before starting the server.');
    process.exit(1);
}

export const generateToken = (payload: object) => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: '8h',
        issuer: 'scholar-bites-api',
        audience: 'scholar-bites-client',
    });
};

export const verifyToken = (token: string) => {
    try {
        return jwt.verify(token, JWT_SECRET, {
            issuer: 'scholar-bites-api',
            audience: 'scholar-bites-client',
        });
    } catch (error) {
        return null;
    }
};
