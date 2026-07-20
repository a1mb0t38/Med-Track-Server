import { Medicine, IMedicine } from '../models/Medicine';
import { DoseLog } from '../models/DoseLog';

// TODO: Make this per-user once user timezone preferences are supported.
// For now, all patients are assumed to be in this timezone.
const APP_TIMEZONE_OFFSET_MINUTES = 6 * 60; // UTC+6 (Bangladesh Standard Time)

/**
 * Builds a UTC Date representing a specific wall-clock time (HH:MM) on a given
 * calendar day, in the app's configured timezone — independent of the server's
 * own local timezone (which may be UTC on most hosts, e.g. Render).
 */
const buildScheduledTimeUTC = (baseDate: Date, hours: number, minutes: number): Date => {
  // Get the UTC calendar date components of baseDate (already normalized to midnight UTC-based "today").
  const utcYear = baseDate.getUTCFullYear();
  const utcMonth = baseDate.getUTCMonth();
  const utcDay = baseDate.getUTCDate();

  // Construct the intended wall-clock time as if it were UTC, then subtract
  // the app's timezone offset to get the true UTC instant it represents.
  const asIfUTC = Date.UTC(utcYear, utcMonth, utcDay, hours, minutes, 0, 0);
  return new Date(asIfUTC - APP_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
};

/**
 * Generates today's pending DoseLogs for a single medicine document.
 * Safe to call multiple times — skips any scheduledTime that already has a DoseLog.
 */
export const generateDosesForMedicine = async (medicine: IMedicine) => {
  const now = new Date();
  // Use UTC-based "today" consistently, then convert to the app's timezone below.
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

  const startsAfterToday = medicine.startDate > endOfToday;
  const endedBeforeToday = medicine.endDate && medicine.endDate < startOfToday;
  if (!medicine.isActive || startsAfterToday || endedBeforeToday) {
    return 0;
  }

  let createdCount = 0;

  for (const timeString of medicine.times) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const scheduledTime = buildScheduledTimeUTC(startOfToday, hours, minutes);

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
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

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