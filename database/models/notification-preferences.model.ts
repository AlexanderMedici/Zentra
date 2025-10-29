import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface NotificationPreferencesDoc extends Document {
  userId: string;
  emailAllowed: boolean;
  phoneAllowed: boolean;
  phoneNumber?: string;
  updatedAt: Date;
}

const NotificationPreferencesSchema = new Schema<NotificationPreferencesDoc>(
  {
    userId: { type: String, required: true, index: true, unique: true },
    emailAllowed: { type: Boolean, default: false },
    phoneAllowed: { type: Boolean, default: false },
    phoneNumber: { type: String, trim: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const NotificationPreferencesModel: Model<NotificationPreferencesDoc> =
  (models?.NotificationPreferences as Model<NotificationPreferencesDoc>) ||
  model<NotificationPreferencesDoc>('NotificationPreferences', NotificationPreferencesSchema);

