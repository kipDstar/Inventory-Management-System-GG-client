// src/utils/email.js
// Utility for sending email reports (Node.js, using nodemailer)

const nodemailer = require('nodemailer');

async function sendReport({ to, subject, text, attachments }) {
  // Configure your SMTP transport here
  const transporter = nodemailer.createTransport({
    // Example: Gmail SMTP (replace with your provider)
    service: 'gmail',
    auth: {
      user: 'your-email@gmail.com',
      pass: 'your-app-password',
    },
  });

  const mailOptions = {
    from: 'your-email@gmail.com',
    to,
    subject,
    text,
    attachments, // [{ filename, path }]
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendReport };
