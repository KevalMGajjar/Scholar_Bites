import { z } from 'zod/v4';
import { Request, Response, NextFunction } from 'express';

// ═══════════════════════════════════════════════════════
// Validate Middleware Factory
// ═══════════════════════════════════════════════════════

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Creates Express middleware that validates request data against a Zod schema.
 * Rejects with 400 and clear error messages if validation fails.
 */
export const validate = (schema: z.ZodType, target: ValidationTarget = 'body') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req[target]);
        if (!result.success) {
            const errors = result.error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
            }));
            return res.status(400).json({ message: 'Validation failed', errors });
        }
        // Replace with parsed (sanitized) data
        (req as any)[target] = result.data;
        next();
    };
};

// ═══════════════════════════════════════════════════════
// Common Password Blocklist (top 50)
// ═══════════════════════════════════════════════════════
const COMMON_PASSWORDS = new Set([
    'password', '12345678', '123456789', '1234567890', 'qwerty123',
    'password1', 'iloveyou', 'sunshine1', 'princess1', '00000000',
    'football1', 'charlie1', 'access14', 'mustang1', 'shadow12',
    'master12', 'michael1', 'abc12345', 'pass1234', 'welcome1',
    'monkey123', 'dragon12', 'letmein1', 'baseball', 'trustno1',
    'whatever', 'jordan23', 'password123', 'admin123', 'qwerty12',
    'passw0rd', '1q2w3e4r', 'superman', 'asdfghjk', 'zxcvbnm1',
    'test1234', 'google12', 'amazon12', 'apple123', 'india123',
    'abcd1234', 'student1', 'college1', 'campus12', 'food1234',
    'canteen1', 'university', 'scholar1', 'admin1234', 'super123',
]);

// ═══════════════════════════════════════════════════════
// Password Strength Validator
// ═══════════════════════════════════════════════════════
const passwordSchema = z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .refine((pw) => /[A-Z]/.test(pw), 'Password must contain at least one uppercase letter')
    .refine((pw) => /[0-9]/.test(pw), 'Password must contain at least one number')
    .refine((pw) => !COMMON_PASSWORDS.has(pw.toLowerCase()), 'This password is too common. Please choose a stronger one.');

// ═══════════════════════════════════════════════════════
// Auth Schemas
// ═══════════════════════════════════════════════════════

export const loginOtpSchema = z.object({
    phone: z.string().regex(/^\d{10,15}$/, 'Phone must be 10-15 digits'),
});

export const registerOtpSchema = z.object({
    phone: z.string().regex(/^\d{10,15}$/, 'Phone must be 10-15 digits'),
    university_id: z.string().uuid('Invalid university ID'),
});

export const updateUniversitySchema = z.object({
    phone: z.string().regex(/^\d{10,15}$/, 'Phone must be 10-15 digits'),
    university_id: z.string().uuid('Invalid university ID'),
});

export const staffLoginSchema = z.object({
    email: z.string().email('Invalid email format').max(255),
    password: z.string().min(1, 'Password is required').max(128),
    panel: z.enum(['admin', 'superadmin'] as const).optional(),
});

export const registerStaffSchema = z.object({
    email: z.string().email('Invalid email format').max(255),
    password: passwordSchema,
    name: z.string().min(1, 'Name is required').max(100),
    role: z.enum(['staff', 'admin'] as const), // super_admin cannot be created via this endpoint
    university_id: z.string().uuid('Invalid university ID'),
});

// ═══════════════════════════════════════════════════════
// Menu Schemas
// ═══════════════════════════════════════════════════════

export const addMenuItemSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(1000).optional(),
    price: z.union([z.string(), z.number()]).transform((v) => String(v)),
    category: z.string().min(1).max(50),
    restaurant_id: z.string().uuid(),
    stock_quantity: z.union([z.string(), z.number()]).transform((v) => Number(v)).optional(),
    nutritional_info: z.string().optional(), // JSON string from FormData
});

// ═══════════════════════════════════════════════════════
// Order Schemas
// ═══════════════════════════════════════════════════════

export const createOrderSchema = z.object({
    items: z.array(z.object({
        menu_item_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
    })).min(1, 'At least one item is required'),
    university_id: z.string().uuid(),
});

export const updateOrderStatusSchema = z.object({
    status: z.enum(['pending', 'preparing', 'ready', 'completed', 'cancelled'] as const),
});

// ═══════════════════════════════════════════════════════
// Wallet Schemas
// ═══════════════════════════════════════════════════════

export const topUpSchema = z.object({
    amount: z.union([z.string(), z.number()])
        .transform((v) => Number(v))
        .refine((v) => !isNaN(v) && v >= 10, 'Minimum top-up is ₹10')
        .refine((v) => !isNaN(v) && v <= 10000, 'Maximum top-up is ₹10,000'),
});

export const payOrderSchema = z.object({
    order_id: z.string().uuid('Invalid order ID'),
});

// ═══════════════════════════════════════════════════════
// Password Change Schemas
// ═══════════════════════════════════════════════════════

export const verifyOtpSchema = z.object({
    otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must be numeric'),
    current_password: z.string().min(1, 'Current password is required'),
    new_password: passwordSchema,
});

// ═══════════════════════════════════════════════════════
// Lobby Schemas
// ═══════════════════════════════════════════════════════

export const joinLobbySchema = z.object({
    code: z.string().min(4).max(10),
    nickname: z.string().min(1).max(100).optional(),
});

export const addItemToLobbySchema = z.object({
    group_id: z.string().uuid(),
    menu_item_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(50),
});

// ═══════════════════════════════════════════════════════
// Notification Schemas
// ═══════════════════════════════════════════════════════

export const registerFcmTokenSchema = z.object({
    token: z.string().min(1, 'FCM token is required').max(500),
});
