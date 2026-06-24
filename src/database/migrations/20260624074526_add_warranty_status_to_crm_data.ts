import type { Knex } from "knex";

function getUtcDateOnly(dateInput: any): Date | null {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('crm_data');
  if (hasTable) {
    const hasWarrantyStatus = await knex.schema.hasColumn('crm_data', 'warranty_status');
    if (!hasWarrantyStatus) {
      await knex.schema.alterTable('crm_data', (table) => {
        table.string('warranty_status', 50).nullable();
      });
    }

    // Backfill existing records
    console.log('Backfilling warranty_status for existing crm_data records...');
    
    // Check if tables exist
    const hasRulesTable = await knex.schema.hasTable('warranty_rules');
    const hasPartsTable = await knex.schema.hasTable('part_warrenty_details');
    
    if (hasRulesTable && hasPartsTable) {
      // 1. Fetch rules
      const rules = await knex('warranty_rules').select('*');
      
      // 2. Fetch part details
      const partDetails = await knex('part_warrenty_details').select('part_code', 'part_type');
      const partDetailsMap: { [key: string]: string } = {};
      for (const p of partDetails) {
        if (p.part_code) {
          partDetailsMap[p.part_code] = p.part_type;
        }
      }

      // 3. Fetch crm_data records in batches to prevent out-of-memory errors
      let offset = 0;
      const limit = 500;
      let hasMore = true;

      while (hasMore) {
        const rows = await knex('crm_data')
          .select('id', 'item_code', 'serial_number', 'mfg_year', 'dop', 'doi', 'call_booked_date')
          .limit(limit)
          .offset(offset);

        if (rows.length === 0) {
          hasMore = false;
          break;
        }

        console.log(`Processing batch of ${rows.length} rows (offset: ${offset})...`);

        await knex.transaction(async (trx) => {
          for (const row of rows) {
            const partType = partDetailsMap[row.item_code];
            
            let mfgYearVal = row.mfg_year;
            // Parse mfg_year from serial if null
            if (mfgYearVal === null && row.serial_number && row.serial_number.length >= 10) {
              const yearStr = row.serial_number.substring(6, 8);
              const parsed = parseInt(yearStr, 10);
              if (!isNaN(parsed)) {
                mfgYearVal = parsed;
              }
            }

            let mfgYear4Digit = mfgYearVal !== null ? (2000 + mfgYearVal) : null;
            if (mfgYear4Digit === null) {
              const refDate = row.dop || row.doi;
              if (refDate) {
                mfgYear4Digit = new Date(refDate).getFullYear();
              }
            }

            const effectiveInstDate = row.doi ? new Date(row.doi) : (row.dop ? new Date(row.dop) : null);
            const callBooked = row.call_booked_date ? new Date(row.call_booked_date) : null;

            let duration: number | null = null;
            let calculatedStatus = 'OG';

            if (partType) {
              const partRules = rules.filter((r: any) => r.part_type === partType);
              for (const rule of partRules) {
                let mfgMatch = true;
                if (rule.mfg_year_from !== null) {
                  mfgMatch = mfgMatch && (mfgYear4Digit !== null && mfgYear4Digit >= rule.mfg_year_from);
                }
                if (rule.mfg_year_to !== null) {
                  mfgMatch = mfgMatch && (mfgYear4Digit !== null && mfgYear4Digit <= rule.mfg_year_to);
                }

                let instMatch = true;
                if (rule.installation_from !== null) {
                  const ruleFrom = new Date(rule.installation_from);
                  instMatch = instMatch && (effectiveInstDate !== null && effectiveInstDate >= ruleFrom);
                }
                if (rule.installation_to !== null) {
                  const ruleTo = new Date(rule.installation_to);
                  instMatch = instMatch && (effectiveInstDate !== null && effectiveInstDate <= ruleTo);
                }

                if (mfgMatch && instMatch) {
                  duration = rule.warranty_duration;
                  break;
                }
              }
            }

            const startUtc = getUtcDateOnly(effectiveInstDate);
            const callUtc = getUtcDateOnly(callBooked);

            if (duration !== null && startUtc && callUtc) {
              const diffTime = callUtc.getTime() - startUtc.getTime();
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays >= 0 && diffDays <= duration) {
                calculatedStatus = 'IN WARRANTY';
              }
            }

            await trx('crm_data')
              .where({ id: row.id })
              .update({ warranty_status: calculatedStatus });
          }
        });

        offset += limit;
      }

      console.log('Backfill completed successfully.');
    } else {
      console.warn('Skipping backfill: warranty_rules or part_warrenty_details table is missing.');
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('crm_data');
  if (hasTable) {
    const hasWarrantyStatus = await knex.schema.hasColumn('crm_data', 'warranty_status');
    if (hasWarrantyStatus) {
      await knex.schema.alterTable('crm_data', (table) => {
        table.dropColumn('warranty_status');
      });
    }
  }
}
