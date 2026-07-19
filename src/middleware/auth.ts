import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/auth';

/**
 * Express middleware to authenticate users using Better Auth sessions.
 * Converts incoming Express headers into Web API Headers and checks them against
 * the shared MongoDB session database.
 */
export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. Convert Express headers to standard Headers object for Better Auth
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v));
        } else {
          headers.append(key, value);
        }
      }
    });

    // 2. Retrieve session using Better Auth API
    const session = await auth.api.getSession({
      headers,
    });
    console.log("Session: ", session);

    // 3. If session is invalid, block access
    if (!session || !session.user) {
      return res.status(401).json({ error: 'Unauthorized: Session invalid or expired' });
    }

    // 4. Attach user to request object type-safely
    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role as 'patient' | 'caregiver',
      emailVerified: session.user.emailVerified,
      image: session.user.image,
      createdAt: session.user.createdAt,
      updatedAt: session.user.updatedAt,
    };
    req.session = session.session;


    console.log("================================");
    console.log(req.method, req.originalUrl);
    console.log("Cookie:", !!req.headers.cookie);
    console.log("Session:", session ? "VALID" : "NULL");

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
