import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('pcr_data');
  if (hasTable) {
    await knex.schema.dropTableIfExists('pcr_data');
  }

  await knex.schema.createTable('pcr_data', (table) => {
    table.bigIncrements('id').primary();
    
    // Selected Upload Metadata
    table.integer('selected_branch_id').notNullable();
    table.integer('selected_month').notNullable();
    table.integer('selected_year').notNullable();
    
    // Corrected 6 Columns from Excel file layout
    table.string('zone', 100).nullable();
    table.string('branch', 255).nullable();
    table.string('machine_serial', 255).nullable();
    table.string('part_code', 100).nullable();
    table.string('part_description', 255).nullable();
    table.string('ticker_number', 100).nullable();

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Foreign key constraint
    table.foreign('selected_branch_id').references('branch_id').inTable('branches').onDelete('CASCADE');

    // Index optimizations
    table.index(['selected_branch_id', 'selected_month', 'selected_year'], 'idx_pcr_metadata');
    table.index(['ticker_number'], 'idx_pcr_ticker');
    table.index(['machine_serial'], 'idx_pcr_machine_serial');
    table.index(['part_code'], 'idx_pcr_part_code');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('pcr_data');
}
