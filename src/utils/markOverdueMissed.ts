import { DoseLog } from '../models/DoseLog';

/**
 * Finds all 'pending' DoseLogs whose scheduledTime is more than 2 hours in the past,
 * and marks them as 'missed'.
 */
export const markOverdueMissed = async () => {
  try {
    console.log('Running overdue missed dose check...');
    
    const now = new Date();
    // 2 hours ago
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const result = await DoseLog.updateMany(
      {
        status: 'pending',
        scheduledTime: { $lt: twoHoursAgo }
      },
      {
        $set: { 
          status: 'missed',
          actionedAt: now // Record when it was marked missed
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`Marked ${result.modifiedCount} overdue doses as missed.`);
    }
  } catch (error) {
    console.error('Error marking overdue doses as missed:', error);
  }
};
