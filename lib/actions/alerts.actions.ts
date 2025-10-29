'use server';

import { connectToDatabase } from '@/database/mongoose';
import { AlertModel } from '@/database/models/alert.model';
import { NotificationPreferencesModel } from '@/database/models/notification-preferences.model';
import { transporter, sendNotificationEnabledEmail } from '@/lib/nodemailer';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function createAlert(data: AlertData) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { success: false, error: 'Unauthorized' } as const;

    await connectToDatabase();

    const thresholdNum = Number(data.threshold);
    if (!Number.isFinite(thresholdNum)) return { success: false, error: 'Invalid threshold' } as const;

    await AlertModel.create({
      userId: session.user.id,
      symbol: data.symbol.trim().toUpperCase(),
      company: data.company.trim(),
      alertName: data.alertName.trim(),
      alertType: data.alertType,
      threshold: thresholdNum,
    });

    revalidatePath('/watchlist');
    return { success: true } as const;
  } catch (e) {
    console.error('createAlert error:', e);
    return { success: false, error: 'Failed to create alert' } as const;
  }
}

export async function getUserAlerts() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return [] as const;
    await connectToDatabase();
    const docs = await AlertModel.find({ userId: session.user.id }).sort({ createdAt: -1 }).lean();
    return docs.map((d) => ({
      id: String((d as any)._id),
      symbol: d.symbol,
      company: d.company,
      alertName: d.alertName,
      alertType: d.alertType,
      threshold: d.threshold,
      active: (d as any).active !== false,
      createdAt: d.createdAt,
    }));
  } catch (e) {
    console.error('getUserAlerts error:', e);
    return [] as const;
  }
}

export async function toggleAlertActive(id: string, active: boolean) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { success: false, error: 'Unauthorized' } as const;
    await connectToDatabase();
    await AlertModel.updateOne({ _id: id, userId: session.user.id }, { $set: { active } });
    return { success: true } as const;
  } catch (e) {
    console.error('toggleAlertActive error:', e);
    return { success: false, error: 'Failed to update alert' } as const;
  }
}

export async function deleteAlertById(id: string) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { success: false, error: 'Unauthorized' } as const;
    await connectToDatabase();
    await AlertModel.deleteOne({ _id: id, userId: session.user.id });
    return { success: true } as const;
  } catch (e) {
    console.error('deleteAlertById error:', e);
    return { success: false, error: 'Failed to delete alert' } as const;
  }
}

export async function getNotificationPreferences() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return null;
    await connectToDatabase();
    const doc = await NotificationPreferencesModel.findOne({ userId: session.user.id }).lean();
    if (!doc) return { emailAllowed: false, phoneAllowed: false, phoneNumber: '' };
    return {
      emailAllowed: !!doc.emailAllowed,
      phoneAllowed: !!doc.phoneAllowed,
      phoneNumber: doc.phoneNumber || '',
    };
  } catch (e) {
    console.error('getNotificationPreferences error:', e);
    return { emailAllowed: false, phoneAllowed: false, phoneNumber: '' };
  }
}

export async function updateNotificationPreferences(data: { emailAllowed?: boolean; phoneAllowed?: boolean; phoneNumber?: string }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { success: false, error: 'Unauthorized' } as const;
    await connectToDatabase();
    const update: any = { ...data, updatedAt: new Date() };
    await NotificationPreferencesModel.updateOne(
      { userId: session.user.id },
      { $set: update, $setOnInsert: { userId: session.user.id } },
      { upsert: true }
    );
    return { success: true } as const;
  } catch (e) {
    console.error('updateNotificationPreferences error:', e);
    return { success: false, error: 'Failed to update preferences' } as const;
  }
}

export async function sendTestNotificationEmail() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.email) return { success: false, error: 'No email' } as const;
    const to = session.user.email;
    await sendNotificationEnabledEmail({ email: to, channel: 'email' });
    return { success: true } as const;
  } catch (e) {
    console.error('sendTestNotificationEmail error:', e);
    return { success: false, error: 'Failed to send email' } as const;
  }
}
