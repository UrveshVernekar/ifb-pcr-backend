import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { logger } from './config/logger';
import apiRouter from './routes';
import { errorMiddleware } from './common/middleware/error.middleware';
import { ApiError } from './common/errors/ApiError';

const app: Express = express();

// Security Middlewares
app.use(helmet());
app.use(
  cors({
    origin: true, // In production, replace with specific domain(s) or dynamic check
    credentials: true,
  })
);

// Body and Cookie Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logger middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.http(`${req.method} ${req.originalUrl}`);
  next();
});

// API Routes
app.use('/api/v1', apiRouter);

// Base health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date(),
    database: env.DB_CLIENT,
  });
});

// Handle undefined routes
app.use((req: Request, res: Response, next: NextFunction) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
});

// Global Error Handler
app.use(errorMiddleware);

export default app;
