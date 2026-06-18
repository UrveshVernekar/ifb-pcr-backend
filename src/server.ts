import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import db from './config/database';
import { ensureDatabaseExists, createDefaultAdminUser } from './database/init-db';

const startServer = async () => {
  try {
    logger.info('Initializing application bootstrap...');

    // 1. Ensure database exists
    await ensureDatabaseExists();

    // 2. Test database connection
    logger.info(`Testing connection to database client: ${env.DB_CLIENT}...`);
    await db.raw('SELECT 1');
    logger.info('Database connection verified successfully.');

    // 3. Run database migrations automatically
    logger.info('Running database migrations...');
    await db.migrate.latest();
    logger.info('Database migrations completed successfully.');

    // 4. Create default admin user
    await createDefaultAdminUser();

    // Start Express server
    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Server running in [${env.NODE_ENV}] mode on port ${env.PORT}`);
    });

    // Graceful Shutdown helper
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(() => {
        logger.info('HTTP server closed.');
      });

      try {
        await db.destroy();
        logger.info('Database connection pool destroyed.');
        process.exit(0);
      } catch (err) {
        logger.error('Error during graceful shutdown:', err);
        process.exit(1);
      }
    };

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error: any) {
    logger.error('Fatal error during application startup: ' + error.message, { stack: error.stack });
    process.exit(1);
  }
};

startServer();
