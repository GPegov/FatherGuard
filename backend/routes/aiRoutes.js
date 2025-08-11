import express from 'express';
const router = express.Router();
import aiController from '../controllers/aiController.js';

router.post('/analyze', aiController.analyzeText);
router.post('/generate-complaint', aiController.generateComplaint);

export default router;