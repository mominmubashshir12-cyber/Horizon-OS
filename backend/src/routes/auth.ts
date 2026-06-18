// Authentication routes — handles login (username/password → JWT pair) and token refresh.

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  RefreshResponse,
  TokenPayload,
  UserRole,
} from '../types';

const router = Router();

/**
 * POST /api/auth/login
 *
 * Authenticates a user by username + password and returns a JWT access/refresh
 * token pair along with basic user info.
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body as LoginRequest;

    if (!username || !password) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Username and password are required',
      };
      res.status(400).json(response);
      return;
    }

    // Look up user
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.isActive) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Invalid credentials',
      };
      res.status(401).json(response);
      return;
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Invalid credentials',
      };
      res.status(401).json(response);
      return;
    }

    // Build token payload
    const tokenPayload: TokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role as UserRole,
      firmId: user.firmId,
    };

    const accessToken = jwt.sign(tokenPayload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    });

    const refreshToken = jwt.sign(tokenPayload, config.jwtRefreshSecret, {
      expiresIn: config.jwtRefreshExpiresIn,
    });

    const data: LoginResponse = {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role as UserRole,
        firmId: user.firmId,
      },
    };

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data,
      message: 'Login successful',
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('[Auth] Login error:', error);
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      message: 'An error occurred during login',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/auth/refresh
 *
 * Accepts a valid refresh token and issues a fresh access token.
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body as RefreshRequest;

    if (!refreshToken) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Refresh token is required',
      };
      res.status(400).json(response);
      return;
    }

    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as TokenPayload;

    // Build a new access token with the same payload
    const newPayload: TokenPayload = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      firmId: decoded.firmId,
    };

    const accessToken = jwt.sign(newPayload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    });

    const data: RefreshResponse = { accessToken };

    const response: ApiResponse<RefreshResponse> = {
      success: true,
      data,
      message: 'Token refreshed',
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('[Auth] Refresh error:', error);
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      message: 'Invalid or expired refresh token',
    };
    res.status(403).json(response);
  }
});

export default router;
