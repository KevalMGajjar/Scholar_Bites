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
        from: `"Ahmedabad University Canteen" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Your Password Reset OTP – Ahmedabad University Canteen',
        html: `
            <div style="font-family: Arial, sans-serif; background-color: #0c0f18; padding: 40px; color: #e2e8f0; border-radius: 12px; max-width: 600px; margin: auto;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #e5e2e1; font-size: 26px; font-weight: 700; margin: 0; font-family: 'Manrope', Arial, sans-serif; letter-spacing: -0.5px;">Ahmedabad University Canteen</h1>
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
        from: `"Ahmedabad University Canteen" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Your Login Verification Code – Ahmedabad University Canteen',
        html: `
            <div style="font-family: Arial, sans-serif; background-color: #0c0f18; padding: 20px; color: #e2e8f0; border-radius: 12px; max-width: 600px; margin: auto; box-sizing: border-box;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #e5e2e1; font-size: 24px; font-weight: 700; margin: 0; font-family: 'Manrope', Arial, sans-serif; letter-spacing: -0.5px;">Ahmedabad University Canteen</h1>
                    <p style="color: #a38b88; font-size: 13px; margin-top: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Secure Login Validation</p>
                </div>
                
                <div style="background-color: #1c1b1b; border: 1px solid #554240; border-radius: 16px; padding: 32px 16px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); box-sizing: border-box;">
                    <p style="color: #e5e2e1; font-size: 15px; margin: 0 0 8px 0; font-weight: 500;">Hi <strong style="color: #f0513e;">${name}</strong>,</p>
                    <p style="color: #a38b88; font-size: 14px; margin: 0 0 24px 0;">Enter this code to complete your sign-in:</p>
                    
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                            <td align="center">
                                <div style="background-color: #131313; border: 1px solid rgba(240, 81, 62, 0.4); border-radius: 12px; padding: 16px 12px 16px 18px; display: inline-block;">
                                    <span style="font-size: 30px; font-weight: 800; letter-spacing: 6px; color: #f0513e; font-family: 'Courier New', Courier, monospace; line-height: 1;">${otp}</span>
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

interface EventNotificationData {
    event_name: string;
    event_date: string;
    event_time: string;
    member_count: number;
    staff_name: string;
    staff_email: string;
    total_amount: number;
    items: { item_name: string; quantity: number; price_at_time: number }[];
}

export const sendNewEventNotification = async (data: EventNotificationData): Promise<void> => {
    const adminEmail = process.env.SMTP_USER; // Global university canteen email
    if (!adminEmail) {
        console.warn('[Email] SMTP_USER not set, skipping event notification');
        return;
    }

    const itemRows = data.items.map(i =>
        `<tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #2a2a2a; color: #e5e2e1;">${i.item_name}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #2a2a2a; color: #a38b88; text-align: center;">${i.quantity}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #2a2a2a; color: #a38b88; text-align: right;">₹${(i.price_at_time * i.quantity).toFixed(2)}</td>
        </tr>`
    ).join('');

    const mailOptions = {
        from: `"Ahmedabad University Canteen" <${adminEmail}>`,
        to: adminEmail,
        subject: `🎉 New Event Pre-Order: ${data.event_name}`,
        html: `
            <div style="font-family: Arial, sans-serif; background-color: #0c0f18; padding: 20px; color: #e2e8f0; border-radius: 12px; max-width: 600px; margin: auto; box-sizing: border-box;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #e5e2e1; font-size: 22px; font-weight: 700; margin: 0; font-family: 'Manrope', Arial, sans-serif;">New Event Pre-Order</h1>
                    <p style="color: #f0513e; font-size: 13px; margin-top: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Catering Request</p>
                </div>
                
                <div style="background-color: #1c1b1b; border: 1px solid #554240; border-radius: 16px; padding: 24px 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); box-sizing: border-box;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
                        <tr><td style="color: #a38b88; padding: 4px 0; font-size: 13px;">Event Name</td><td style="color: #e5e2e1; padding: 4px 0; font-weight: 600; text-align: right;">${data.event_name}</td></tr>
                        <tr><td style="color: #a38b88; padding: 4px 0; font-size: 13px;">Date</td><td style="color: #e5e2e1; padding: 4px 0; font-weight: 600; text-align: right;">${data.event_date}</td></tr>
                        <tr><td style="color: #a38b88; padding: 4px 0; font-size: 13px;">Time</td><td style="color: #e5e2e1; padding: 4px 0; font-weight: 600; text-align: right;">${data.event_time}</td></tr>
                        <tr><td style="color: #a38b88; padding: 4px 0; font-size: 13px;">Members</td><td style="color: #e5e2e1; padding: 4px 0; font-weight: 600; text-align: right;">${data.member_count}</td></tr>
                        <tr><td style="color: #a38b88; padding: 4px 0; font-size: 13px;">Staff</td><td style="color: #e5e2e1; padding: 4px 0; font-weight: 600; text-align: right;">${data.staff_name}</td></tr>
                        <tr><td style="color: #a38b88; padding: 4px 0; font-size: 13px;">Contact</td><td style="color: #e5e2e1; padding: 4px 0; font-weight: 600; text-align: right;">${data.staff_email}</td></tr>
                    </table>

                    <div style="border-top: 1px solid #554240; padding-top: 16px;">
                        <p style="color: #f0513e; font-weight: 600; font-size: 14px; margin: 0 0 12px 0;">Food Items</p>
                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                            <tr style="border-bottom: 2px solid #554240;">
                                <th style="padding: 8px 12px; text-align: left; color: #a38b88; font-size: 12px;">Item</th>
                                <th style="padding: 8px 12px; text-align: center; color: #a38b88; font-size: 12px;">Qty</th>
                                <th style="padding: 8px 12px; text-align: right; color: #a38b88; font-size: 12px;">Total</th>
                            </tr>
                            ${itemRows}
                        </table>
                    </div>

                    <div style="border-top: 1px solid #554240; margin-top: 16px; padding-top: 12px; text-align: right;">
                        <span style="color: #a38b88; font-size: 14px;">Grand Total: </span>
                        <span style="color: #f0513e; font-weight: 800; font-size: 20px;">₹${data.total_amount.toFixed(2)}</span>
                    </div>
                </div>
                
                <p style="color: #554240; font-size: 11px; text-align: center; margin-top: 32px; line-height: 1.6;">
                    This is an automated notification from the University Canteen system.
                </p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
};

export const sendEventReminderNotification = async (data: EventNotificationData): Promise<void> => {
    const adminEmail = process.env.SMTP_USER;
    if (!adminEmail) {
        console.warn('[Email] SMTP_USER not set, skipping event reminder');
        return;
    }

    const itemRows = data.items.map(i =>
        `<tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #2a2a2a; color: #e5e2e1;">${i.item_name}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #2a2a2a; color: #a38b88; text-align: center;">${i.quantity}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #2a2a2a; color: #a38b88; text-align: right;">₹${(i.price_at_time * i.quantity).toFixed(2)}</td>
        </tr>`
    ).join('');

    const mailOptions = {
        from: `"Ahmedabad University Canteen" <${adminEmail}>`,
        to: adminEmail,
        subject: `⏰ Reminder: Upcoming Event in 2 Days - ${data.event_name}`,
        html: `
            <div style="font-family: Arial, sans-serif; background-color: #0c0f18; padding: 20px; color: #e2e8f0; border-radius: 12px; max-width: 600px; margin: auto; box-sizing: border-box;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #e5e2e1; font-size: 22px; font-weight: 700; margin: 0; font-family: 'Manrope', Arial, sans-serif;">Event Reminder</h1>
                    <p style="color: #f0513e; font-size: 13px; margin-top: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Action Required in 48 Hours</p>
                </div>
                
                <div style="background-color: #1c1b1b; border: 1px solid #554240; border-radius: 16px; padding: 24px 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); box-sizing: border-box;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
                        <tr><td style="color: #a38b88; padding: 4px 0; font-size: 13px;">Event Name</td><td style="color: #e5e2e1; padding: 4px 0; font-weight: 600; text-align: right;">${data.event_name}</td></tr>
                        <tr><td style="color: #a38b88; padding: 4px 0; font-size: 13px;">Date</td><td style="color: #e5e2e1; padding: 4px 0; font-weight: 600; text-align: right;">${data.event_date}</td></tr>
                        <tr><td style="color: #a38b88; padding: 4px 0; font-size: 13px;">Time</td><td style="color: #e5e2e1; padding: 4px 0; font-weight: 600; text-align: right;">${data.event_time}</td></tr>
                        <tr><td style="color: #a38b88; padding: 4px 0; font-size: 13px;">Members</td><td style="color: #e5e2e1; padding: 4px 0; font-weight: 600; text-align: right;">${data.member_count}</td></tr>
                        <tr><td style="color: #a38b88; padding: 4px 0; font-size: 13px;">Staff</td><td style="color: #e5e2e1; padding: 4px 0; font-weight: 600; text-align: right;">${data.staff_name}</td></tr>
                        <tr><td style="color: #a38b88; padding: 4px 0; font-size: 13px;">Contact</td><td style="color: #e5e2e1; padding: 4px 0; font-weight: 600; text-align: right;">${data.staff_email}</td></tr>
                    </table>

                    <div style="border-top: 1px solid #554240; padding-top: 16px;">
                        <p style="color: #f0513e; font-weight: 600; font-size: 14px; margin: 0 0 12px 0;">Food Items</p>
                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                            <tr style="border-bottom: 2px solid #554240;">
                                <th style="padding: 8px 12px; text-align: left; color: #a38b88; font-size: 12px;">Item</th>
                                <th style="padding: 8px 12px; text-align: center; color: #a38b88; font-size: 12px;">Qty</th>
                                <th style="padding: 8px 12px; text-align: right; color: #a38b88; font-size: 12px;">Total</th>
                            </tr>
                            ${itemRows}
                        </table>
                    </div>

                    <div style="border-top: 1px solid #554240; margin-top: 16px; padding-top: 12px; text-align: right;">
                        <span style="color: #a38b88; font-size: 14px;">Grand Total: </span>
                        <span style="color: #f0513e; font-weight: 800; font-size: 20px;">₹${data.total_amount.toFixed(2)}</span>
                    </div>
                </div>
                
                <p style="color: #554240; font-size: 11px; text-align: center; margin-top: 32px; line-height: 1.6;">
                    This is an automated notification from the University Canteen system.
                </p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
};

