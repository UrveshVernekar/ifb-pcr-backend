import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('pcr_physical_verifications');
  if (!hasTable) {
    await knex.schema.createTable('pcr_physical_verifications', (table) => {
      table.bigIncrements('id').primary();
      table.string('ticket_id', 100).notNullable();
      table.string('part_code', 100).notNullable();
      table.string('status', 50).notNullable().defaultTo('Pending');
      table.string('condition', 50).notNullable().defaultTo('OK');
      table.text('remarks').nullable();
      table.bigInteger('verified_by').unsigned().nullable();
      table.timestamp('verified_at').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // Foreign key
      table.foreign('verified_by').references('user_id').inTable('users').onDelete('SET NULL');

      // Unique constraint for upsert
      table.unique(['ticket_id', 'part_code'], { indexName: 'uq_pcr_verification_ticket_part' });
      
      // Index for search optimization
      table.index(['ticket_id'], 'idx_pcr_verification_ticket');
      table.index(['part_code'], 'idx_pcr_verification_part');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('pcr_physical_verifications');
}
