import { Medicine, IMedicine } from '../models/Medicine';
import { DoseLog } from '../models/DoseLog';

/**
 * Generates today's pending DoseLogs for a single medicine document.
 * Safe to call multiple times — skips any scheduledTime that already has a DoseLog.
 */
export const generateDosesForMedicine = async (medicine: IMedicine) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Skip if medicine isn't active for today at all
  const startsAfterToday = medicine.startDate > endOfToday;
  const endedBeforeToday = medicine.endDate && medicine.endDate < startOfToday;
  if (!medicine.isActive || startsAfterToday || endedBeforeToday) {
    return 0;
  }

  let createdCount = 0;

  for (const timeString of medicine.times) {
    const [hours, minutes] = timeString.split(':').map(Number);

    const scheduledTime = new Date(startOfToday);
    scheduledTime.setHours(hours, minutes, 0, 0);

    const existingDose = await DoseLog.findOne({
      medicineId: medicine._id,
      scheduledTime,
    });

    if (!existingDose) {
      await DoseLog.create({
        medicineId: medicine._id,
        userId: medicine.userId,
        scheduledTime,
        status: 'pending',
      });
      createdCount++;
    }
  }

  return createdCount;
};

/**
 * Finds all active medicines and generates pending DoseLogs for today
 * based on the times array. Avoids duplicates. Run via cron.
 */
export const generateDailyDoses = async () => {
  try {
    console.log('Running daily dose generation job...');

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const activeMedicines = await Medicine.find({
      isActive: true,
      startDate: { $lte: endOfToday },
      $or: [
        { endDate: { $exists: false } },
        { endDate: null },
        { endDate: { $gte: startOfToday } },
      ],
    });

    let createdCount = 0;
    for (const medicine of activeMedicines) {
      createdCount += await generateDosesForMedicine(medicine);
    }

    console.log(`Daily dose generation complete. Created ${createdCount} new doses.`);
  } catch (error) {
    console.error('Error generating daily doses:', error);
  }
};