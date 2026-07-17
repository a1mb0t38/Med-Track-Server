import { Schema, model, Document, Types } from 'mongoose';

export interface IMedicine extends Document {
  userId: Types.ObjectId;
  name: string;
  dosage: string;
  frequencyPerDay: number;
  times: string[];
  startDate: Date;
  endDate?: Date;
  pillsRemaining: number;
  pillsPerDose: number;
  lowStockThreshold: number;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MedicineSchema = new Schema<IMedicine>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dosage: {
      type: String,
      required: true,
      trim: true,
    },
    frequencyPerDay: {
      type: Number,
      required: true,
      min: [1, 'Frequency must be at least 1 dose per day'],
    },
    times: {
      type: [String],
      required: true,
      validate: {
        validator: function (this: any, arr: string[]) {
          // Resolve frequencyPerDay in save document context or update query validation context
          const frequency = this.frequencyPerDay ?? (this.get ? this.get('frequencyPerDay') : undefined);
          if (frequency !== undefined && arr.length !== frequency) {
            return false;
          }
          // Validate HH:MM format (24 hour)
          const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
          return arr.every((t) => timeRegex.test(t));
        },
        message: 'The number of scheduled times must match frequencyPerDay, and times must be in valid 24h format (HH:MM).',
      },
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: false,
    },
    pillsRemaining: {
      type: Number,
      default: 0,
      min: 0,
    },
    pillsPerDose: {
      type: Number,
      default: 1,
      min: 1,
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Medicine = model<IMedicine>('Medicine', MedicineSchema);
