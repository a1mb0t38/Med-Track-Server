declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: 'patient' | 'caregiver';
        emailVerified: boolean;
        image?: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
      session?: any;
    }
  }
}

export {};
