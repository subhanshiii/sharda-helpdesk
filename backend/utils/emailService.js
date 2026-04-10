const { Resend } = require('resend');
const logger = require('./logger');

// FIXED: support SMTP for Gmail delivery while keeping Resend as a fallback.
let nodemailer = null;
try {
  // FIXED: load nodemailer only when available so local installs without it do not crash at require time.
  nodemailer = require('nodemailer');
} catch (error) {
  nodemailer = null;
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const getEmailUser = () => String(process.env.EMAIL_USER || '').trim();
const getEmailPass = () => String(process.env.EMAIL_PASS || '').replace(/\s+/g, '').trim();
const getFromEmail = () => String(process.env.FROM_EMAIL || process.env.EMAIL_FROM || getEmailUser() || 'onboarding@resend.dev').trim();
const APP_NAME = 'Sharda University Helpdesk';

const getSmtpConfig = () => {
  // FIXED: allow Gmail SMTP/app-password delivery through env config.
  const emailUser = getEmailUser();
  const emailPass = getEmailPass();

  if (
    !emailUser ||
    !emailPass ||
    emailUser === 'your_email@gmail.com' ||
    emailPass === 'your_app_password' ||
    emailPass === 'your_16_char_app_password'
  ) {
    return null;
  }

  return {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT || 587),
    secure: Number(process.env.EMAIL_PORT || 587) === 465,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };
};

const getTransporter = () => {
  const smtpConfig = getSmtpConfig();
  if (!smtpConfig || !nodemailer) {
    return null;
  }

  return nodemailer.createTransport(smtpConfig);
};

const sendEmail = async ({ to, subject, html }) => {
  const transporter = getTransporter();
  const smtpConfig = getSmtpConfig();

  logger.info('Email delivery attempt', {
    to,
    subject,
    smtpConfigured: Boolean(smtpConfig),
    smtpUser: smtpConfig ? getEmailUser() : null,
    smtpPasswordPresent: Boolean(getEmailPass()),
    fromEmail: getFromEmail(),
    resendConfigured: Boolean(resend),
    nodemailerAvailable: Boolean(nodemailer),
  });

  if (transporter) {
    // FIXED: prefer SMTP when configured so Gmail inbox delivery can work with app passwords.
    try {
      const info = await transporter.sendMail({
        from: getFromEmail(),
        to,
        subject,
        html,
      });
      logger.info('Email sent via SMTP', { to, subject, messageId: info.messageId });
      return { success: true, provider: 'smtp', messageId: info.messageId };
    } catch (error) {
      logger.error('SMTP email failed', {
        to,
        subject,
        smtpUser: getEmailUser(),
        fromEmail: getFromEmail(),
        error: error.message,
      });
      throw error;
    }
  }

  if (resend) {
    // FIXED: keep Resend as a working fallback when SMTP is not configured.
    const response = await resend.emails.send({
      from: getFromEmail(),
      to,
      subject,
      html,
    });
    if (response?.error) {
      logger.error('Resend email failed', {
        to,
        subject,
        error: response.error,
      });
      throw new Error(response.error.message || 'Resend failed to deliver the email');
    }

    logger.info('Email sent via Resend', { to, subject, messageId: response?.data?.id });
    return { success: true, provider: 'resend', messageId: response?.data?.id || null };
  }

  throw new Error('No email provider configured');
};

exports.sendEmailVerificationEmail = async ({ toEmail, userName, verificationLink }) => {
  try {
    await sendEmail({
      to: toEmail,
      subject: `Verify Your Email — ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f0f4ff;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(30,58,138,0.1);">
                <tr>
                  <td style="background:linear-gradient(135deg,#0c1654,#1e3a8a,#1e40af);padding:32px 40px;text-align:center;">
                    <h1 style="color:white;margin:0;font-size:22px;font-weight:800;">Sharda University</h1>
                    <p style="color:rgba(147,197,253,0.8);margin:4px 0 0;font-size:13px;">Account Verification</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px;">
                    <h2 style="color:#1e293b;font-size:20px;font-weight:700;margin:0 0 10px;">Verify Your University Email</h2>
                    <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 22px;">
                      Hi <strong>${userName}</strong>, verify your email address to continue with account approval and password recovery.
                    </p>
                    <div style="text-align:center;margin:30px 0;">
                      <a href="${verificationLink}" style="display:inline-block;background:linear-gradient(135deg,#1e40af,#2563eb);color:white;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;">
                        Verify Email →
                      </a>
                    </div>
                    <p style="color:#94a3b8;font-size:12px;text-align:center;">
                      This verification link expires in 24 hours.<br/>
                      <a href="${verificationLink}" style="color:#2563eb;word-break:break-all;">${verificationLink}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

exports.sendPasswordResetEmail = async ({ toEmail, userName, resetLink }) => {
  try {
    await sendEmail({
      to: toEmail,
      subject: `Reset Your Password — ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1"/>
        </head>
        <body style="margin:0;padding:0;background:#f0f4ff;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(30,58,138,0.1);">
                <tr>
                  <td style="background:linear-gradient(135deg,#0c1654,#1e3a8a,#1e40af);padding:32px 40px;text-align:center;">
                    <div style="width:4px;height:3px;background:linear-gradient(90deg,#f59e0b,#ec4899,#06b6d4,#10b981);margin-bottom:20px;"></div>
                    <h1 style="color:white;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Sharda University</h1>
                    <p style="color:rgba(147,197,253,0.8);margin:4px 0 0;font-size:13px;">Helpdesk Portal</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px;">
                    <h2 style="color:#1e293b;font-size:20px;font-weight:700;margin:0 0 8px;">Reset Your Password 🔐</h2>
                    <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 24px;">
                      Hi <strong>${userName}</strong>, we received a request to reset your helpdesk account password.
                      Click the button below to set a new password.
                    </p>
                    <div style="text-align:center;margin:32px 0;">
                      <a href="${resetLink}"
                         style="display:inline-block;background:linear-gradient(135deg,#1e40af,#2563eb);color:white;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;box-shadow:0 4px 14px rgba(30,58,138,0.35);">
                        Reset My Password →
                      </a>
                    </div>
                    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin:24px 0;">
                      <p style="color:#92400e;font-size:13px;margin:0;">
                        ⏰ <strong>This link expires in 15 minutes.</strong> If you didn't request this, ignore this email.
                      </p>
                    </div>
                    <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;text-align:center;">
                      If the button doesn't work, copy this link:<br/>
                      <a href="${resetLink}" style="color:#2563eb;word-break:break-all;">${resetLink}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8faff;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
                    <p style="color:#94a3b8;font-size:12px;margin:0;">
                      © ${new Date().getFullYear()} Sharda University Helpdesk · Greater Noida, India
                    </p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

exports.sendTicketCreatedEmail = async ({ toEmail, userName, ticketId, ticketTitle, ticketLink }) => {
  try {
    await sendEmail({
      to: toEmail,
      subject: `Ticket ${ticketId} Created — ${APP_NAME}`,
      html: `
        <!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4ff;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(30,58,138,0.1);">
                <tr><td style="background:linear-gradient(135deg,#0c1654,#1e3a8a);padding:28px 40px;text-align:center;">
                  <h1 style="color:white;margin:0;font-size:20px;font-weight:800;">Sharda University Helpdesk</h1>
                </td></tr>
                <tr><td style="padding:36px 40px;">
                  <h2 style="color:#1e293b;font-size:18px;margin:0 0 12px;">✅ Ticket Submitted Successfully</h2>
                  <p style="color:#64748b;font-size:14px;line-height:1.6;">Hi <strong>${userName}</strong>, your support ticket has been received.</p>
                  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;margin:20px 0;">
                    <p style="margin:0 0 4px;color:#1e40af;font-weight:700;font-size:13px;">Ticket ID: ${ticketId}</p>
                    <p style="margin:0;color:#1e293b;font-size:15px;font-weight:600;">${ticketTitle}</p>
                  </div>
                  <div style="text-align:center;margin:28px 0;">
                    <a href="${ticketLink}" style="display:inline-block;background:linear-gradient(135deg,#1e40af,#2563eb);color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px;">View Ticket →</a>
                  </div>
                </td></tr>
                <tr><td style="background:#f8faff;padding:16px 40px;text-align:center;border-top:1px solid #e2e8f0;">
                  <p style="color:#94a3b8;font-size:12px;margin:0;">© ${new Date().getFullYear()} Sharda University Helpdesk</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body></html>
      `,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

exports.sendEmailNow = sendEmail;
