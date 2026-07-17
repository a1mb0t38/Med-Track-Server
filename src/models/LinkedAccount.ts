import { Schema, model, Document, Types } from 'mongoose';

export interface ILinkedAccount extends Document {
  caregiverId: Types.ObjectId;
  patientId: Types.ObjectId;
  status: 'pending' | 'accepted' | 'declined';
  invitedEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LinkedAccountSchema = new Schema<ILinkedAccount>(
  {
    caregiverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
    },
    invitedEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to prevent duplicate connections between the same caregiver and patient
LinkedAccountSchema.index({ caregiverId: 1, patientId: 1 }, { unique: true });

export const LinkedAccount = model<ILinkedAccount>('LinkedAccount', LinkedAccountSchema);
