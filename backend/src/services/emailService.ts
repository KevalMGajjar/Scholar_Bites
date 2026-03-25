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
            <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background-color: #131313; color: #e5e2e1;">
                <div style="text-align: center; margin-bottom: 32px;">
                    <h1 style="color: #e5e2e1; font-size: 26px; font-weight: 700; margin: 0; font-family: 'Manrope', Arial, sans-serif; letter-spacing: -0.5px;">Scholar Bites</h1>
                    <p style="color: #a38b88; font-size: 13px; margin-top: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Admin Panel</p>
                </div>
                
                <div style="background-color: #1c1b1b; border: 1px solid #554240; border-radius: 16px; padding: 32px 24px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    <p style="color: #e5e2e1; font-size: 15px; margin: 0 0 24px 0; font-weight: 500;">Your one-time verification code is:</p>
                    
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                            <td align="center">
                                <div style="background-color: #131313; border: 1px solid rgba(240, 81, 62, 0.4); border-radius: 12px; padding: 20px 16px 20px 28px; display: inline-block;">
                                    <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #f0513e; font-family: 'Courier New', Courier, monospace; line-height: 1;">${otp}</span>
                                </div>
                            </td>
                        </tr>
                    </table>
                    
                    <p style="color: #a38b88; font-size: 13px; margin-top: 24px; line-height: 1.5;">This code expires in <strong style="color: #e5e2e1;">10 minutes</strong>.</p>
                </div>
                
                <p style="color: #554240; font-size: 11px; text-align: center; margin-top: 32px; line-height: 1.6;">
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
            <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background-color: #131313; color: #e5e2e1;">
                <div style="text-align: center; margin-bottom: 32px;">
                    <h1 style="color: #e5e2e1; font-size: 26px; font-weight: 700; margin: 0; font-family: 'Manrope', Arial, sans-serif; letter-spacing: -0.5px;">Scholar Bites</h1>
                    <p style="color: #a38b88; font-size: 13px; margin-top: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Secure Login Validation</p>
                </div>
                
                <div style="background-color: #1c1b1b; border: 1px solid #554240; border-radius: 16px; padding: 32px 24px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    <p style="color: #e5e2e1; font-size: 15px; margin: 0 0 8px 0; font-weight: 500;">Hi <strong style="color: #f0513e;">${name}</strong>,</p>
                    <p style="color: #a38b88; font-size: 14px; margin: 0 0 24px 0;">Enter this code to complete your sign-in:</p>
                    
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                            <td align="center">
                                <div style="background-color: #131313; border: 1px solid rgba(240, 81, 62, 0.4); border-radius: 12px; padding: 20px 16px 20px 28px; display: inline-block;">
                                    <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #f0513e; font-family: 'Courier New', Courier, monospace; line-height: 1;">${otp}</span>
                                </div>
                            </td>
                        </tr>
                    </table>
                    
                    <p style="color: #a38b88; font-size: 13px; margin-top: 24px; line-height: 1.5;">This code expires in <strong style="color: #e5e2e1;">5 minutes</strong>.</p>
                </div>
                
                <p style="color: #554240; font-size: 11px; text-align: center; margin-top: 32px; line-height: 1.6;">
                    If you didn't try to log in, someone may be using your credentials.<br/>
                    Change your password immediately.
                </p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
};
