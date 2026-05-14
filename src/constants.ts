import { EmailTemplate } from './types';

export const PHISHING_TEMPLATES: EmailTemplate[] = [
  {
    name: "Password Reset Policy",
    subject: "Action Required: Your password expires in 24 hours",
    senderName: "IT Security Support",
    content: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px;">
        <h2 style="color: #1e293b;">Password Expiration Notice</h2>
        <p>Your corporate password is set to expire in 24 hours due to our updated security policy.</p>
        <p>To avoid a lockout and maintain access to your applications, please update your password immediately using the secure portal below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{TRACKING_LINK}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Update Password Now</a>
        </div>
        <p style="color: #64748b; font-size: 14px;">If you do not update your password within the next 24 hours, your account will be automatically disabled for your protection.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="font-size: 12px; color: #94a3b8;">This is an automated system message. Please do not reply.</p>
      </div>
    `
  },
  {
    name: "Mailbox Full Alert",
    subject: "High Priority: Your Mailbox is 98% Full",
    senderName: "Outlook Admin",
    content: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fee2e2; padding: 20px; border-radius: 8px;">
        <div style="color: #dc2626; font-weight: bold; margin-bottom: 10px;">⚠️ STORAGE WARNING</div>
        <p>Your mailbox storage has reached its limit. You may be unable to send or receive emails until you increase your quota.</p>
        <p>To prevent incoming email bounces, please click the button below to expand your storage capacity (10GB additional free):</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{TRACKING_LINK}}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Increase Mailbox Capacity</a>
        </div>
        <p style="font-size: 12px; color: #94a3b8;">Administrator - Global IT Services</p>
      </div>
    `
  }
];
