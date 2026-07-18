import { Request, Response } from 'express';
import { Medicine } from '../models/Medicine';
import { Types } from 'mongoose';
import { generateDosesForMedicine } from '../utils/generateDailyDoses';

// Create a new medicine
export const createMedicine = async (req: Request, res: Response) => {
  try {
    const {
      name,
      dosage,
      frequencyPerDay,
      times,
      startDate,
      endDate,
      pillsRemaining,
      pillsPerDose,
      lowStockThreshold,
      notes
    } = req.body;

    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!name || !dosage || frequencyPerDay === undefined || !times) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, dosage, frequencyPerDay, times'
      });
    }

    if (!Array.isArray(times) || times.length !== frequencyPerDay) {
      return res.status(400).json({
        success: false,
        message: 'The number of scheduled times must match frequencyPerDay'
      });
    }

    const newMedicine = new Medicine({
      userId: req.user.id,
      name,
      dosage,
      frequencyPerDay,
      times,
      startDate: startDate || Date.now(),
      endDate,
      pillsRemaining,
      pillsPerDose,
      lowStockThreshold,
      notes,
      isActive: true,
    });

    const savedMedicine = await newMedicine.save();

    // Immediately generate today's doses for this medicine so it shows up
    // on the dashboard right away, instead of waiting for the next cron run.
    try {
      await generateDosesForMedicine(savedMedicine);
    } catch (doseGenError) {
      // Don't fail the whole request if dose generation has an issue —
      // the medicine was still saved successfully.
      console.error('Failed to generate today\'s doses for new medicine:', doseGenError);
    }

    return res.status(201).json({
      success: true,
      data: savedMedicine,
      message: 'Medicine created successfully'
    });
  } catch (error: any) {
    console.error('Error in createMedicine:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server Error'
    });
  }
};

// Get all active medicines for the logged-in user
export const getMedicines = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const medicines = await Medicine.find({
      userId: req.user.id,
      isActive: true
    }).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      data: medicines,
      message: 'Medicines retrieved successfully'
    });
  } catch (error: any) {
    console.error('Error in getMedicines:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server Error'
    });
  }
};

// Get a single medicine by ID
export const getMedicineById = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid medicine ID format' });
    }

    const medicine = await Medicine.findById(id);

    if (!medicine || !medicine.isActive) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }

    if (medicine.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not own this medicine' });
    }

    return res.status(200).json({
      success: true,
      data: medicine,
      message: 'Medicine retrieved successfully'
    });
  } catch (error: any) {
    console.error('Error in getMedicineById:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server Error'
    });
  }
};

// Update a medicine
export const updateMedicine = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid medicine ID format' });
    }

    const medicine = await Medicine.findById(id);

    if (!medicine || !medicine.isActive) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }

    if (medicine.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not own this medicine' });
    }

    const {
      name,
      dosage,
      frequencyPerDay,
      times,
      pillsRemaining,
      pillsPerDose,
      lowStockThreshold,
      notes,
      startDate,
      endDate,
      isActive
    } = req.body;

    const newFrequency = frequencyPerDay !== undefined ? frequencyPerDay : medicine.frequencyPerDay;
    const newTimes = times !== undefined ? times : medicine.times;

    if (times !== undefined || frequencyPerDay !== undefined) {
      if (!Array.isArray(newTimes) || newTimes.length !== newFrequency) {
        return res.status(400).json({
          success: false,
          message: 'The number of scheduled times must match frequencyPerDay'
        });
      }
    }

    if (name !== undefined) medicine.name = name;
    if (dosage !== undefined) medicine.dosage = dosage;
    if (frequencyPerDay !== undefined) medicine.frequencyPerDay = frequencyPerDay;
    if (times !== undefined) medicine.times = times;
    if (startDate !== undefined) medicine.startDate = startDate;
    if (endDate !== undefined) medicine.endDate = endDate;
    if (pillsRemaining !== undefined) medicine.pillsRemaining = pillsRemaining;
    if (pillsPerDose !== undefined) medicine.pillsPerDose = pillsPerDose;
    if (lowStockThreshold !== undefined) medicine.lowStockThreshold = lowStockThreshold;
    if (notes !== undefined) medicine.notes = notes;
    if (isActive !== undefined) medicine.isActive = isActive;

    const updatedMedicine = await medicine.save();

    // Regenerate today's doses in case times/frequency changed, so the
    // dashboard reflects the update immediately rather than at next cron run.
    try {
      await generateDosesForMedicine(updatedMedicine);
    } catch (doseGenError) {
      console.error('Failed to regenerate doses after medicine update:', doseGenError);
    }

    return res.status(200).json({
      success: true,
      data: updatedMedicine,
      message: 'Medicine updated successfully'
    });
  } catch (error: any) {
    console.error('Error in updateMedicine:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server Error'
    });
  }
};

// Soft delete a medicine
export const deleteMedicine = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid medicine ID format' });
    }

    const medicine = await Medicine.findById(id);

    if (!medicine || !medicine.isActive) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }

    if (medicine.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not own this medicine' });
    }

    medicine.isActive = false;
    await medicine.save();

    return res.status(200).json({
      success: true,
      message: 'Medicine deleted successfully'
    });
  } catch (error: any) {
    console.error('Error in deleteMedicine:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server Error'
    });
  }
};