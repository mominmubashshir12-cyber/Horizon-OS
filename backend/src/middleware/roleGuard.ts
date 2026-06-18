// Role-based authorisation guards — restricts route access based on the authenticated user's role.

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse, UserRole } from '../types';

const PRIVILEGED_ROLES: ReadonlySet<UserRole> = new Set(['OWNER', 'ADMIN']);

/**
 * Middleware that allows only OWNER or ADMIN roles through.
 * Must be placed after `authenticateToken`.
 */
export function requireOwner(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      message: 'Authentication required',
    };
    res.status(401).json(response);
    return;
  }

  if (!PRIVILEGED_ROLES.has(req.user.role)) {
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      message: 'Insufficient permissions — owner or admin access required',
    };
    res.status(403).json(response);
    return;
  }

  next();
}

/**
 * Middleware that allows any authenticated user through.
 * Essentially a no-op guard useful for readability in route definitions.
 */
export function requireEmployee(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      message: 'Authentication required',
    };
    res.status(401).json(response);
    return;
  }

  next();
}

/**
 * Factory that returns middleware allowing OWNER/ADMIN through, **or** the user
 * whose id matches the named route parameter (e.g. `:userId`).
 *
 * @param paramName - The name of the route parameter that holds the target user id.
 *
 * @example
 * router.get('/:userId/profile', requireOwnerOrSelf('userId'), handler);
 */
export function requireOwnerOrSelf(paramName: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Authentication required',
      };
      res.status(401).json(response);
      return;
    }

    const targetId = parseInt(req.params[paramName] as string, 10);

    if (PRIVILEGED_ROLES.has(req.user.role) || req.user.userId === targetId) {
      next();
      return;
    }

    const response: ApiResponse<null> = {
      success: false,
      data: null,
      message: 'You can only access your own resource, or must be an owner/admin',
    };
    res.status(403).json(response);
    return;
  };
}
