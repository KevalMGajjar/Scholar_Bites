import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { getEmailConfig } from '../config/emailConfig';

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
    const { systemEmail } = await getEmailConfig();
    const mailOptions = {
        from: `"Ahmedabad University Canteen" <${systemEmail}>`,
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
    const { systemEmail } = await getEmailConfig();
    const mailOptions = {
        from: `"Ahmedabad University Canteen" <${systemEmail}>`,
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
    const { systemEmail, adminEmail } = await getEmailConfig();
    if (!systemEmail || !adminEmail) {
        console.warn('[Email] Email config not set, skipping event notification');
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
        from: `"Ahmedabad University Canteen" <${systemEmail}>`,
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
                
                <div style="text-align: center; margin-top: 24px;">
                    <a href="${process.env.ADMIN_URL || 'http://localhost:3000'}/admin" 
                       style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; text-decoration: none; padding: 14px 36px; border-radius: 12px; font-weight: 700; font-size: 14px; letter-spacing: 0.5px; box-shadow: 0 4px 20px rgba(16,185,129,0.3);">
                        ✅ Review & Approve Request
                    </a>
                </div>

                <p style="color: #554240; font-size: 11px; text-align: center; margin-top: 32px; line-height: 1.6;">
                    This is an automated notification from the University Canteen system.<br/>
                    Log in to the Admin Panel → Events → Requests tab to approve or reject.
                </p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
};

export const sendEventReminderNotification = async (data: EventNotificationData): Promise<void> => {
    const { systemEmail, adminEmail } = await getEmailConfig();
    if (!systemEmail || !adminEmail) {
        console.warn('[Email] Email config not set, skipping event reminder');
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
        from: `"Ahmedabad University Canteen" <${systemEmail}>`,
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

interface VoucherEmailData {
    to: string;
    code: string;
    amount: number;
    deanName: string;
    schoolName: string;
    expiresAt: Date;
}

export const sendVoucherEmail = async (data: VoucherEmailData): Promise<void> => {
    const { systemEmail: fromEmail } = await getEmailConfig();
    if (!fromEmail) {
        console.warn('[Email] System email not configured, skipping voucher email');
        return;
    }

    const expiryDate = new Date(data.expiresAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    const mailOptions = {
        from: `"Ahmedabad University Canteen" <${fromEmail}>`,
        to: data.to,
        subject: `🎟️ Your Food Voucher: ${data.code} — ₹${data.amount.toFixed(2)}`,
        html: `
            <div style="font-family: Arial, sans-serif; background-color: #0c0f18; padding: 20px; color: #e2e8f0; border-radius: 12px; max-width: 600px; margin: auto; box-sizing: border-box;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #e5e2e1; font-size: 22px; font-weight: 700; margin: 0; font-family: 'Manrope', Arial, sans-serif;">Ahmedabad University Canteen</h1>
                    <p style="color: #f0513e; font-size: 13px; margin-top: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Food Voucher Issued</p>
                </div>
                
                <div style="background-color: #1c1b1b; border: 1px solid #554240; border-radius: 16px; padding: 32px 16px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); box-sizing: border-box;">
                    <p style="color: #a38b88; font-size: 14px; margin: 0 0 8px 0;">A food voucher has been issued to you by</p>
                    <p style="color: #e5e2e1; font-size: 16px; margin: 0 0 24px 0; font-weight: 600;">${data.deanName} — ${data.schoolName}</p>
                    
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                            <td align="center">
                                <div style="background-color: #131313; border: 1px solid rgba(240, 81, 62, 0.4); border-radius: 12px; padding: 18px 16px; display: inline-block; max-width: 90%; box-sizing: border-box;">
                                    <span style="font-size: 26px; font-weight: 800; letter-spacing: 5px; color: #f0513e; font-family: 'Courier New', Courier, monospace; line-height: 1; word-break: break-all;">${data.code}</span>
                                </div>
                            </td>
                        </tr>
                    </table>

                    <div style="margin-top: 24px; padding: 16px; background-color: #131313; border-radius: 12px; border: 1px solid #2a2a2a;">
                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                                <td style="color: #a38b88; padding: 6px 0; font-size: 13px;">Voucher Value</td>
                                <td style="color: #f0513e; padding: 6px 0; font-weight: 800; text-align: right; font-size: 22px;">₹${data.amount.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td style="color: #a38b88; padding: 6px 0; font-size: 13px;">Valid Until</td>
                                <td style="color: #e5e2e1; padding: 6px 0; font-weight: 600; text-align: right;">${expiryDate}</td>
                            </tr>
                        </table>
                    </div>
                </div>

                <div style="background-color: #1c1b1b; border: 1px solid #554240; border-radius: 12px; padding: 20px; margin-top: 16px; box-sizing: border-box;">
                    <p style="color: #f0513e; font-weight: 700; font-size: 13px; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px;">Usage Policy</p>
                    <ul style="color: #a38b88; font-size: 12px; line-height: 2; padding-left: 16px; margin: 0;">
                        <li>This voucher is <strong style="color: #e5e2e1;">strictly for official university event catering</strong> purposes only.</li>
                        <li><strong style="color: #e5e2e1;">Do not use</strong> this code for personal food orders.</li>
                        <li>Redeem via the Scholar Bites app → Wallet → Redeem Voucher.</li>
                        <li>Each voucher can only be redeemed <strong style="color: #e5e2e1;">once</strong>.</li>
                        <li>Unused vouchers will automatically expire on <strong style="color: #e5e2e1;">${expiryDate}</strong>.</li>
                        <li>Misuse may result in disciplinary action.</li>
                    </ul>
                </div>

                <p style="color: #554240; font-size: 11px; text-align: center; margin-top: 24px; line-height: 1.6;">
                    This is an automated notification from the University Canteen system.<br/>
                    If you did not expect this voucher, please contact your department dean.
                </p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
};

interface CateringRejectionData {
    to: string;
    staffName: string;
    eventName: string;
    eventDate: string;
    rejectionReason: string;
    totalAmount: number;
}

export const sendCateringRejectionEmail = async (data: CateringRejectionData): Promise<void> => {
    const { systemEmail, adminEmail } = await getEmailConfig();
    if (!systemEmail) {
        console.warn('[Email] System email not configured, skipping rejection email');
        return;
    }

    const mailOptions = {
        from: `"Ahmedabad University Canteen" <${systemEmail}>`,
        to: data.to,
        subject: `❌ Catering Request Rejected: ${data.eventName}`,
        html: `
            <div style="font-family: Arial, sans-serif; background-color: #0c0f18; padding: 20px; color: #e2e8f0; border-radius: 12px; max-width: 600px; margin: auto; box-sizing: border-box;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #e5e2e1; font-size: 22px; font-weight: 700; margin: 0;">Catering Request Update</h1>
                    <p style="color: #ef4444; font-size: 13px; margin-top: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Request Rejected</p>
                </div>
                
                <div style="background-color: #1c1b1b; border: 1px solid #554240; border-radius: 16px; padding: 24px 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); box-sizing: border-box;">
                    <p style="color: #e5e2e1; font-size: 15px; margin: 0 0 16px 0;">Hi <strong style="color: #f0513e;">${data.staffName}</strong>,</p>
                    <p style="color: #a38b88; font-size: 14px; margin: 0 0 20px 0;">Your catering request has been reviewed and unfortunately could not be approved.</p>
                    
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
                        <tr><td style="color: #a38b88; padding: 6px 0; font-size: 13px;">Event</td><td style="color: #e5e2e1; padding: 6px 0; font-weight: 600; text-align: right;">${data.eventName}</td></tr>
                        <tr><td style="color: #a38b88; padding: 6px 0; font-size: 13px;">Date</td><td style="color: #e5e2e1; padding: 6px 0; font-weight: 600; text-align: right;">${data.eventDate}</td></tr>
                        <tr><td style="color: #a38b88; padding: 6px 0; font-size: 13px;">Amount</td><td style="color: #10b981; padding: 6px 0; font-weight: 700; text-align: right;">₹${data.totalAmount.toFixed(2)} (Refunded)</td></tr>
                    </table>

                    <div style="background-color: #131313; border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 16px; margin-top: 12px;">
                        <p style="color: #ef4444; font-weight: 700; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Reason for Rejection</p>
                        <p style="color: #e5e2e1; font-size: 14px; margin: 0; line-height: 1.6;">${data.rejectionReason}</p>
                    </div>
                </div>

                <div style="background-color: #1c1b1b; border: 1px solid #554240; border-radius: 12px; padding: 16px; margin-top: 16px; box-sizing: border-box;">
                    <p style="color: #a38b88; font-size: 12px; margin: 0; line-height: 1.8;">
                        💰 The amount of <strong style="color: #10b981;">₹${data.totalAmount.toFixed(2)}</strong> has been refunded to your wallet.<br/>
                        📧 For any queries, contact the admin at <strong style="color: #e5e2e1;">${adminEmail}</strong>
                    </p>
                </div>

                <p style="color: #554240; font-size: 11px; text-align: center; margin-top: 24px; line-height: 1.6;">
                    This is an automated notification from the University Canteen system.
                </p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
};
