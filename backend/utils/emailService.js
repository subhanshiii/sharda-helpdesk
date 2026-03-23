const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const APP_NAME = 'Sharda University Helpdesk';

// ── Forgot Password Email ──────────────────────────────
exports.sendPasswordResetEmail = async ({ toEmail, userName, resetLink }) => {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
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
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#0c1654,#1e3a8a,#1e40af);padding:32px 40px;text-align:center;">
                    <div style="width:4px;height:3px;background:linear-gradient(90deg,#f59e0b,#ec4899,#06b6d4,#10b981);margin-bottom:20px;"></div>
                    <h1 style="color:white;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Sharda University</h1>
                    <p style="color:rgba(147,197,253,0.8);margin:4px 0 0;font-size:13px;">Helpdesk Portal</p>
                  </td>
                </tr>
                <!-- Body -->
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
                <!-- Footer -->
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
    console.log(`✅ Password reset email sent to ${toEmail}`);
    return { success: true };
  } catch (err) {
    console.error('❌ Email send failed:', err);
    return { success: false, error: err.message };
  }
};

// ── Ticket Created Email ───────────────────────────────
exports.sendTicketCreatedEmail = async ({ toEmail, userName, ticketId, ticketTitle, ticketLink }) => {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
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
  } catch (err) {
    console.error('❌ Ticket email failed:', err);
    return { success: false };
  }
};
