import { Router } from 'express';
import {
  register,
  login,
  googleAuth,
  googleCallback,
  logout,
  getMe,
} from '../controllers/authController';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// ── Local auth ────────────────────────────────────────────────────────────────
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// ── Current user (JWT-protected) ──────────────────────────────────────────────
router.get('/me', authenticateUser, getMe);

// ── Google OAuth ──────────────────────────────────────────────────────────────
// Step 1: redirect to Google consent screen
router.get('/google', googleAuth);
// Step 2: Google redirects back here with ?code=
router.get('/google/callback', googleCallback);

export default router;
