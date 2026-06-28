// JWT authentication middleware — extracts and verifies Bearer tokens, attaches decoded payload to the request.

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { TokenPayload, ApiResponse, AuthenticatedRequest } from '../types';

/**
 * Express middleware that enforces JWT authentication.
 *
 * - Reads the `Authorization: Bearer <token>` header.
 * - Verifies the token against `JWT_SECRET`.
 * - Attaches the decoded `TokenPayload` to `req.user`.
 * - Returns 401 if no token is present, 403 if verification fails.
 */
export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!token) {
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      message: 'Authentication required — no token provided',
    };
    res.status(401).json(response);
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
    req.user = decoded;
    next();
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      message: 'Invalid or expired token',
    };
    res.status(401).json(response);
    return;
  }
}
