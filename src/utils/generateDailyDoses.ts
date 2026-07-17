import { Medicine } from '../models/Medicine';
import { DoseLog } from '../models/DoseLog';

/**
 * Finds active medicines and generates pending DoseLogs for today
 * based on the times array. Avoids duplicates.
 */
export const generateDailyDoses = async () => {
  try {
    console.log('Running daily dose generation job...');
    
    // Get start and end of today
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // 1. Find all active Medicine documents where startDate <= today and (endDate is null or endDate >= today)
    const activeMedicines = await Medicine.find({
      isActive: true,
      startDate: { $lte: endOfToday },
      $or: [
        { endDate: { $exists: false } },
        { endDate: null },
        { endDate: { $gte: startOfToday } }
      ]
    });

    let createdCount = 0;

    for (const medicine of activeMedicines) {
      for (const timeString of medicine.times) {
        // timeString is in "HH:MM" format
        const [hours, minutes] = timeString.split(':').map(Number);
        
        // Create scheduledTime for today at HH:MM
        const scheduledTime = new Date(startOfToday);
        scheduledTime.setHours(hours, minutes, 0, 0);

        // Check if a DoseLog for this medicine at this specific scheduledTime already exists
        const existingDose = await DoseLog.findOne({
          medicineId: medicine._id,
          scheduledTime: scheduledTime
        });

        if (!existingDose) {
          await DoseLog.create({
            medicineId: medicine._id,
            userId: medicine.userId,
            scheduledTime,
            status: 'pending'
          });
          createdCount++;
        }
      }
    }

    console.log(`Daily dose generation complete. Created ${createdCount} new doses.`);
  } catch (error) {
    console.error('Error generating daily doses:', error);
  }
};
