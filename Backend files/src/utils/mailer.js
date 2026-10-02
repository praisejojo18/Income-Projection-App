const nodemailer = require("nodemailer");

/* ============================================================
   PRONTOLOG MAILER (demo-ready)
   Reads SMTP config from .env — values can stay empty until
   you fill them manually.
   ============================================================ */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: String(process.env.SMTP_SECURE) === "true",
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined
});

const TTL_MINUTES = Number(process.env.RESET_CODE_TTL_MINUTES) || 20;

/* ---------- Generic send ---------- */
async function sendEmail({ to, subject, html }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@prontolog.app";
  try {
    const info = await transporter.sendMail({ from: `ProntoLog <${from}>`, to, subject, html });
    console.log("✅ Email sent to", to, "— messageId:", info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error("❌ Email failed to", to, ":", err.message);
    return { sent: false, error: err.message };
  }
}

/* ---------- Password Reset template (demo style) ---------- */
function buildPasswordResetEmail({ name, code }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F0F4F8;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4F8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;">

        <!-- Header -->
        <tr><td style="padding:36px 40px 6px;text-align:center;">
          <h1 style="margin:0;font-size:26px;font-weight:800;color:#00AFEF;letter-spacing:-0.3px;">Reset your password</h1>
          <div style="display:inline-block;margin-top:14px;background:#FEF3C7;color:#92400E;font-size:12px;font-weight:700;padding:7px 16px;border-radius:999px;">Expires in ${TTL_MINUTES} minutes</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:26px 40px 6px;">
          <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#1A2332;">Hello ${name},</p>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.65;color:#475569;">A password reset was requested for your ProntoLog account.</p>

          <!-- Code box -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <div style="background:#1A2332;border:1px solid #353E46;border-radius:12px;padding:18px 36px;display:inline-block;">
              <span style="font-family:'Courier New',Courier,monospace;font-size:30px;font-weight:800;letter-spacing:6px;color:#FFFFFF;">${code}</span>
            </div>
            <div style="margin-top:10px;font-size:11px;font-weight:600;letter-spacing:2px;color:#94A3B8;">ONE-TIME RESET CODE</div>
          </td></tr></table>

          <!-- Blue callout -->
          <div style="margin:26px 0 0;background:#F8FAFC;border-left:4px solid #00AFEF;border-radius:8px;padding:14px 16px;font-size:13px;line-height:1.65;color:#475569;">
            Open ProntoLog, choose <strong style="color:#1A2332;">Forgot password</strong>, then choose <strong style="color:#1A2332;">I have a reset code</strong>. The code can be used only once.
          </div>

          <!-- Orange callout -->
          <div style="margin:12px 0 0;background:#F8FAFC;border-left:4px solid #F59E0B;border-radius:8px;padding:14px 16px;font-size:13px;line-height:1.65;color:#475569;">
            If you did not request this reset, ignore this email. Your current password remains unchanged.
          </div>

          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#475569;">For your security, never share this reset code with another person.</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:26px 40px 32px;">
          <div style="border-top:1px solid #E2E8F0;padding-top:16px;text-align:center;font-size:12px;color:#94A3B8;">
            ProntoLog · Pronto Broadband Solutions
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ---------- Send the reset email ---------- */
async function sendPasswordResetEmail({ name, email, code }) {
  return sendEmail({
    to: email,
    subject: `ProntoLog — your password reset code (${code})`,
    html: buildPasswordResetEmail({ name, code })
  });
}

module.exports = { sendEmail, sendPasswordResetEmail, buildPasswordResetEmail, TTL_MINUTES };