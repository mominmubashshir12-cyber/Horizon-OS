// Global error-handling middleware — catches unhandled errors and returns a standardised JSON response.

import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';
import { config } from '../config';

/**
 * Custom application error with an HTTP status code.
 */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Express error-handling middleware (4-argument signature).
 *
 * - Logs the error stack in development.
 * - Maps `AppError` instances to their status codes.
 * - Falls back to 500 for unknown errors.
 * - Always returns { success: false, data: null, message }.
 */
export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log in non-production environments
  if (!config.isProduction) {
    console.error('[ErrorHandler]', err.stack || err.message);
  }

  const statusCode = err instanceof AppError ? err.statusCode : 500;

  const message = config.isProduction && statusCode === 500
    ? 'An internal server error occurred'
    : err.message || 'An unexpected error occurred';

  const response: ApiResponse<null> = {
    success: false,
    data: null,
    message,
  };

  res.status(statusCode).json(response);
}
