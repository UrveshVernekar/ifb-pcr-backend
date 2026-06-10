import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiError } from '../errors/ApiError';

export const validate = (schema: z.ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      }) as any;
      // Replace req with parsed inputs for strict typing if desired,
      // but keeping standard assignment ensures properties are available.
      req.body = parsed.body;
      
      Object.defineProperty(req, 'query', {
        value: parsed.query,
        writable: true,
        configurable: true,
        enumerable: true
      });
      
      Object.defineProperty(req, 'params', {
        value: parsed.params,
        writable: true,
        configurable: true,
        enumerable: true
      });
      
      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = (error as any).errors.map((err: any) => ({
          field: err.path.slice(1).join('.'), // Remove 'body', 'query', or 'params' prefix
          message: err.message,
        }));
        return next(new ApiError(400, 'Validation failed', formattedErrors));
      }
      return next(error);
    }
  };
};

export default validate;
