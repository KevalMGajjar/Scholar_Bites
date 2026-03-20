/**
 * Validates that all required environment variables are set at startup.
 * Crashes the process with a clear error message if any are missing.
 */
export function validateEnv(): void {
    const required: { key: string; critical: boolean }[] = [
        { key: 'DATABASE_URL', critical: true },
        { key: 'JWT_SECRET', critical: true },
    ];

    const warnings: { key: string }[] = [
        { key: 'AWS_ACCESS_KEY_ID' },
        { key: 'AWS_SECRET_ACCESS_KEY' },
        { key: 'AWS_S3_BUCKET_NAME' },
        { key: 'RAZORPAY_KEY_ID' },
        { key: 'RAZORPAY_KEY_SECRET' },
    ];

    const missing: string[] = [];

    for (const { key, critical } of required) {
        if (!process.env[key]) {
            if (critical) {
                missing.push(key);
            }
        }
    }

    if (missing.length > 0) {
        console.error('═══════════════════════════════════════════════════════');
        console.error('FATAL: Missing required environment variables:');
        missing.forEach((key) => console.error(`  ✗ ${key}`));
        console.error('');
        console.error('Set these in your .env file or environment before starting.');
        console.error('═══════════════════════════════════════════════════════');
        process.exit(1);
    }

    // Non-critical warnings
    for (const { key } of warnings) {
        if (!process.env[key]) {
            console.warn(`[WARN] Environment variable ${key} is not set. Related features may not work.`);
        }
    }

    console.log('[ENV] All required environment variables validated ✓');
}
