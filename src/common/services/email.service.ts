import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { Transporter } from "nodemailer";

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>("BREVO_SMTP_HOST");
    const port = this.configService.get<number>("BREVO_SMTP_PORT");
    const user = this.configService.get<string>("BREVO_SMTP_USER");
    const pass = this.configService.get<string>("BREVO_SMTP_PASS");

    this.logger.log(
      `Initializing email service with host: ${host}, port: ${port}, user: ${user}`
    );

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false, // true for 465, false for other ports like 587
      auth: {
        user,
        pass,
      },
    });

    // Verify connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error("Email transporter verification failed:", error);
      } else {
        this.logger.log("✅ Email server is ready to send messages");
      }
    });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const fromName =
        this.configService.get<string>("FROM_NAME") || "Ortus Finance";
      const fromEmail =
        this.configService.get<string>("FROM_EMAIL") ||
        "noreply@ortusfinance.com";

      this.logger.log(
        `📧 Attempting to send email to ${options.to} from ${fromEmail}`
      );

      const mailOptions = {
        from: {
          name: fromName,
          address: fromEmail,
        },
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `✅ Email sent successfully to ${options.to}. MessageId: ${info.messageId}`
      );
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to send email to ${options.to}:`, error);
      throw error;
    }
  }

  async sendOtpEmail(
    email: string,
    otp: string,
    name?: string
  ): Promise<boolean> {
    const subject = "Verify Your Email - Ortus Finance";
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .otp-box { background-color: white; border: 2px solid #4F46E5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; border-radius: 8px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            .warning { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Ortus Finance</h1>
            </div>
            <div class="content">
              <h2>Email Verification</h2>
              ${name ? `<p>Hello ${name},</p>` : "<p>Hello,</p>"}
              <p>Thank you for registering with Ortus Finance. Please use the following OTP to verify your email address:</p>
              
              <div class="otp-box">${otp}</div>
              
              <p><strong>This OTP is valid for 10 minutes.</strong></p>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong> Never share this OTP with anyone. Ortus Finance will never ask for your OTP via phone or email.
              </div>
              
              <p>If you didn't request this verification, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Ortus Finance. All rights reserved.</p>
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `Your Ortus Finance verification OTP is: ${otp}. This OTP is valid for 10 minutes.`,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    name?: string
  ): Promise<boolean> {
    const resetUrl = `${this.configService.get("APP_URL")}/reset-password?token=${resetToken}`;
    const subject = "Reset Your Password - Ortus Finance";

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            .warning { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Ortus Finance</h1>
            </div>
            <div class="content">
              <h2>Password Reset Request</h2>
              ${name ? `<p>Hello ${name},</p>` : "<p>Hello,</p>"}
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              
              <a href="${resetUrl}" class="button">Reset Password</a>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #4F46E5;">${resetUrl}</p>
              
              <p><strong>This link will expire in 1 hour.</strong></p>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong> If you didn't request a password reset, please ignore this email and ensure your account is secure.
              </div>
            </div>
            <div class="footer">
              <p>&copy; 2025 Ortus Finance. All rights reserved.</p>
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `Reset your Ortus Finance password by visiting: ${resetUrl}. This link expires in 1 hour.`,
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    const subject = "Welcome to Ortus Finance!";

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Ortus Finance! 🎉</h1>
            </div>
            <div class="content">
              <h2>Hello ${name}!</h2>
              <p>Thank you for joining Ortus Finance. We're excited to have you on board!</p>
              <p>With Ortus Finance, you can:</p>
              <ul>
                <li>Invest in various financial instruments</li>
                <li>Track your portfolio performance</li>
                <li>Manage SIP investments</li>
                <li>Earn rewards through our token system</li>
              </ul>
              <p>To get started, complete your KYC verification to unlock all features.</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Ortus Finance. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `Welcome to Ortus Finance, ${name}! Start investing today.`,
    });
  }
}
