import { Request, Response } from 'express';
import { Medicine } from '../models/Medicine';
import { Types } from 'mongoose';

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

    // Validate required fields
    if (!name || !dosage || frequencyPerDay === undefined || !times) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: name, dosage, frequencyPerDay, times' 
      });
    }

    // Validate times array length
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
    
    // Check if medicine exists and is not softly deleted
    if (!medicine || !medicine.isActive) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }

    // Check ownership
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

    // Validate times array length if frequency or times are being updated
    if (times !== undefined || frequencyPerDay !== undefined) {
      if (!Array.isArray(newTimes) || newTimes.length !== newFrequency) {
        return res.status(400).json({ 
          success: false, 
          message: 'The number of scheduled times must match frequencyPerDay' 
        });
      }
    }

    // Apply updates
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

    // Soft delete by setting isActive to false
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
