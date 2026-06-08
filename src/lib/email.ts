import nodemailer from "nodemailer";

export async function sendTeamEmail(payload: {
  to: string;
  subject: string;
  body: string;
}) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user || "team@discover.local";
  const port = Number(process.env.SMTP_PORT ?? 587);

  if (!host || !user || !pass) {
    return {
      status: "simulated",
      messageId: null,
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const result = await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.body,
  });

  return {
    status: "sent",
    messageId: result.messageId,
  };
}
