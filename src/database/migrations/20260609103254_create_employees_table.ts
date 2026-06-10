import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('employees', (table) => {
    table.increments('id').primary();
    table.string('employee_id', 50).unique().nullable();
    table.string('name', 100).notNullable();
    table.string('email', 150).unique().notNullable();
    table.string('password_hash', 255).notNullable();
    table.string('role', 50).notNullable().defaultTo('EMPLOYEE');
    table.text('permissions').nullable(); // Stored as a serialized JSON array string
    table.string('refresh_token', 255).nullable();
    table.timestamp('refresh_token_expires_at').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true); // Adds created_at and updated_at with current timestamps
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('employees');
}

