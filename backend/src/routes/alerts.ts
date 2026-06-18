// Alerts routes — manages system alerts, notifications, and read/dismiss status.

import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { AuthenticatedRequest, ApiResponse } from '../types';

const router = Router();

router.use(authenticateToken);

/** GET /api/alerts — placeholder */
router.get('/', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const response: ApiResponse<null> = {
    success: true,
    data: null,
    message: 'Alerts routes coming soon',
  };
  res.status(200).json(response);
});

export default router;
