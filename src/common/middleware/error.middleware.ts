import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/ApiError';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors: any = null;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else {
    // Unhandled operational / programming errors
    logger.error(`Unhandled Error: ${err.message}`, { stack: err.stack, path: req.path });
    
    if (env.NODE_ENV === 'development') {
      message = err.message;
      errors = err.stack;
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(env.NODE_ENV === 'development' && !(err instanceof ApiError) && { stack: err.stack }),
  });
};

export default errorMiddleware;
