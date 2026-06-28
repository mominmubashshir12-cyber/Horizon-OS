import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { ApiResponse } from '../types';

export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Zod standard stripping is the default behavior. We do not use .strict().
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Validation failed',
        };
        res.status(400).json(response);
      } else {
        next(error);
      }
    }
  };
}
