import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// ─── Storage Config ─────────────────────────────────
const uploadsDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        cb(null, name);
    },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ─── Upload Handler ─────────────────────────────────
export const uploadImage = (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
    }

    // Build public URL: /uploads/<filename>
    const imageUrl = `/uploads/${req.file.filename}`;

    res.json({ image_url: imageUrl });
};
