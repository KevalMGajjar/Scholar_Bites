import { Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

// Ensure uploads directory exists
const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.memoryStorage();

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, WebP, SVG, and GIF images are allowed'));
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/**
 * Saves a buffer to local filesystem and returns the public URL.
 * Drop-in replacement for the original S3 upload — same function name,
 * so no other file in the project needs to change.
 */
export const uploadToS3 = async (fileBuffer: Buffer, mimetype: string, key: string): Promise<string> => {
    const safeKey = key.replace(/[^a-zA-Z0-9._\-\/\\]/g, '_');
    const filePath = path.join(uploadDir, safeKey);

    // Ensure subdirectory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, fileBuffer);

    // Return URL served by Express static middleware (app.ts already has /uploads route)
    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;
    return `${serverUrl}/uploads/${safeKey}`;
};
