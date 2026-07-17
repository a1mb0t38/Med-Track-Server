import { Router } from 'express';
import {
  sendLinkInvite,
  getMyInvites,
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

// Invite routes
router.post('/invite', sendLinkInvite);
router.get('/invites', getMyInvites);
router.put('/:id/respond', respondToInvite);

// List connections
router.get('/patients', getLinkedPatients);
router.get('/caregivers', getLinkedCaregivers);

// Remove connection
router.delete('/:id', unlinkAccount);

// Caregiver views patient data
router.get('/patients/:patientId/doses', getPatientDosesForCaregiver);

export default router;
