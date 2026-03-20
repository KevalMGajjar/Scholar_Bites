import { Request, Response, NextFunction } from 'express';

/**
 * Centralized error handler.
 * - Development: full error + stack trace for debugging
 * - Production: generic message, no internals leaked
 */
export const globalErrorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = err.statusCode || err.status || 500;

    // Log full error for server-side debugging
    console.error(`[ERROR] ${statusCode}:`, err.message || err);
    if (err.stack) console.error(err.stack);

    const isDev = process.env.NODE_ENV !== 'production';

    res.status(statusCode).json({
        message: isDev ? err.message : 'An unexpected error occurred. Please try again later.',
        ...(isDev && { stack: err.stack }),
    });
};
