import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Load environment variables
dotenv.config();

const mailHost = process.env.MAIL_HOST || 'smtp.gmail.com';
const mailPort = parseInt(process.env.MAIL_PORT || '587', 10);
const mailUsername = process.env.MAIL_USERNAME;
const mailPassword = process.env.MAIL_PASSWORD;

console.log('--- Mail Configuration ---');
console.log('Host:', mailHost);
console.log('Port:', mailPort);
console.log('Username:', mailUsername);
console.log('Password (masked):', mailPassword ? '*'.repeat(mailPassword.length) : '(not set)');
console.log('-------------------------');

if (!mailUsername || !mailPassword) {
  console.error('Error: MAIL_USERNAME and MAIL_PASSWORD must be set in your .env file.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: mailHost,
  port: mailPort,
  secure: mailPort === 465,
  auth: {
    user: mailUsername,
    pass: mailPassword,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

async function main() {
  try {
    console.log('Attempting to send test email to:', mailUsername);
    const info = await transporter.sendMail({
      from: mailUsername,
      to: mailUsername,
      subject: 'IIoT Portal SMTP Test Connection',
      html: `
        <h3>SMTP Connection Successful!</h3>
        <p>If you received this email, your SMTP configuration in the IIoT Portal backend is working correctly.</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
      `,
    });
    console.log('✅ Success! Message sent successfully.');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('❌ Failed to send mail:');
    console.error(error);
  }
}

main();
