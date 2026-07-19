import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { LinkedAccount } from '../models/LinkedAccount';
import { User } from '../models/User';
import { DoseLog } from '../models/DoseLog';
import { Medicine } from '../models/Medicine';

// Caregiver sends an invite to a patient
export const sendLinkInvite = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Optional: Check if req.user is a caregiver
    if (req.user.role !== 'caregiver') {
      return res.status(403).json({ success: false, message: 'Only caregivers can send invites' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Patient email is required' });
    }

    const lowerEmail = email.toLowerCase().trim();

    // Check if patient exists
    const patientUser = await User.findOne({ email: lowerEmail });

    // Check if invite already exists — match by invitedEmail OR patientId,
    // regardless of which one is available at the time of this new request.
    // This prevents duplicates even if the first invite was created before
    // the patient existed (email-only) and this one resolves a patientId.
    const existingInvite = await LinkedAccount.findOne({
      caregiverId: req.user.id,
      $or: [
        { invitedEmail: lowerEmail },
        ...(patientUser ? [{ patientId: patientUser._id }] : []),
      ],
    });

    if (existingInvite) {
      return res.status(400).json({ success: false, message: 'An invite or link already exists for this patient' });
    }

    const newLink = new LinkedAccount({
      caregiverId: req.user.id,
      status: 'pending',
      invitedEmail: lowerEmail,
    });

    if (patientUser) {
      newLink.patientId = patientUser._id as Types.ObjectId;
    }

    await newLink.save();
    return res.status(201).json({ success: true, data: newLink, message: 'Invite sent successfully' });
  } catch (error: any) {
    console.error('Error in sendLinkInvite:', error);
    // Handle mongo duplicate key error (11000)
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'An invite already exists' });
    }
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// Caregiver gets their sent pending invites
export const getSentInvites = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const invites = await LinkedAccount.find({
      caregiverId: req.user.id,
      status: 'pending'
    }).populate('patientId', 'name email');

    return res.status(200).json({ success: true, data: invites, message: 'Sent invites retrieved' });
  } catch (error: any) {
    console.error('Error in getSentInvites:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// Patient gets their incoming invites
export const getMyInvites = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id || !req.user.email) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // A patient can have invites matching their user ID or their email
    const invites = await LinkedAccount.find({
      $or: [
        { patientId: req.user.id, status: 'pending' },
        { invitedEmail: req.user.email.toLowerCase(), status: 'pending' }
      ]
    }).populate('caregiverId', 'name email');

    return res.status(200).json({ success: true, data: invites, message: 'Invites retrieved' });
  } catch (error: any) {
    console.error('Error in getMyInvites:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// Patient responds to an invite
export const respondToInvite = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { action } = req.body; // 'accept' or 'decline'

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be accept or decline' });
    }

    const invite = await LinkedAccount.findById(id);
    if (!invite || invite.status !== 'pending') {
      return res.status(404).json({ success: false, message: 'Pending invite not found' });
    }

    // Verify the invite belongs to this user
    if (
      (invite.patientId && invite.patientId.toString() !== req.user.id) &&
      (invite.invitedEmail && req.user.email && invite.invitedEmail !== req.user.email.toLowerCase())
    ) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    invite.status = action === 'accept' ? 'accepted' : 'declined';
    // Ensure patientId is set if they accepted via email match
    if (action === 'accept' && !invite.patientId) {
      invite.patientId = new Types.ObjectId(req.user.id);
    }

    await invite.save();
    return res.status(200).json({ success: true, data: invite, message: `Invite ${action}ed` });
  } catch (error: any) {
    console.error('Error in respondToInvite:', error);

    // Handle the case where accepting this invite collides with an
    // already-accepted/pending link between the same caregiver and patient
    // (e.g. a duplicate invite that slipped through before the fix above).
    if (error.code === 11000) {
      // This invite is now redundant since a link already exists — clean it up.
      await LinkedAccount.findByIdAndDelete(req.params.id).catch(() => { });
      return res.status(409).json({
        success: false,
        message: 'You are already linked with this caregiver. This duplicate invite has been removed.',
      });
    }

    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// Caregiver gets their linked patients
export const getLinkedPatients = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const links = await LinkedAccount.find({
      caregiverId: req.user.id,
      status: 'accepted'
    }).populate('patientId', 'name email');

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const results = await Promise.all(
      links.map(async (link) => {
        if (!link.patientId) {
          return {
            ...link.toObject(),
            todaySummary: { taken: 0, total: 0 }
          };
        }

        const doses = await DoseLog.find({
          userId: link.patientId._id,
          scheduledTime: { $gte: startOfToday, $lte: endOfToday }
        });
        const taken = doses.filter(d => d.status === 'taken').length;
        const total = doses.length;

        return {
          ...link.toObject(),
          todaySummary: { taken, total }
        };
      })
    );

    return res.status(200).json({ success: true, data: results, message: 'Linked patients retrieved' });
  } catch (error: any) {
    console.error('Error in getLinkedPatients:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// Patient gets their linked caregivers
export const getLinkedCaregivers = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const links = await LinkedAccount.find({
      patientId: req.user.id,
      status: 'accepted'
    }).populate('caregiverId', 'name email');

    return res.status(200).json({ success: true, data: links, message: 'Linked caregivers retrieved' });
  } catch (error: any) {
    console.error('Error in getLinkedCaregivers:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// Remove a link
export const unlinkAccount = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const link = await LinkedAccount.findById(id);

    if (!link || link.status !== 'accepted') {
      return res.status(404).json({ success: false, message: 'Accepted link not found' });
    }

    // Allow either the caregiver or the patient to unlink
    if (
      link.caregiverId.toString() !== req.user.id &&
      (!link.patientId || link.patientId.toString() !== req.user.id)
    ) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Delete the record (or we could set status to 'declined', but hard delete is fine for unlinking)
    await LinkedAccount.findByIdAndDelete(id);

    return res.status(200).json({ success: true, message: 'Account unlinked successfully' });
  } catch (error: any) {
    console.error('Error in unlinkAccount:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// Caregiver gets patient doses
export const getPatientDosesForCaregiver = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { patientId } = req.params;
    if (!Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID' });
    }

    // Critical Security Check: Ensure an accepted link exists
    const link = await LinkedAccount.findOne({
      caregiverId: req.user.id,
      patientId: patientId,
      status: 'accepted'
    }).populate('patientId', 'name email');

    if (!link) {
      return res.status(403).json({ success: false, message: 'Forbidden: No accepted link with this patient' });
    }

    // Get today's doses
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayDoses = await DoseLog.find({
      userId: patientId,
      scheduledTime: { $gte: startOfToday, $lte: endOfToday }
    })
      .sort({ scheduledTime: 1 })
      .populate('medicineId', 'name dosage');

    // Get 30-day adherence
    const thirtyDaysAgo = new Date(new Date().setDate(now.getDate() - 30));

    const adherence = await DoseLog.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(patientId),
          scheduledTime: { $gte: thirtyDaysAgo, $lte: now }
        }
      },
      {
        $group: {
          _id: {
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
        $sort: { _id: 1 }
      }
    ]);

    return res.status(200).json({
      success: true,
      data: {
        patient: link.patientId,
        todayDoses,
        adherenceHistory: adherence
      },
      message: 'Patient data retrieved successfully'
    });
  } catch (error: any) {
    console.error('Error in getPatientDosesForCaregiver:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};