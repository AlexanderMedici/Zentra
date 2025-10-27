import nodemailer from 'nodemailer';
import { WELCOME_EMAIL_TEMPLATE, NEWS_SUMMARY_EMAIL_TEMPLATE } from '@/lib/nodemailer/templates';

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NODEMAILER_EMAIL!,
    pass: process.env.NODEMAILER_PASSWORD!,
  },
});
export const sendWelcomeEmail = async ({ email, name, intro }: WelcomeEmailData) => {
  const clean = (v?: string) => (typeof v === 'string' ? v.trim() : '');
  const to = clean(email);
  const displayName = clean(name) || 'there';
  const introText = clean(intro);

  if (!to) {
    throw new Error('Invalid recipient email');
  }

  const htmlTemplate = WELCOME_EMAIL_TEMPLATE.replace('{{name}}', displayName).replace('{{intro}}', introText);

  const mailOptions = {
    from: `"Finsage" <${process.env.NODEMAILER_EMAIL!}>`,
    to,
    subject: `Welcome to Finsage - your stock tutor!`,
    text: 'Thanks for joining Finsage',
    html: htmlTemplate,
    replyTo: process.env.NODEMAILER_EMAIL!,
  } as const;

  await transporter.sendMail(mailOptions);
};

export const sendNewsSummaryEmail = async ({
  email,
  date,
  newsContent,
}: {
  email: string;
  date: string;
  newsContent: string;
}): Promise<void> => {
  const htmlTemplate = NEWS_SUMMARY_EMAIL_TEMPLATE.replace('{{date}}', date).replace(
    '{{newsContent}}',
    newsContent
  );

  const mailOptions = {
    from: `"Finsage News" <finSage@invest.com>`,
    to: email,
    subject: `📈 Market News Summary Today - ${date}`,
    text: `Today's market news summary from Finsage`,
    html: htmlTemplate,
  };

  await transporter.sendMail(mailOptions);
};
