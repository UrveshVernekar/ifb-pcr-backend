import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('crm_data');
  if (!hasTable) {
    await knex.schema.createTable('crm_data', (table) => {
      table.bigIncrements('id').primary();
      table.integer('month').notNullable();
      table.integer('year').notNullable();
      
      table.string('branch', 255).nullable();
      table.string('franchise', 255).nullable();
      table.string('fr_type', 50).nullable();
      table.string('fr_code', 100).nullable();
      table.string('spu_no', 100).nullable();
      table.string('spu_status', 100).nullable();
      table.integer('ageing').nullable();
      table.date('call_booked_date').nullable();
      table.date('soft_closure_date').nullable();
      table.integer('ageing_from_soft_closure').nullable();
      table.date('call_closed_date').nullable();
      table.integer('ageing_from_hard_closure').nullable();
      table.date('spu_created_date').nullable();
      table.date('se_approved_date').nullable();
      table.integer('ageing_from_se_apr_date').nullable();
      table.date('stores_approved_date').nullable();
      table.string('customer_code', 100).nullable();
      table.string('cust_id_hdr', 100).nullable();
      table.string('customer_name', 255).nullable();
      table.string('pincode', 20).nullable();
      table.string('ticket', 100).nullable();
      table.string('call_type', 100).nullable();
      table.string('service_type', 100).nullable();
      table.string('machine_status', 100).nullable();
      table.string('product', 255).nullable();
      table.string('product_category', 100).nullable();
      table.string('sub_category', 100).nullable();
      table.string('model_name', 255).nullable();
      table.string('serial_number', 255).nullable();
      table.string('odu_ser_no', 255).nullable();
      table.date('dop').nullable();
      table.date('doi').nullable();
      table.date('doe').nullable();
      table.string('technician', 255).nullable();
      table.string('item_code', 100).nullable();
      table.string('description', 255).nullable();
      table.string('zdp', 50).nullable();
      table.integer('spu_qty').nullable();
      table.integer('approved_qty').nullable();
      table.integer('pending_qty').nullable();
      table.string('se_rej_reason', 255).nullable();
      table.string('so_rej_reason', 255).nullable();
      table.string('loss_making', 50).nullable();
      table.string('days_45', 50).nullable();
      table.string('repeat_call', 50).nullable();
      table.string('hv', 50).nullable();
      table.string('rpf', 50).nullable();
      table.text('problem_description').nullable();
      table.string('serial_item', 255).nullable();
      table.string('sa_analysis_remark', 255).nullable();
      table.integer('dc_qty').nullable();
      table.string('pend_dlv_stat', 100).nullable();
      table.string('grn_no', 100).nullable();
      table.string('dc_no', 100).nullable();
      table.integer('approved_qty_dc').nullable();
      table.integer('dc_qty_dc').nullable();
      table.integer('received_qty').nullable();
      table.integer('rej_qty').nullable();
      table.string('z_tkt_doc', 100).nullable();
      table.string('tkt_call_typ', 100).nullable();
      table.string('serial_hdr', 255).nullable();
      table.string('po_ref_no', 100).nullable();
      table.string('follow_up_doc', 100).nullable();

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // Indexes for high performance searches
      table.index(['month', 'year'], 'idx_crm_month_year');
      table.index(['ticket'], 'idx_crm_ticket');
      table.index(['serial_number'], 'idx_crm_serial_number');
      table.index(['item_code'], 'idx_crm_item_code');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('crm_data');
}
