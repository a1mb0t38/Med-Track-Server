import * as dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';

// Load .env from the backend root (two levels up from src/scripts/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DEMO_EMAIL = 'demo@preppilot.com';
const DEMO_PASSWORD = 'Demo1234!';
const DEMO_NAME = 'Demo User';

async function seedDemoUser(): Promise<void> {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌  MONGO_URI is not set in .env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅  Connected to MongoDB');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const result = await User.findOneAndUpdate(
    { email: DEMO_EMAIL },
    {
      $set: {
        name: DEMO_NAME,
        email: DEMO_EMAIL,
        passwordHash,
        authProvider: 'local',
      },
      $setOnInsert: { resumeSummary: undefined },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`✅  Demo user ready: ${result.email} (id: ${result._id})`);
  console.log(`    Email:    ${DEMO_EMAIL}`);
  console.log(`    Password: ${DEMO_PASSWORD}`);

  await mongoose.disconnect();
  console.log('✅  Disconnected. Seed complete.');
}

seedDemoUser().catch((error) => {
  console.error('❌  Seed failed:', error);
  process.exit(1);
});
