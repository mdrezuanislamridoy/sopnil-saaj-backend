import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

@Injectable()
export class SmtpMailService {
  private transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo>;

  constructor() {
   this.transporter = nodemailer.createTransport({
     host: 'smtp-relay.brevo.com',
     port: 587,
     secure: false,
     auth: {
       user: process.env.MAIL_USER,
       pass: process.env.MAIL_PASS,
     },
     connectionTimeout: 10000, // 🔥 important
     greetingTimeout: 10000,
     socketTimeout: 10000,
   });
  }

  async sendMail(to: string, subject: string, html: string) {
    try {
      return await this.transporter.sendMail({
        from: `"My App" <${process.env.MAIL_USER}>`,
        to,
        subject,
        html,
      });
    } catch (error) {
      console.log('BREVO ERROR:', error);

      throw new HttpException(
        'Failed to send email',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
