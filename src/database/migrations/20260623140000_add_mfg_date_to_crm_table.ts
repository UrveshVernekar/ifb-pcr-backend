import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('crm_data');
  if (hasTable) {
    const hasMfgYear = await knex.schema.hasColumn('crm_data', 'mfg_year');
    const hasMfgMonth = await knex.schema.hasColumn('crm_data', 'mfg_month');

    await knex.schema.alterTable('crm_data', (table) => {
      if (!hasMfgYear) {
        table.integer('mfg_year').nullable();
      }
      if (!hasMfgMonth) {
        table.integer('mfg_month').nullable();
      }
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('crm_data');
  if (hasTable) {
    await knex.schema.alterTable('crm_data', (table) => {
      table.dropColumn('mfg_year');
      table.dropColumn('mfg_month');
    });
  }
}
