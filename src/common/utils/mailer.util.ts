import nodemailer from 'nodemailer';
import { env } from '../../config/env';

let transporter: nodemailer.Transporter | null = null;

const getTransporter = (): nodemailer.Transporter => {
  if (!transporter) {
    const config: any = {
      host: env.MAIL_HOST,
      port: env.MAIL_PORT,
      secure: env.MAIL_PORT === 465,
      tls: {
        rejectUnauthorized: false, // Mirroring source settings
      },
    };

    if (env.MAIL_USERNAME && env.MAIL_PASSWORD) {
      config.auth = {
        user: env.MAIL_USERNAME,
        pass: env.MAIL_PASSWORD,
      };
    }

    transporter = nodemailer.createTransport(config);
  }
  return transporter;
};

/**
 * Sends a generic HTML email.
 */
export const sendMail = async (
  to: string,
  subject: string,
  html: string,
  cc?: string
): Promise<any> => {
  try {
    const mailTransporter = getTransporter();
    const mailOptions = {
      from: env.MAIL_USERNAME || 'ifb_iot@ifbglobal.com',
      to,
      cc,
      subject,
      html,
    };
    return await mailTransporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Failed to send mail:', error);
    throw error;
  }
};

/**
 * Sends OTP verification email.
 */
export const sendOtpMail = async (email: string, otp: string): Promise<any> => {
  const subject = 'Your OTP for IIoT Portal';
  const html = `
    <p>Dear user, the OTP for resetting your password is:</p>
    <h3>${otp}</h3>
    <p>It is valid for 10 minutes.</p>
  `;
  return sendMail(email, subject, html);
};

/**
 * Sends Password Changed confirmation email.
 */
export const sendPasswordChangedMail = async (email: string): Promise<any> => {
  const subject = 'Password Changed Successfully - IIoT Portal';
  const html = `
    <p>Dear user, your password has been successfully changed.</p>
    <p>If you did not initiate this change, please contact your administrator immediately.</p>
  `;
  return sendMail(email, subject, html);
};
