import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class SmtpMailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_LOGIN,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    try {
      const response = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@sopnilsaaj.com',
        to,
        subject,
        html,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      console.log('EMAIL ERROR:', error);

      throw new HttpException(
        'Failed to send email',
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
