// User management routes — CRUD operations for users with owner-level access control.

import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';
import { requireOwner } from '../middleware/roleGuard';
import {
  ApiResponse,
  AuthenticatedRequest,
  CreateUserRequest,
  UpdateUserRequest,
  UserRole,
} from '../types';

const router = Router();

// All user routes require authentication
router.use(authenticateToken);

/**
 * GET /api/users
 *
 * Lists all users belonging to the authenticated user's firm.
 * Restricted to OWNER / ADMIN.
 */
router.get(
  '/',
  requireOwner,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const firmId = req.user!.firmId;

      const users = await prisma.user.findMany({
        where: { firmId },
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          employmentType: true,
          baseSalary: true,
          workStartTime: true,
          employmentStart: true,
          employmentEnd: true,
          phone: true,
          isActive: true,
          firmId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const response: ApiResponse<typeof users> = {
        success: true,
        data: users,
        message: `Found ${users.length} user(s)`,
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('[Users] List error:', error);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Failed to fetch users',
      };
      res.status(500).json(response);
    }
  }
);

/**
 * GET /api/users/:id
 *
 * Returns a single user by id. Any authenticated user can fetch, but
 * sensitive fields (passwordHash) are excluded.
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Invalid user id',
      };
      res.status(400).json(response);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        employmentType: true,
        baseSalary: true,
        workStartTime: true,
        employmentStart: true,
        employmentEnd: true,
        phone: true,
        isActive: true,
        firmId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'User not found',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<typeof user> = {
      success: true,
      data: user,
      message: 'User retrieved',
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('[Users] Get error:', error);
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      message: 'Failed to fetch user',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/users
 *
 * Creates a new user. Password is hashed with bcrypt before storage.
 * Restricted to OWNER / ADMIN.
 */
router.post(
  '/',
  requireOwner,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const body = req.body as CreateUserRequest;

      if (!body.username || !body.password || !body.fullName) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Username, password, and fullName are required',
        };
        res.status(400).json(response);
        return;
      }

      // Check for duplicate username
      const existing = await prisma.user.findUnique({
        where: { username: body.username },
      });

      if (existing) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Username already exists',
        };
        res.status(409).json(response);
        return;
      }

      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(body.password, salt);

      const user = await prisma.user.create({
        data: {
          username: body.username,
          passwordHash,
          fullName: body.fullName,
          role: body.role || 'PERM_EMPLOYEE',
          employmentType: body.employmentType || 'PERMANENT',
          baseSalary: body.baseSalary ?? 0,
          workStartTime: body.workStartTime || '09:00',
          phone: body.phone,
          firmId: body.firmId ?? req.user!.firmId,
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          employmentType: true,
          baseSalary: true,
          workStartTime: true,
          employmentStart: true,
          phone: true,
          isActive: true,
          firmId: true,
          createdAt: true,
        },
      });

      const response: ApiResponse<typeof user> = {
        success: true,
        data: user,
        message: 'User created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('[Users] Create error:', error);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Failed to create user',
      };
      res.status(500).json(response);
    }
  }
);

/**
 * PUT /api/users/:id
 *
 * Updates an existing user. Restricted to OWNER / ADMIN.
 * Password changes are NOT handled here — use a dedicated endpoint.
 */
router.put(
  '/:id',
  requireOwner,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);

      if (isNaN(id)) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Invalid user id',
        };
        res.status(400).json(response);
        return;
      }

      const existing = await prisma.user.findUnique({ where: { id } });

      if (!existing) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'User not found',
        };
        res.status(404).json(response);
        return;
      }

      const body = req.body as UpdateUserRequest;

      const user = await prisma.user.update({
        where: { id },
        data: {
          ...(body.fullName !== undefined && { fullName: body.fullName }),
          ...(body.role !== undefined && { role: body.role }),
          ...(body.employmentType !== undefined && { employmentType: body.employmentType }),
          ...(body.baseSalary !== undefined && { baseSalary: body.baseSalary }),
          ...(body.workStartTime !== undefined && { workStartTime: body.workStartTime }),
          ...(body.phone !== undefined && { phone: body.phone }),
          ...(body.deviceToken !== undefined && { deviceToken: body.deviceToken }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
          ...(body.employmentEnd !== undefined && {
            employmentEnd: new Date(body.employmentEnd),
          }),
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          employmentType: true,
          baseSalary: true,
          workStartTime: true,
          employmentStart: true,
          employmentEnd: true,
          phone: true,
          isActive: true,
          firmId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const response: ApiResponse<typeof user> = {
        success: true,
        data: user,
        message: 'User updated successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('[Users] Update error:', error);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Failed to update user',
      };
      res.status(500).json(response);
    }
  }
);

/**
 * DELETE /api/users/:id
 *
 * Soft-deletes a user by setting `isActive = false`.
 * Restricted to OWNER / ADMIN.
 */
router.delete(
  '/:id',
  requireOwner,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);

      if (isNaN(id)) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Invalid user id',
        };
        res.status(400).json(response);
        return;
      }

      const existing = await prisma.user.findUnique({ where: { id } });

      if (!existing) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'User not found',
        };
        res.status(404).json(response);
        return;
      }

      // Prevent self-deletion
      if (req.user!.userId === id) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'You cannot deactivate your own account',
        };
        res.status(400).json(response);
        return;
      }

      await prisma.user.update({
        where: { id },
        data: {
          isActive: false,
          employmentEnd: new Date(),
        },
      });

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'User deactivated successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('[Users] Delete error:', error);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Failed to deactivate user',
      };
      res.status(500).json(response);
    }
  }
);

export default router;
