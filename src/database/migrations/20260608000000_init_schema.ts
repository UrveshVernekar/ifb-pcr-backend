import type { Knex } from "knex";

async function ensureAuditColumns(knex: Knex, tableName: string) {
  if (await knex.schema.hasTable(tableName)) {
    const hasCreatedBy = await knex.schema.hasColumn(tableName, 'created_by');
    const hasUpdatedBy = await knex.schema.hasColumn(tableName, 'updated_by');
    const hasDeletedAt = await knex.schema.hasColumn(tableName, 'deleted_at');
    const hasDeletedBy = await knex.schema.hasColumn(tableName, 'deleted_by');

    if (!hasCreatedBy || !hasUpdatedBy || !hasDeletedAt || !hasDeletedBy) {
      await knex.schema.alterTable(tableName, (table) => {
        if (!hasCreatedBy) table.integer('created_by').unsigned().nullable();
        if (!hasUpdatedBy) table.integer('updated_by').unsigned().nullable();
        if (!hasDeletedAt) table.timestamp('deleted_at').nullable();
        if (!hasDeletedBy) table.integer('deleted_by').unsigned().nullable();
      });
    }
  }
}

async function safeAddForeignKeys(knex: Knex, tableName: string) {
  try {
    await knex.schema.alterTable(tableName, (table) => {
      table.foreign('created_by').references('user_id').inTable('users').onDelete('SET NULL');
    });
  } catch (err) {
    // Ignore if constraint already exists
  }
  try {
    await knex.schema.alterTable(tableName, (table) => {
      table.foreign('updated_by').references('user_id').inTable('users').onDelete('SET NULL');
    });
  } catch (err) {
    // Ignore if constraint already exists
  }
  try {
    await knex.schema.alterTable(tableName, (table) => {
      table.foreign('deleted_by').references('user_id').inTable('users').onDelete('SET NULL');
    });
  } catch (err) {
    // Ignore if constraint already exists
  }
}

export async function up(knex: Knex): Promise<void> {
  // 1. Roles Master
  if (!(await knex.schema.hasTable('roles'))) {
    await knex.schema.createTable('roles', (table) => {
      table.increments('role_id').primary();
      table.string('role_code', 50).unique().notNullable();
      table.string('role_name', 100).notNullable();
      table.text('description').nullable();
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.integer('created_by').unsigned().nullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.integer('updated_by').unsigned().nullable();
      table.timestamp('deleted_at').nullable();
      table.integer('deleted_by').unsigned().nullable();
    });
  } else {
    await ensureAuditColumns(knex, 'roles');
  }

  // 2. Nations Master
  if (!(await knex.schema.hasTable('nations'))) {
    await knex.schema.createTable('nations', (table) => {
      table.increments('nation_id').primary();
      table.string('name', 100).notNullable();
      table.string('code', 10).unique().nullable();
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.integer('created_by').unsigned().nullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.integer('updated_by').unsigned().nullable();
      table.timestamp('deleted_at').nullable();
      table.integer('deleted_by').unsigned().nullable();
    });
  } else {
    await ensureAuditColumns(knex, 'nations');
  }

  // 3. Regions Master
  if (!(await knex.schema.hasTable('regions'))) {
    await knex.schema.createTable('regions', (table) => {
      table.increments('region_id').primary();
      table.integer('nation_id').unsigned().notNullable().references('nation_id').inTable('nations').onDelete('CASCADE');
      table.string('name', 100).notNullable();
      table.string('code', 20).nullable();
      table.text('description').nullable();
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.integer('created_by').unsigned().nullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.integer('updated_by').unsigned().nullable();
      table.timestamp('deleted_at').nullable();
      table.integer('deleted_by').unsigned().nullable();
      table.unique(['nation_id', 'name']);
    });
  } else {
    await ensureAuditColumns(knex, 'regions');
  }

  // 4. Branches Master
  if (!(await knex.schema.hasTable('branches'))) {
    await knex.schema.createTable('branches', (table) => {
      table.increments('branch_id').primary();
      table.integer('region_id').unsigned().notNullable().references('region_id').inTable('regions').onDelete('CASCADE');
      table.string('name', 100).notNullable();
      table.string('code', 50).unique().nullable();
      table.text('address').nullable();
      table.string('city', 100).nullable();
      table.string('state', 100).nullable();
      table.string('contact_number', 20).nullable();
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.integer('created_by').unsigned().nullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.integer('updated_by').unsigned().nullable();
      table.timestamp('deleted_at').nullable();
      table.integer('deleted_by').unsigned().nullable();
      table.unique(['region_id', 'name']);
    });
  } else {
    await ensureAuditColumns(knex, 'branches');
  }

  // 5. Factories Master
  if (!(await knex.schema.hasTable('factories'))) {
    await knex.schema.createTable('factories', (table) => {
      table.increments('factory_id').primary();
      table.integer('nation_id').unsigned().notNullable().references('nation_id').inTable('nations').onDelete('CASCADE');
      table.string('name', 150).notNullable();
      table.string('code', 50).unique().nullable();
      table.string('location', 150).nullable();
      table.text('address').nullable();
      table.string('contact_number', 20).nullable();
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.integer('created_by').unsigned().nullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.integer('updated_by').unsigned().nullable();
      table.timestamp('deleted_at').nullable();
      table.integer('deleted_by').unsigned().nullable();
    });
  } else {
    await ensureAuditColumns(knex, 'factories');
  }

  // 6. Branch-Factory-Mapping
  if (!(await knex.schema.hasTable('branch_factory_mapping'))) {
    await knex.schema.createTable('branch_factory_mapping', (table) => {
      table.integer('branch_id').unsigned().notNullable().references('branch_id').inTable('branches').onDelete('CASCADE');
      table.integer('factory_id').unsigned().notNullable().references('factory_id').inTable('factories').onDelete('CASCADE');
      table.primary(['branch_id', 'factory_id']);
    });
  }

  // 7. Franchises
  if (!(await knex.schema.hasTable('franchises'))) {
    await knex.schema.createTable('franchises', (table) => {
      table.increments('franchise_id').primary();
      table.integer('branch_id').unsigned().notNullable().references('branch_id').inTable('branches').onDelete('CASCADE');
      table.string('name', 150).notNullable();
      table.string('code', 50).unique().nullable();
      table.string('contact_person', 100).nullable();
      table.string('contact_email', 150).nullable();
      table.text('address').nullable();
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.integer('created_by').unsigned().nullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.integer('updated_by').unsigned().nullable();
      table.timestamp('deleted_at').nullable();
      table.integer('deleted_by').unsigned().nullable();
    });
  } else {
    await ensureAuditColumns(knex, 'franchises');
  }

  // 8. Users
  if (!(await knex.schema.hasTable('users'))) {
    await knex.schema.createTable('users', (table) => {
      table.increments('user_id').primary();
      table.string('employee_code', 50).unique().nullable();
      table.string('full_name', 150).notNullable();
      table.string('email', 150).unique().nullable();
      table.string('phone', 20).nullable();
      table.integer('role_id').unsigned().notNullable().references('role_id').inTable('roles').onDelete('RESTRICT');
      table.integer('reports_to').unsigned().nullable().references('user_id').inTable('users').onDelete('SET NULL');
      table.string('password_hash', 255).nullable();
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.integer('created_by').unsigned().nullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.integer('updated_by').unsigned().nullable();
      table.timestamp('deleted_at').nullable();
      table.integer('deleted_by').unsigned().nullable();
    });
  } else {
    await ensureAuditColumns(knex, 'users');
  }

  // 9. Add Audit Foreign Key Constraints safely
  const auditTables = ['roles', 'nations', 'regions', 'branches', 'factories', 'franchises', 'users'];
  for (const tableName of auditTables) {
    await safeAddForeignKeys(knex, tableName);
  }
}

export async function down(knex: Knex): Promise<void> {
  const auditTables = ['roles', 'nations', 'regions', 'branches', 'factories', 'franchises', 'users'];
  
  for (const tableName of auditTables) {
    if (await knex.schema.hasTable(tableName)) {
      try {
        await knex.schema.alterTable(tableName, (table) => {
          table.dropForeign(['created_by']);
        });
      } catch (err) {}
      try {
        await knex.schema.alterTable(tableName, (table) => {
          table.dropForeign(['updated_by']);
        });
      } catch (err) {}
      try {
        await knex.schema.alterTable(tableName, (table) => {
          table.dropForeign(['deleted_by']);
        });
      } catch (err) {}
    }
  }

  await knex.schema.dropTableIfExists('branch_factory_mapping');
  await knex.schema.dropTableIfExists('franchises');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('factories');
  await knex.schema.dropTableIfExists('branches');
  await knex.schema.dropTableIfExists('regions');
  await knex.schema.dropTableIfExists('nations');
  await knex.schema.dropTableIfExists('roles');
}
