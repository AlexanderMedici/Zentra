import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface AlertDoc extends Document {
  userId: string;
  symbol: string;
  company: string;
  alertName: string;
  alertType: 'upper' | 'lower';
  threshold: number;
  createdAt: Date;
  active: boolean;
  lastTriggeredAt?: Date;
  lastTriggeredPrice?: number;
}

const AlertSchema = new Schema<AlertDoc>(
  {
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    company: { type: String, required: true, trim: true },
    alertName: { type: String, required: true, trim: true },
    alertType: { type: String, enum: ['upper', 'lower'], required: true },
    threshold: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
    lastTriggeredAt: { type: Date },
    lastTriggeredPrice: { type: Number },
  },
  { timestamps: false }
);

export const AlertModel: Model<AlertDoc> =
  (models?.Alert as Model<AlertDoc>) || model<AlertDoc>('Alert', AlertSchema);
