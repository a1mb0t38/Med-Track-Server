import { Router } from 'express';
import {
  sendLinkInvite,
  getMyInvites,
  getSentInvites,
  respondToInvite,
  getLinkedPatients,
  getLinkedCaregivers,
  unlinkAccount,
  getPatientDosesForCaregiver
} from '../controllers/linkController';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Protect all link routes
router.use(authenticateUser);

// POST /api/links/invite
router.post('/invite', sendLinkInvite);

// GET /api/links/invites (incoming for patient)
router.get('/invites', getMyInvites);

// GET /api/links/sent-invites (outgoing from caregiver)
router.get('/sent-invites', getSentInvites);
router.put('/:id/respond', respondToInvite);

// List connections
router.get('/patients', getLinkedPatients);
router.get('/caregivers', getLinkedCaregivers);

// Remove connection
router.delete('/:id', unlinkAccount);

// Caregiver views patient data
router.get('/patients/:patientId/doses', getPatientDosesForCaregiver);

export default router;
