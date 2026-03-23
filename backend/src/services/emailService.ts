import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const sendOtpEmail = async (to: string, otp: string): Promise<void> => {
    const mailOptions = {
        from: `"Scholar Bites" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Your Password Reset OTP – Scholar Bites',
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 30px; background: #0f172a; border-radius: 16px; color: #e2e8f0;">
                <div style="text-align: center; margin-bottom: 32px;">
                    <h1 style="color: #ffffff; font-size: 24px; margin: 0;">Scholar Bites</h1>
                    <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Admin Panel</p>
                </div>
                <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; text-align: center;">
                    <p style="color: #94a3b8; font-size: 14px; margin: 0 0 16px 0;">Your one-time verification code is:</p>
                    <div style="background: #0f172a; border: 2px solid #8B1C28; border-radius: 12px; padding: 20px; display: inline-block; min-width: 200px;">
                        <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #ffffff; font-family: 'Courier New', monospace;">${otp}</span>
                    </div>
                    <p style="color: #64748b; font-size: 12px; margin-top: 20px;">This code expires in <strong style="color: #e2e8f0;">10 minutes</strong>.</p>
                </div>
                <p style="color: #475569; font-size: 11px; text-align: center; margin-top: 24px;">
                    If you didn't request this, please ignore this email.<br/>
                    Do not share this code with anyone.
                </p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
};

export const sendLoginOtpEmail = async (to: string, otp: string, name: string): Promise<void> => {
    const mailOptions = {
        from: `"Scholar Bites" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Your Login Verification Code – Scholar Bites',
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 30px; background: #0f172a; border-radius: 16px; color: #e2e8f0;">
                <div style="text-align: center; margin-bottom: 32px;">
                    <h1 style="color: #ffffff; font-size: 24px; margin: 0;">Scholar Bites</h1>
                    <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Admin Login Verification</p>
                </div>
                <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; text-align: center;">
                    <p style="color: #94a3b8; font-size: 14px; margin: 0 0 8px 0;">Hi <strong style="color: #e2e8f0;">${name}</strong>,</p>
                    <p style="color: #94a3b8; font-size: 14px; margin: 0 0 16px 0;">Enter this code to complete your sign-in:</p>
                    <div style="background: #0f172a; border: 2px solid #6366f1; border-radius: 12px; padding: 20px; display: inline-block; min-width: 200px;">
                        <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #ffffff; font-family: 'Courier New', monospace;">${otp}</span>
                    </div>
                    <p style="color: #64748b; font-size: 12px; margin-top: 20px;">This code expires in <strong style="color: #e2e8f0;">5 minutes</strong>.</p>
                </div>
                <p style="color: #475569; font-size: 11px; text-align: center; margin-top: 24px;">
                    If you didn't try to log in, someone may be using your credentials.<br/>
                    Change your password immediately.
                </p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
};
