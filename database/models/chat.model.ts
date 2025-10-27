import { Schema, model, models, type Document, type Model, Types } from 'mongoose';

export interface ChatThread extends Document {
  userId: string;
  title?: string;
  createdAt: Date;
}

export interface ChatMessage extends Document {
  threadId: Types.ObjectId | string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
}

const ChatThreadSchema = new Schema<ChatThread>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

const ChatMessageSchema = new Schema<ChatMessage>(
  {
    threadId: { type: Schema.Types.ObjectId, ref: 'ChatThread', required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const ChatThreadModel: Model<ChatThread> =
  (models?.ChatThread as Model<ChatThread>) || model<ChatThread>('ChatThread', ChatThreadSchema);

export const ChatMessageModel: Model<ChatMessage> =
  (models?.ChatMessage as Model<ChatMessage>) || model<ChatMessage>('ChatMessage', ChatMessageSchema);

