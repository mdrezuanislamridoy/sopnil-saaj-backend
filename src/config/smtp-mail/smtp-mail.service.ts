import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class SmtpMailService {
  private resend: Resend;

  constructor() {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is missing in environment variables');
    }

    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendMail(to: string, subject: string, html: string) {
    try {
      const response = await this.resend.emails.send({
        from: "Sopnil Saaj <" + (process.env.EMAIL_FROM || 'onboarding@resend.dev') + '>',
        to,
        subject,
        html,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      console.log('RESEND ERROR:', error);

      throw new HttpException(
        'Failed to send email',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 🔥 Optional helper (OTP use case)
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
