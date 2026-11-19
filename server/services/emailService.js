const nodemailer = require('nodemailer');

let transporterPromise;

function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      if (process.env.SMTP_HOST) {
        const port = Number(process.env.SMTP_PORT) || 587;
        return nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port,
          secure: port === 465,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
      }
      if (process.env.NODE_ENV === 'production') {
        throw new Error('SMTP settings are missing');
      }
      // Development fallback: Ethereal is a fake inbox, nothing is really delivered
      const account = await nodemailer.createTestAccount();
      console.log('[email] SMTP_HOST not set, using the Ethereal test inbox');
      return nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      });
    })().catch((err) => {
      transporterPromise = undefined; // try again next time
      throw err;
    });
  }
  return transporterPromise;
}

async function sendEmail({ to, subject, text, html }) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Urban Eye" <no-reply@urbaneye.local>',
    to,
    subject,
    text,
    html,
  });
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) console.log('[email] preview:', preview); // only exists for Ethereal
  return info;
}

module.exports = { sendEmail };