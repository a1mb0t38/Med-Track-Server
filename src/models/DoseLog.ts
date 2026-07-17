import { Schema, model, Document, Types } from 'mongoose';

export interface IDoseLog extends Document {
  medicineId: Types.ObjectId;
  userId: Types.ObjectId;
  scheduledTime: Date;
  status: 'pending' | 'taken' | 'skipped' | 'missed';
  actionedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DoseLogSchema = new Schema<IDoseLog>(
  {
    medicineId: {
      type: Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    scheduledTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'taken', 'skipped', 'missed'],
      default: 'pending',
    },
    actionedAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index on userId and scheduledTime for quick dashboard schedule lookups
DoseLogSchema.index({ userId: 1, scheduledTime: 1 });

export const DoseLog = model<IDoseLog>('DoseLog', DoseLogSchema);
