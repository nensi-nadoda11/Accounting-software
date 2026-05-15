import nodemailer from "nodemailer";

import { env } from "../config/env";
import { logger } from "../config/logger";
import { AppError } from "../utils/app-error";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS
  }
});

class EmailService {
  private readonly from = `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM_ADDRESS}>`;
  private readonly isPlaceholderConfig =
    env.SMTP_HOST === "smtp.example.com" ||
    env.SMTP_USER === "your_smtp_username" ||
    env.SMTP_PASS === "your_smtp_password";

  private shouldUseDevFallback(): boolean {
    return env.NODE_ENV !== "production" && this.isPlaceholderConfig;
  }

  private logDevEmailFallback(data: {
    to: string;
    subject: string;
    text: string;
  }): void {
    logger.warn(
      `[DEV EMAIL FALLBACK] Real SMTP not configured. Email not sent.\nTo: ${data.to}\nSubject: ${data.subject}\nContent: ${data.text}`
    );
  }

  private async sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
    if (this.shouldUseDevFallback()) {
      this.logDevEmailFallback({ to, subject, text });
      return;
    }

    try {
      await transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
        text
      });
    } catch (error) {
      if (env.NODE_ENV !== "production") {
        logger.warn("[DEV EMAIL FALLBACK] SMTP send failed. Email content logged instead.", error);
        this.logDevEmailFallback({ to, subject, text });
        return;
      }

      throw new AppError("Unable to send email at the moment. Please try again later.", 503);
    }
  }

  public async sendOtpEmail(to: string, otp: string, purpose: string, expiryMinutes: number): Promise<void> {
    await this.sendEmail(
      to,
      "Verify your account",
      `<p>Hello,</p><p>Your ${purpose.replace("_", " ")} OTP is <strong>${otp}</strong>.</p><p>This OTP expires in ${expiryMinutes} minutes.</p>`,
      `Your ${purpose} OTP is ${otp}. It expires in ${expiryMinutes} minutes.`
    );
  }

  public async sendInviteEmail(to: string, fullName: string, inviteLink: string, role: string, expiryHours: number): Promise<void> {
    await this.sendEmail(
      to,
      "You have been invited",
      `<p>Hello ${fullName},</p><p>You have been invited as <strong>${role}</strong>.</p><p>Accept your invite here: <a href="${inviteLink}">${inviteLink}</a></p><p>This invite expires in ${expiryHours} hours.</p>`,
      `Hello ${fullName}, you have been invited as ${role}. Accept here: ${inviteLink}. Expires in ${expiryHours} hours.`
    );
  }

  public async sendPasswordResetEmail(to: string, otp: string, expiryMinutes: number): Promise<void> {
    await this.sendEmail(
      to,
      "Password reset OTP",
      `<p>Hello,</p><p>Your password reset OTP is <strong>${otp}</strong>.</p><p>This OTP expires in ${expiryMinutes} minutes.</p>`,
      `Your password reset OTP is ${otp}. It expires in ${expiryMinutes} minutes.`
    );
  }
}

export const emailService = new EmailService();
