import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Alter users table if it exists
  const hasUsers = await knex.schema.hasTable('users');
  if (hasUsers) {
    const hasRefreshToken = await knex.schema.hasColumn('users', 'refresh_token');
    if (hasRefreshToken) {
      await knex.schema.alterTable('users', (table) => {
        table.text('refresh_token').alter();
      });
    }
  }

  // Alter employees table if it exists
  const hasEmployees = await knex.schema.hasTable('employees');
  if (hasEmployees) {
    const hasRefreshToken = await knex.schema.hasColumn('employees', 'refresh_token');
    if (hasRefreshToken) {
      await knex.schema.alterTable('employees', (table) => {
        table.text('refresh_token').alter();
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasUsers = await knex.schema.hasTable('users');
  if (hasUsers) {
    const hasRefreshToken = await knex.schema.hasColumn('users', 'refresh_token');
    if (hasRefreshToken) {
      await knex.schema.alterTable('users', (table) => {
        table.string('refresh_token', 255).alter();
      });
    }
  }

  const hasEmployees = await knex.schema.hasTable('employees');
  if (hasEmployees) {
    const hasRefreshToken = await knex.schema.hasColumn('employees', 'refresh_token');
    if (hasRefreshToken) {
      await knex.schema.alterTable('employees', (table) => {
        table.string('refresh_token', 255).alter();
      });
    }
  }
}
