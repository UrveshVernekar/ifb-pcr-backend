import type { Knex } from "knex";

async function createValidationTable(knex: Knex, tableName: string) {
  if (!(await knex.schema.hasTable(tableName))) {
    await knex.schema.createTable(tableName, (table) => {
      table.bigIncrements('Id').primary();
      table.string('PlanOrder', 50).nullable();
      table.string('ProductBarcode', 50).nullable();
      table.string('Part1_Barcode', 200).nullable();
      table.string('Part2_Barcode', 200).nullable();
      table.bigInteger('Serial_No').nullable();
      table.bigInteger('ModelId').nullable();
      table.string('ModelName', 200).nullable();
      table.string('ModelNo', 250).nullable();
      table.bigInteger('SupplierId').nullable();
      table.string('SupplierName', 200).nullable();
      table.bigInteger('StageID').nullable();
      table.string('StageName', 200).nullable();
      table.boolean('IsMatched').nullable();
      table.dateTime('CreatedDate').nullable();
      table.specificType('Barcode_Status', 'char(2)').nullable();
      table.integer('Lot_No').nullable();
      table.string('assline', 100).nullable();
      table.string('ProductBarcode_cust', 200).nullable();
      table.bigInteger('Mbomversionid').nullable();
      table.double('Qty').nullable();
      table.string('UOM', 200).nullable();
      table.string('Part3_Barcode', 255).nullable();
      table.string('Part1_Barcode_Rework', 255).nullable();
      table.string('Part2_Barcode_Rework', 255).nullable();
      table.string('Part3_Barcode_Rework', 255).nullable();

      // Indexes
      table.index(['Part1_Barcode'], 'idx_part1_barcode');
      table.index(['Part2_Barcode'], 'idx_part2_barcode');
      table.index(['Part3_Barcode'], 'idx_part3_barcode');
      table.index(['ProductBarcode'], 'idx_product_barcode');
    });
  }
}

export async function up(knex: Knex): Promise<void> {
  // Create tables
  await createValidationTable(knex, 'initial_validation');
  await createValidationTable(knex, 'initial_validation_archive');

  // Create MySQL Stored Procedures (only if the client is MySQL)
  const isMySQL = knex.client.config.client === 'mysql2' || knex.client.config.client === 'mysql';
  
  if (isMySQL) {
    // 1. sp_get_machine_history_by_barcode
    await knex.raw('DROP PROCEDURE IF EXISTS `sp_get_machine_history_by_barcode`');
    await knex.raw(`
      CREATE PROCEDURE \`sp_get_machine_history_by_barcode\`(
          IN p_barcode VARCHAR(255)
      )
      BEGIN
          DECLARE v_product_barcode VARCHAR(255);

          -- First search in initial_validation
          SELECT ProductBarcode
          INTO v_product_barcode
          FROM (
              SELECT ProductBarcode
              FROM initial_validation
              WHERE Part1_Barcode = p_barcode

              UNION ALL

              SELECT ProductBarcode
              FROM initial_validation
              WHERE Part2_Barcode = p_barcode

              UNION ALL

              SELECT ProductBarcode
              FROM initial_validation
              WHERE Part3_Barcode = p_barcode
          ) t
          LIMIT 1;

          -- If not found, search in archive
          IF v_product_barcode IS NULL THEN

              SELECT ProductBarcode
              INTO v_product_barcode
              FROM (
                  SELECT ProductBarcode
                  FROM initial_validation_archive
                  WHERE Part1_Barcode = p_barcode

                  UNION ALL

                  SELECT ProductBarcode
                  FROM initial_validation_archive
                  WHERE Part2_Barcode = p_barcode

                  UNION ALL

                  SELECT ProductBarcode
                  FROM initial_validation_archive
                  WHERE Part3_Barcode = p_barcode
              ) a
              LIMIT 1;

              -- Return results from archive
              SELECT *
              FROM initial_validation_archive
              WHERE ProductBarcode = v_product_barcode AND Barcode_Status = "OK"
              ORDER BY Id;

          ELSE

              -- Return results from live table
              SELECT *
              FROM initial_validation
              WHERE ProductBarcode = v_product_barcode AND Barcode_Status = "OK"
              ORDER BY Id;

          END IF;

      END
    `);

    // 2. sp_get_machine_history_by_product_barcode
    await knex.raw('DROP PROCEDURE IF EXISTS `sp_get_machine_history_by_product_barcode`');
    await knex.raw(`
      CREATE PROCEDURE \`sp_get_machine_history_by_product_barcode\`(
          IN p_product_barcode VARCHAR(255)
      )
      BEGIN

          IF EXISTS (
              SELECT 1
              FROM initial_validation
              WHERE ProductBarcode = p_product_barcode
              LIMIT 1
          ) THEN

              SELECT *
              FROM initial_validation
              WHERE ProductBarcode = p_product_barcode AND Barcode_Status = "OK"
              ORDER BY Id;

          ELSE

              SELECT *
              FROM initial_validation_archive
              WHERE ProductBarcode = p_product_barcode AND Barcode_Status = "OK"
              ORDER BY Id;

          END IF;

      END
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  const isMySQL = knex.client.config.client === 'mysql2' || knex.client.config.client === 'mysql';
  
  if (isMySQL) {
    await knex.raw('DROP PROCEDURE IF EXISTS `sp_get_machine_history_by_barcode`');
    await knex.raw('DROP PROCEDURE IF EXISTS `sp_get_machine_history_by_product_barcode`');
  }

  await knex.schema.dropTableIfExists('initial_validation');
  await knex.schema.dropTableIfExists('initial_validation_archive');
}
