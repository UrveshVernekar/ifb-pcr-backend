import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Create otp_store table if it doesn't exist
  const hasOtpStore = await knex.schema.hasTable('otp_store');
  if (!hasOtpStore) {
    await knex.schema.createTable('otp_store', (table) => {
      table.increments('otp_id').primary();
      table.string('email', 150).notNullable();
      table.string('id', 50).notNullable(); // stores employee code
      table.string('otp', 10).notNullable();
      table.bigInteger('expiry').notNullable();
    });
  }

  // Alter users table if it exists
  const hasUsers = await knex.schema.hasTable('users');
  if (hasUsers) {
    const hasOldPassword = await knex.schema.hasColumn('users', 'old_password_hash');
    const hasLastLogin = await knex.schema.hasColumn('users', 'last_login_at');
    const hasRefreshToken = await knex.schema.hasColumn('users', 'refresh_token');
    const hasRefreshTokenExpires = await knex.schema.hasColumn('users', 'refresh_token_expires_at');

    await knex.schema.alterTable('users', (table) => {
      if (!hasOldPassword) {
        table.string('old_password_hash', 255).nullable();
      }
      if (!hasLastLogin) {
        table.timestamp('last_login_at').nullable();
      }
      if (!hasRefreshToken) {
        table.string('refresh_token', 255).nullable();
      }
      if (!hasRefreshTokenExpires) {
        table.timestamp('refresh_token_expires_at').nullable();
      }
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasUsers = await knex.schema.hasTable('users');
  if (hasUsers) {
    await knex.schema.alterTable('users', (table) => {
      try {
        table.dropColumn('old_password_hash');
        table.dropColumn('last_login_at');
        table.dropColumn('refresh_token');
        table.dropColumn('refresh_token_expires_at');
      } catch (e) {
        // ignore if columns don't exist
      }
    });
  }

  await knex.schema.dropTableIfExists('otp_store');
}
