import knex, { Knex } from 'knex';
import { env } from './env';
import { logger } from './logger';

const getConnectionConfig = () => {
  const baseConfig: any = {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  };

  if (env.DB_CLIENT === 'mssql') {
    // Add SQL Server specific settings
    baseConfig.options = {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
    };
  }

  return baseConfig;
};

export const knexConfig: Knex.Config = {
  client: env.DB_CLIENT,
  connection: getConnectionConfig(),
  pool: {
    min: 2,
    max: 10,
    afterCreate: (conn: any, done: Function) => {
      // Dialect-specific connection testing/setup
      logger.info(`Database connection established for client: ${env.DB_CLIENT}`);
      done(null, conn);
    },
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: './src/database/migrations',
  },
  seeds: {
    directory: './src/database/seeders',
  },
};

const db: Knex = knex(knexConfig);

export default db;
