import nodemailer from 'nodemailer';
import { WELCOME_EMAIL_TEMPLATE, NEWS_SUMMARY_EMAIL_TEMPLATE, ALERT_TRIGGER_EMAIL_TEMPLATE, NOTIFICATION_ENABLED_EMAIL_TEMPLATE } from '@/lib/nodemailer/templates';

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

export const sendAlertEmail = async ({
  email,
  symbol,
  company,
  alertName,
  conditionLabel,
  currentPrice,
  threshold,
  symbolUrl,
}: {
  email: string;
  symbol: string;
  company: string;
  alertName: string;
  conditionLabel: string;
  currentPrice: string;
  threshold: string;
  symbolUrl: string;
}): Promise<void> => {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || '').replace(/\/+$/,'');
  const logoUrl = base ? `${base}/assets/icons/finsage13.png` : 'https://example.com/assets/icons/finsage13.png';
  const html = ALERT_TRIGGER_EMAIL_TEMPLATE
    .replace(/{{symbol}}/g, symbol)
    .replace(/{{company}}/g, company)
    .replace(/{{alertName}}/g, alertName)
    .replace(/{{conditionLabel}}/g, conditionLabel)
    .replace(/{{currentPrice}}/g, currentPrice)
    .replace(/{{threshold}}/g, threshold)
    .replace(/{{symbolUrl}}/g, symbolUrl)
    .replace(/{{logoUrl}}/g, logoUrl);

  await transporter.sendMail({
    from: `"Finsage Alerts" <${process.env.NODEMAILER_EMAIL!}>`,
    to: email,
    subject: `Price Alert: ${symbol} - ${conditionLabel}`,
    html,
  });
};

export const sendNotificationEnabledEmail = async ({
  email,
  channel,
}: {
  email: string;
  channel: string;
}): Promise<void> => {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || '').replace(/\/+$/,'');
  const logoUrl = base ? `${base}/assets/icons/finsage13.png` : 'https://example.com/assets/icons/finsage13.png';
  const html = NOTIFICATION_ENABLED_EMAIL_TEMPLATE
    .replace(/{{channel}}/g, channel)
    .replace(/{{logoUrl}}/g, logoUrl);

  await transporter.sendMail({
    from: `"Finsage Alerts" <${process.env.NODEMAILER_EMAIL!}>`,
    to: email,
    subject: `Notifications enabled for ${channel}`,
    html,
  });
};
