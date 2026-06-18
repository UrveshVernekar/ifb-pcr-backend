import knex from 'knex';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { logger } from '../config/logger';
import db from '../config/database';

export async function ensureDatabaseExists() {
  const client = env.DB_CLIENT;
  const dbName = env.DB_NAME;

  const maxRetries = 15;
  const delayMs = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let tempDb;
    try {
      logger.info(`Ensuring database "${dbName}" exists for client "${client}" (Attempt ${attempt}/${maxRetries})...`);

      // We connect to the DB server without targeting the database (or using a default DB like postgres/master)
      let tempDatabase: string | undefined = undefined;
      if (client === 'pg') {
        tempDatabase = 'postgres';
      } else if (client === 'mssql') {
        tempDatabase = 'master';
      }

      const baseConfig: any = {
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
      };

      if (tempDatabase) {
        baseConfig.database = tempDatabase;
      }

      if (client === 'mssql') {
        baseConfig.options = {
          encrypt: false,
          trustServerCertificate: true,
          enableArithAbort: true,
        };
      }

      tempDb = knex({
        client,
        connection: baseConfig,
        useNullAsDefault: true,
      });

      if (client === 'mysql2') {
        await tempDb.raw(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        logger.info(`Database "${dbName}" checked/created successfully (MySQL).`);
      } else if (client === 'pg') {
        const res = await tempDb.raw(`SELECT 1 FROM pg_database WHERE datname = ?`, [dbName]);
        if (res.rows.length === 0) {
          // Postgres does not support CREATE DATABASE inside transaction block
          await tempDb.raw(`CREATE DATABASE "${dbName}"`);
          logger.info(`Database "${dbName}" created successfully (PostgreSQL).`);
        } else {
          logger.info(`Database "${dbName}" already exists (PostgreSQL).`);
        }
      } else if (client === 'mssql') {
        await tempDb.raw(`
          IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = N'${dbName}')
          BEGIN
            CREATE DATABASE [${dbName}]
          END
        `);
        logger.info(`Database "${dbName}" checked/created successfully (MSSQL).`);
      }

      await tempDb.destroy();
      return; // Success, exit function
    } catch (error: any) {
      if (tempDb) {
        try {
          await tempDb.destroy();
        } catch (_) {}
      }

      if (attempt === maxRetries) {
        logger.error(`Failed to ensure database "${dbName}" exists after ${maxRetries} attempts: ${error.message}`);
        throw error;
      }

      logger.warn(`Database connection attempt ${attempt} failed: ${error.message}. Retrying in ${delayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function createDefaultAdminUser() {
  const adminEmail = 'pcr_admin@ifbglobal.com';
  const employeeCode = '12341234';
  const fullName = 'PCR ADMIN';
  const rawPassword = 'admin@PCR1234';

  logger.info('Checking default system roles and admin user...');

  // Ensure roles table is populated with basic system roles first
  const existingRoles = await db('roles').select('role_code');
  const existingCodes = existingRoles.map((r: any) => r.role_code);

  const rolesToInsert = [
    { role_code: 'ADMIN', role_name: 'Admin', description: 'System Administrator' },
    { role_code: 'REGION_HEAD', role_name: 'Region Head', description: 'Manages a geographical region and its branches/franchises' },
    { role_code: 'BRANCH_HEAD', role_name: 'Branch Head', description: 'Manages a branch office and its franchises' },
    { role_code: 'FRANCHISE_HEAD', role_name: 'Franchise Head', description: 'Manages a franchise store/outlet' },
    { role_code: 'MANAGER', role_name: 'Manager', description: 'Branch/Franchise Manager' },
    { role_code: 'OPERATOR', role_name: 'Operator', description: 'System Operator' },
    { role_code: 'QUALITY_INSPECTOR', role_name: 'Quality Inspector', description: 'Quality Inspector' },
    { role_code: 'SAFETY_OFFICER', role_name: 'Safety Officer', description: 'Safety Officer' },
    { role_code: 'EMPLOYEE', role_name: 'Employee', description: 'Regular Employee' }
  ].filter(r => !existingCodes.includes(r.role_code));

  if (rolesToInsert.length > 0) {
    logger.info(`Seeding ${rolesToInsert.length} roles...`);
    await db('roles').insert(rolesToInsert);
  }

  // Ensure default nation is seeded (required for region references)
  const existingNations = await db('nations').select('nation_id');
  if (existingNations.length === 0) {
    logger.info('Seeding default nation (India)...');
    await db('nations').insert({
      nation_id: 1,
      name: 'India',
      code: 'IN',
      is_active: 1,
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    });
  }

  // Get the ADMIN role_id
  const adminRole = await db('roles').where({ role_code: 'ADMIN' }).first();
  if (!adminRole) {
    throw new Error('Failed to seed ADMIN role');
  }

  // Ensure default admin user is seeded
  const existingUser = await db('users').where({ email: adminEmail }).first();
  if (existingUser) {
    logger.info('Default admin user already exists.');
    return;
  }

  logger.info('Creating default admin user...');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(rawPassword, salt);

  const adminUser = {
    employee_code: employeeCode,
    full_name: fullName,
    email: adminEmail,
    password_hash: passwordHash,
    role_id: adminRole.role_id,
    is_active: 1,
    created_at: db.fn.now(),
    updated_at: db.fn.now()
  };

  await db('users').insert(adminUser);
  logger.info(`Default admin user "${adminEmail}" created successfully.`);
}
