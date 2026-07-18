import { Schema, model, Document, Types } from 'mongoose';

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuestionCategory = 'Behavioral' | 'Technical' | 'System Design' | 'HR' | 'Leadership';
export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IQuestion extends Document {
  title: string;
  shortDescription: string;
  fullDescription: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  estimatedMinutes: number;
  /** Average community rating, 0–5. Updated externally (e.g. aggregation). */
  rating: number;
  /** Optional hero image for the question card. */
  imageUrl?: string;
  /**
   * Null for seeded / official questions; set to the submitting user's _id
   * for community-submitted questions.
   */
  createdBy?: Types.ObjectId;
  isUserSubmitted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const QuestionSchema = new Schema<IQuestion>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    shortDescription: {
      type: String,
      required: true,
      trim: true,
    },
    fullDescription: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['Behavioral', 'Technical', 'System Design', 'HR', 'Leadership'] satisfies QuestionCategory[],
    },
    difficulty: {
      type: String,
      required: true,
      enum: ['Easy', 'Medium', 'Hard'] satisfies QuestionDifficulty[],
    },
    estimatedMinutes: {
      type: Number,
      required: true,
      min: [1, 'Estimated time must be at least 1 minute'],
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be below 0'],
      max: [5, 'Rating cannot exceed 5'],
    },
    imageUrl: {
      type: String,
      required: false,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
    },
    isUserSubmitted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast category + difficulty browsing on the listings page
QuestionSchema.index({ category: 1, difficulty: 1 });
// Index for fetching questions submitted by a specific user
QuestionSchema.index({ createdBy: 1 });

// ─── Model ────────────────────────────────────────────────────────────────────

export const Question = model<IQuestion>('Question', QuestionSchema);
