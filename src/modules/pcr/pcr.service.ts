import * as XLSX from 'xlsx';
import db from '../../config/database';
import { logger } from '../../config/logger';
import { ApiError } from '../../common/errors/ApiError';

export class PcrService {
  /**
   * Uploads PCR Excel file data to database for the given branch, month, and year.
   * Maps Excel layout columns (Zone, Branch, Machine Serial, Part Code, Part Description, Ticker Number).
   */
  async uploadPCRData(fileBuffer: Buffer, branchId: number, month: number, year: number): Promise<number> {
    try {
      // 1. Read the workbook using xlsx
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new ApiError(400, 'Excel file has no worksheets');
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: null });
      if (rows.length === 0) {
        throw new ApiError(400, 'Excel file is empty');
      }

      logger.info(`Parsed ${rows.length} rows from PCR upload for branchId=${branchId}, month=${month}, year=${year}`);

      // 2. Process rows and map to database schema
      const mappedRows: any[] = [];
      for (const row of rows) {
        if (this.isRowEmpty(row)) continue;

        const dbRow: any = {
          selected_branch_id: branchId,
          selected_month: month,
          selected_year: year,
          created_at: db.fn.now(),
          updated_at: db.fn.now()
        };

        for (const [key, val] of Object.entries(row)) {
          const dbCol = this.getDbColumnName(key);
          if (!dbCol) continue;

          // Trim strings
          dbRow[dbCol] = val !== null && val !== undefined ? String(val).trim() : null;
        }

        mappedRows.push(dbRow);
      }

      logger.info(`Mapped ${mappedRows.length} valid PCR rows for database insertion`);

      if (mappedRows.length === 0) {
        throw new ApiError(400, 'No valid records found in the uploaded file');
      }

      // 3. Database Transaction: delete existing records and insert new batch
      await db.transaction(async (trx) => {
        logger.info(`Deleting existing PCR data for branchId=${branchId}, month=${month}, year=${year}...`);
        await trx('pcr_data').where({
          selected_branch_id: branchId,
          selected_month: month,
          selected_year: year
        }).del();

        const batchSize = 250;
        logger.info(`Inserting ${mappedRows.length} PCR records in batches of ${batchSize}...`);
        for (let i = 0; i < mappedRows.length; i += batchSize) {
          const batch = mappedRows.slice(i, i + batchSize);
          await trx('pcr_data').insert(batch);
        }
      });

      logger.info(`Successfully stored PCR data: ${mappedRows.length} records.`);
      return mappedRows.length;
    } catch (error: any) {
      logger.error(`Error in uploadPCRData: ${error.message}`);
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, `Failed to process PCR file: ${error.message}`);
    }
  }

  /**
   * Helper to check if a row is completely empty
   */
  private isRowEmpty(row: any): boolean {
    return Object.values(row).every(val => val === null || val === undefined || val === '');
  }

  /**
   * Maps Excel column headers to database snake_case fields
   */
  private getDbColumnName(header: string): string | null {
    const mapping: { [key: string]: string } = {
      'Zone': 'zone',
      'Branch': 'branch',
      'Machine Serial': 'machine_serial',
      'Machine Serial No.': 'machine_serial',
      'Part Code': 'part_code',
      'Part Description': 'part_description',
      'Ticker Number': 'ticker_number',
      'Ticket Number': 'ticker_number'
    };

    if (mapping[header]) return mapping[header];
    
    const trimmed = header.trim();
    if (mapping[trimmed]) return mapping[trimmed];
    
    const lower = trimmed.toLowerCase();
    for (const key of Object.keys(mapping)) {
      if (key.trim().toLowerCase() === lower) {
        return mapping[key];
      }
    }
    return null;
  }
}
