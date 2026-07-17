import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { DoseLog } from '../models/DoseLog';
import { Medicine } from '../models/Medicine';

// Get today's doses for the logged in user
export const getTodayDoses = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const doses = await DoseLog.find({
      userId: req.user.id,
      scheduledTime: { $gte: startOfToday, $lte: endOfToday }
    })
    .sort({ scheduledTime: 1 })
    .populate('medicineId', 'name dosage');

    return res.status(200).json({ success: true, data: doses, message: "Today's doses retrieved" });
  } catch (error: any) {
    console.error('Error in getTodayDoses:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// Update dose status
export const updateDoseStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid DoseLog ID' });
    }

    if (!['taken', 'skipped'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be taken or skipped' });
    }

    const doseLog = await DoseLog.findById(id);
    if (!doseLog) {
      return res.status(404).json({ success: false, message: 'DoseLog not found' });
    }

    if (doseLog.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Don't update if already actioned (optional logic, but typically safe)
    if (doseLog.status === 'taken' || doseLog.status === 'skipped') {
      return res.status(400).json({ success: false, message: 'Dose already actioned' });
    }

    doseLog.status = status;
    doseLog.actionedAt = new Date();
    await doseLog.save();

    // If taken, decrement pillsRemaining
    if (status === 'taken') {
      const medicine = await Medicine.findById(doseLog.medicineId);
      if (medicine && medicine.pillsRemaining > 0) {
        // Prevent negative pillsRemaining but ideally subtract pillsPerDose
        medicine.pillsRemaining = Math.max(0, medicine.pillsRemaining - medicine.pillsPerDose);
        await medicine.save();
      }
    }

    return res.status(200).json({ success: true, data: doseLog, message: `Dose marked as ${status}` });
  } catch (error: any) {
    console.error('Error in updateDoseStatus:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// Get adherence history for a date range (default last 30 days)
export const getAdherenceHistory = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    // Default to 30 days ago
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate as string) 
      : new Date(new Date().setDate(endDate.getDate() - 30));

    // Aggregate DoseLogs by day and status
    const adherence = await DoseLog.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(req.user.id),
          scheduledTime: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            // Group by YYYY-MM-DD
            $dateToString: { format: "%Y-%m-%d", date: "$scheduledTime" }
          },
          taken: {
            $sum: { $cond: [{ $eq: ["$status", "taken"] }, 1, 0] }
          },
          skipped: {
            $sum: { $cond: [{ $eq: ["$status", "skipped"] }, 1, 0] }
          },
          missed: {
            $sum: { $cond: [{ $eq: ["$status", "missed"] }, 1, 0] }
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
          },
          total: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 } // Sort by date ascending
      }
    ]);

    return res.status(200).json({ success: true, data: adherence, message: 'Adherence history retrieved' });
  } catch (error: any) {
    console.error('Error in getAdherenceHistory:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};
