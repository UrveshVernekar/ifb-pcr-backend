import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasUsers = await knex.schema.hasTable('users');
  if (hasUsers) {
    const hasRegionId = await knex.schema.hasColumn('users', 'region_id');
    const hasBranchId = await knex.schema.hasColumn('users', 'branch_id');
    const hasFranchiseId = await knex.schema.hasColumn('users', 'franchise_id');

    // Clean up columns if they exist from a failed run
    if (hasRegionId || hasBranchId || hasFranchiseId) {
      await knex.schema.alterTable('users', (table) => {
        if (hasRegionId) table.dropColumn('region_id');
        if (hasBranchId) table.dropColumn('branch_id');
        if (hasFranchiseId) table.dropColumn('franchise_id');
      });
    }

    // Add columns with matching integer definitions and foreign key constraints
    await knex.schema.alterTable('users', (table) => {
      table.integer('region_id').nullable().references('region_id').inTable('regions').onDelete('SET NULL');
      table.integer('branch_id').nullable().references('branch_id').inTable('branches').onDelete('SET NULL');
      table.integer('franchise_id').nullable().references('franchise_id').inTable('franchises').onDelete('SET NULL');
    });
  }

  const hasRoles = await knex.schema.hasTable('roles');
  if (hasRoles) {
    // Check if the roles already exist to prevent duplicate key errors
    const existingRoles = await knex('roles')
      .whereIn('role_code', ['REGION_HEAD', 'BRANCH_HEAD', 'FRANCHISE_HEAD'])
      .select('role_code');
    const existingCodes = existingRoles.map(r => r.role_code);

    const rolesToInsert = [
      {
        role_code: 'REGION_HEAD',
        role_name: 'Region Head',
        description: 'Manages a geographical region and its branches/franchises',
        is_active: 1,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
      {
        role_code: 'BRANCH_HEAD',
        role_name: 'Branch Head',
        description: 'Manages a branch office and its franchises',
        is_active: 1,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
      {
        role_code: 'FRANCHISE_HEAD',
        role_name: 'Franchise Head',
        description: 'Manages a franchise store/outlet',
        is_active: 1,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      }
    ].filter(r => !existingCodes.includes(r.role_code));

    if (rolesToInsert.length > 0) {
      await knex('roles').insert(rolesToInsert);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasUsers = await knex.schema.hasTable('users');
  if (hasUsers) {
    await knex.schema.alterTable('users', (table) => {
      table.dropForeign(['region_id']);
      table.dropColumn('region_id');
      table.dropForeign(['branch_id']);
      table.dropColumn('branch_id');
      table.dropForeign(['franchise_id']);
      table.dropColumn('franchise_id');
    });
  }

  const hasRoles = await knex.schema.hasTable('roles');
  if (hasRoles) {
    await knex('roles')
      .whereIn('role_code', ['REGION_HEAD', 'BRANCH_HEAD', 'FRANCHISE_HEAD'])
      .delete();
  }
}
