import './env';

import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './config/auth';
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

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Better Auth's handler MUST be mounted before express.json(),
// since it needs to parse the raw request body itself.
app.all('/api/auth/*', toNodeHandler(auth));

app.use(cookieParser());
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'MedTrack API is running' });
});

app.get('/api/user/profile', authenticateUser, (req: Request, res: Response) => {
  res.status(200).json({ success: true, user: req.user });
});

app.use('/api/medicines', medicineRoutes);
app.use('/api/doses', doseLogRoutes);
app.use('/api/links', linkRoutes);

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