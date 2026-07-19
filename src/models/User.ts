import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  role: 'patient' | 'caregiver';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: false, // Optional because Better Auth credential flow manages passwords within its 'account' collection.
    },
    role: {
      type: String,
      enum: ['patient', 'caregiver'],
      default: 'patient',
    },
  },
  {
    timestamps: true,
  }
);

// Explicitly point at Better Auth's actual collection name ('user', singular)
// instead of Mongoose's default auto-pluralized 'users'.
export const User = model<IUser>('User', UserSchema, 'user');