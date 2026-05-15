import nodemailer from "nodemailer";

export async function sendSubmissionNotification(
  creatorEmail: string,
  formTitle: string,
  formId: string,
  submissionId: string
) {
  // Setup transporter - using a placeholder for Ethereal or real SMTP
  // In production, use process.env.SMTP_HOST, etc.
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: Number(process.env.SMTP_PORT) || 587,
    auth: {
      user: process.env.SMTP_USER || "placeholder@ethereal.email",
      pass: process.env.SMTP_PASS || "placeholder_pass",
    },
  });

  const dashboardUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/${formId}`;

  const info = await transporter.sendMail({
    from: '"FormWalrus" <noreply@formwalrus.app>',
    to: creatorEmail,
    subject: `New Response: ${formTitle}`,
    text: `You have received a new submission for your form "${formTitle}".\n\nView it here: ${dashboardUrl}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; padding: 24px;">
        <h2 style="color: #000;">New Response!</h2>
        <p style="color: #666; font-size: 16px;">
          You have received a new submission for your form <strong>${formTitle}</strong>.
        </p>
        <div style="margin: 32px 0;">
          <a href="${dashboardUrl}" style="background: #000; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            View in Dashboard
          </a>
        </div>
        <hr style="border: 0; border-top: 1px solid #eee;" />
        <p style="color: #999; font-size: 12px;">
          Form ID: ${formId}<br/>
          Submission ID: ${submissionId}
        </p>
      </div>
    `,
  });

  console.log("Notification email sent: %s", info.messageId);
}
