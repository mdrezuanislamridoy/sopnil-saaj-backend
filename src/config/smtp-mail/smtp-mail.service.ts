import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class SmtpMailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    const host = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_LOGIN;
    const pass = process.env.SMTP_PASSWORD;

    console.log('[SmtpMailService] Initializing with:', {
      host,
      port,
      user: user ? user.substring(0, 5) + '***' : 'NOT SET',
      pass: pass ? 'SET' : 'NOT SET',
    });

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: {
        user,
        pass,
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    try {
      console.log('[SmtpMailService] Attempting to send email:', {
        to,
        subject,
      });

      const response = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@sopnilsaaj.com',
        to,
        subject,
        html,
      });

      console.log('[SmtpMailService] Email sent successfully:', {
        messageId: response.messageId,
        response: response.response,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error: any) {
      console.error('[SmtpMailService] Email sending failed:', {
        error: error.message,
        code: error.code,
        command: error.command,
        to,
        subject,
      });

      throw new HttpException(
        'Failed to send email: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async sendOtp(to: string, otp: string) {
    const html = `
      <div style="font-family: Arial; padding: 20px;">
        <h2>Your OTP Code</h2>
        <p style="font-size: 18px;">${otp}</p>
        <p>This code will expire soon.</p>
      </div>
    `;

    return this.sendMail(to, 'OTP Verification Code', html);
  }
}
