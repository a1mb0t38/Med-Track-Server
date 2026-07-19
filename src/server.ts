import './env'; // MUST be first — loads env vars before anything else runs

import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db';
import { authenticateUser } from './middleware/auth';
import medicineRoutes from './routes/medicineRoutes';
import doseLogRoutes from './routes/doseLogRoutes';
import linkRoutes from './routes/linkRoutes';
import cron from 'node-cron';
import { generateDailyDoses } from './utils/generateDailyDoses';
import { markOverdueMissed } from './utils/markOverdueMissed';

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// Basic health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'MedTrack API is running' });
});

// Protected test route using authentication middleware
app.get('/api/user/profile', authenticateUser, (req: Request, res: Response) => {
  res.status(200).json({ success: true, user: req.user });
});

// Mount routes
app.use('/api/medicines', medicineRoutes);
app.use('/api/doses', doseLogRoutes);
app.use('/api/links', linkRoutes);

// Initialize connection and start server
const startServer = () => {
  console.log('Initializing MedTrack API...');

  connectDB().then(() => {
    cron.schedule('5 0 * * *', () => {
      console.log('Cron: Starting generateDailyDoses');
      generateDailyDoses();
    });

    cron.schedule('0 * * * *', () => {
      console.log('Cron: Starting markOverdueMissed check');
      markOverdueMissed();
    });
  }).catch((error) => {
    console.error('Mongoose connection failed on startup:', error);
  });

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();