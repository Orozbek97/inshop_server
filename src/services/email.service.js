const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Проверка подключения
transporter.verify(function (error, success) {
  if (error) {
    logger.error('SMTP connection error', { error });
  } else {
    logger.info('SMTP server is ready to send emails');
  }
});

async function sendPasswordResetEmail(email, resetToken) {
  try {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"inshop" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Сброс пароля на inshop.kg',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #060607ff;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background-color: #f9fafb;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #4f46e5;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .button:hover {
              background-color: #4338ca;
            }
            .footer {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              font-size: 12px;
              color: #6b7280;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>inshop</h1>
            </div>
            <div class="content">
              <h2>Сброс пароля</h2>
              <p>Здравствуйте!</p>
              <p>Вы запросили сброс пароля для вашего аккаунта на inshop.kg.</p>
              <p>Для сброса пароля нажмите на кнопку ниже:</p>
              <div style="text-align: center; text-decoration: none; text: white;">
                <a href="${resetUrl}" class="button">Сбросить пароль</a>
              </div>
              <p>Или скопируйте и вставьте эту ссылку в браузер:</p>
              <p style="word-break: break-all; color: #4f46e5;">${resetUrl}</p>
              <p><strong>Важно:</strong> Ссылка действительна в течение 1 часа. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
            </div>
            <div class="footer">
              <p>© 2026 inshop.kg</p>
              <p>Это автоматическое письмо, пожалуйста, не отвечайте на него.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Сброс пароля на inshop.kg
        
        Здравствуйте!
        
        Вы запросили сброс пароля для вашего аккаунта на inshop.kg.
        
        Для сброса пароля перейдите по ссылке:
        ${resetUrl}
        
        Важно: Ссылка действительна в течение 1 часа. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.
        
        © 2026 inshop.kg
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('Password reset email sent', { messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Error sending password reset email', { error });
    throw error;
  }
}

module.exports = {
  sendPasswordResetEmail,
};

