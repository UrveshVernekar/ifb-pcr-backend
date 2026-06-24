import * as XLSX from 'xlsx';
import db from '../../config/database';
import { logger } from '../../config/logger';
import { ApiError } from '../../common/errors/ApiError';

export class CrmService {
  /**
   * Uploads CRM Excel file data to database for the given month and year.
   * Smartly detects date formats (DD-MM-YYYY vs MM-DD-YYYY) for date fields.
   */
  async uploadCRMData(fileBuffer: Buffer, month: number, year: number): Promise<number> {
    try {
      // 1. Read the workbook using xlsx
      // cellDates: true enables XLSX to automatically parse Excel serial dates into JS Date objects
      const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new ApiError(400, 'Excel file has no worksheets');
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: null });
      if (rows.length === 0) {
        throw new ApiError(400, 'Excel file is empty');
      }

      logger.info(`Parsed ${rows.length} rows from CRM upload for month=${month}, year=${year}`);

      // 2. Identify the date columns and perform smart detection
      const dateColumns = [
        'CallBooked Date',
        'Soft Closure Date',
        'Call Closed Date',
        'SPU Created Date',
        'seapproveddate',
        'storesapproveddate',
        'DOP',
        'DOI',
        'DOE'
      ];

      const detectedFormats = this.detectSmartDateFormats(rows, dateColumns);
      logger.info('Smart date format detection results:', detectedFormats);

      // 3. Fetch all warranty rules and part details map for status calculation
      const rules = await db('warranty_rules').select('*');
      const partDetails = await db('part_warrenty_details').select('part_code', 'part_type');
      const partDetailsMap: { [key: string]: string } = {};
      for (const p of partDetails) {
        if (p.part_code) {
          partDetailsMap[p.part_code] = p.part_type;
        }
      }

      // 4. Process rows and map to database schema
      const mappedRows: any[] = [];
      for (const row of rows) {
        // Skip totally empty rows (if any)
        if (this.isRowEmpty(row)) continue;

        const dbRow: any = {
          month,
          year,
          created_at: db.fn.now(),
          updated_at: db.fn.now()
        };

        for (const [key, val] of Object.entries(row)) {
          const dbCol = this.getDbColumnName(key);
          if (!dbCol) continue;

          // If this is a date column, parse it smartly
          if (dateColumns.includes(key)) {
            const format = detectedFormats[key] || 'MM-DD-YYYY';
            dbRow[dbCol] = this.parseSmartDate(val, format);
          } else {
            // Normal field, cast types if needed
            dbRow[dbCol] = this.formatFieldValue(dbCol, val);
          }
        }

        // Calculate manufacturing year and month from serial number
        const serial = dbRow.serial_number;
        let mfgYear: number | null = null;
        let mfgMonth: number | null = null;

        if (serial && typeof serial === 'string' && serial.length >= 10) {
          const yearStr = serial.substring(6, 8);
          const monthStr = serial.substring(8, 10);
          
          const parsedYear = parseInt(yearStr, 10);
          const parsedMonth = parseInt(monthStr, 10);

          if (!isNaN(parsedYear)) {
            mfgYear = parsedYear;
          }
          if (!isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
            mfgMonth = parsedMonth;
          }
        }

        dbRow.mfg_year = mfgYear;
        dbRow.mfg_month = mfgMonth;

        // Calculate and add warranty status
        dbRow.warranty_status = this.calculateWarrantyStatus(dbRow, rules, partDetailsMap);

        mappedRows.push(dbRow);
      }

      logger.info(`Mapped ${mappedRows.length} valid rows for database insertion`);

      if (mappedRows.length === 0) {
        throw new ApiError(400, 'No valid records found in the uploaded file');
      }

      // 4. Database Transaction: delete existing month/year and insert new
      await db.transaction(async (trx) => {
        logger.info(`Deleting existing CRM data for month=${month}, year=${year}...`);
        await trx('crm_data').where({ month, year }).del();

        // Batch inserts to prevent exceeding query size limits
        const batchSize = 250;
        logger.info(`Inserting ${mappedRows.length} CRM records in batches of ${batchSize}...`);
        for (let i = 0; i < mappedRows.length; i += batchSize) {
          const batch = mappedRows.slice(i, i + batchSize);
          await trx('crm_data').insert(batch);
        }
      });

      logger.info(`Successfully stored CRM data: ${mappedRows.length} records.`);
      return mappedRows.length;
    } catch (error: any) {
      logger.error(`Error in uploadCRMData: ${error.message}`);
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, `Failed to process CRM file: ${error.message}`);
    }
  }

  /**
   * Helper to check if a row is completely empty
   */
  private isRowEmpty(row: any): boolean {
    return Object.values(row).every(val => val === null || val === undefined || val === '');
  }

  /**
   * Smart column-wide date format detection.
   */
  private detectSmartDateFormats(rows: any[], columns: string[]): { [col: string]: 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD' } {
    const formats: { [col: string]: 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD' } = {};

    for (const col of columns) {
      let ddMmCount = 0;
      let mmDdCount = 0;
      let yyyyMmDdCount = 0;

      for (const row of rows) {
        const val = row[col];
        if (!val || typeof val !== 'string') continue;

        const trimmed = val.trim();
        if (!trimmed) continue;

        // Check for YYYY-MM-DD / YYYY/MM/DD (starts with 4 digits)
        if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(trimmed)) {
          yyyyMmDdCount++;
          continue;
        }

        // Check for year at the end: XX-XX-YYYY or XX/XX/YYYY
        const match = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (match) {
          const part1 = parseInt(match[1], 10);
          const part2 = parseInt(match[2], 10);

          if (part1 > 12 && part2 <= 12) {
            ddMmCount++; // First part must be day (e.g. 15-12-2025)
          } else if (part2 > 12 && part1 <= 12) {
            mmDdCount++; // Second part must be day (e.g. 12-15-2025)
          }
        }
      }

      if (yyyyMmDdCount > ddMmCount && yyyyMmDdCount > mmDdCount) {
        formats[col] = 'YYYY-MM-DD';
      } else if (ddMmCount > mmDdCount) {
        formats[col] = 'DD-MM-YYYY';
      } else {
        // Default to MM-DD-YYYY as observed in example reference sheet (e.g., 03-24-2026)
        formats[col] = 'MM-DD-YYYY';
      }
    }

    return formats;
  }

  /**
   * Parses a single date cell smartly based on detected column format
   */
  private parseSmartDate(val: any, format: 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD'): Date | null {
    if (val === null || val === undefined) return null;

    if (val instanceof Date) {
      return isNaN(val.getTime()) ? null : val;
    }

    // If it's an Excel serial date number
    if (typeof val === 'number') {
      const d = new Date((val - 25569) * 86400 * 1000);
      return isNaN(d.getTime()) ? null : d;
    }

    if (typeof val !== 'string') return null;

    const trimmed = val.trim();
    if (!trimmed) return null;

    // Check for YYYY-MM-DD first
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(trimmed)) {
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? null : d;
    }

    // Match XX-XX-YYYY or XX/XX/YYYY
    const match = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (!match) {
      // Fallback
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? null : d;
    }

    const part1 = parseInt(match[1], 10);
    const part2 = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    let date: Date;
    if (format === 'DD-MM-YYYY') {
      // part1 is Day, part2 is Month
      date = new Date(year, part2 - 1, part1);
    } else {
      // part1 is Month, part2 is Day
      date = new Date(year, part1 - 1, part2);
    }

    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Formats other non-date fields, handles casting (e.g. integer fields)
   */
  private formatFieldValue(dbCol: string, val: any): any {
    if (val === null || val === undefined) return null;

    const integerCols = [
      'ageing',
      'ageing_from_soft_closure',
      'ageing_from_hard_closure',
      'ageing_from_se_apr_date',
      'spu_qty',
      'approved_qty',
      'pending_qty',
      'dc_qty',
      'approved_qty_dc',
      'dc_qty_dc',
      'received_qty',
      'rej_qty'
    ];

    if (integerCols.includes(dbCol)) {
      if (typeof val === 'number') return Math.round(val);
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? null : parsed;
    }

    // String columns: trim whitespace, handle string representations of numbers
    if (typeof val === 'string') {
      return val.trim();
    }
    return String(val);
  }

  /**
   * Maps Excel column headers to database snake_case fields
   */
  private getDbColumnName(header: string): string | null {
    const mapping: { [key: string]: string } = {
      'Branch': 'branch',
      'Franchise': 'franchise',
      'FrType': 'fr_type',
      'FrCode': 'fr_code',
      'SPU NO': 'spu_no',
      'SPU Status': 'spu_status',
      'Ageing': 'ageing',
      'CallBooked Date': 'call_booked_date',
      'Soft Closure Date': 'soft_closure_date',
      'Ageing from Soft Closure': 'ageing_from_soft_closure',
      'Call Closed Date': 'call_closed_date',
      'Ageing from Hard Closure': 'ageing_from_hard_closure',
      'SPU Created Date': 'spu_created_date',
      'seapproveddate': 'se_approved_date',
      'Ageing from SE apr date': 'ageing_from_se_apr_date',
      'storesapproveddate': 'stores_approved_date',
      'Customer Code': 'customer_code',
      'cust id hdr': 'cust_id_hdr',
      'Customer Name': 'customer_name',
      'Pincode': 'pincode',
      'Ticket': 'ticket',
      'Call Type': 'call_type',
      'Service Type': 'service_type',
      'Machine Status': 'machine_status',
      'Product': 'product',
      'Product Category': 'product_category',
      'Sub Category': 'sub_category',
      'Model Name': 'model_name',
      'Serial Number': 'serial_number',
      'odu ser no': 'odu_ser_no',
      'DOP': 'dop',
      'DOI': 'doi',
      'DOE': 'doe',
      'Technician': 'technician',
      'Item Code': 'item_code',
      'Description': 'description',
      'ZDP': 'zdp',
      'SPU Qty': 'spu_qty',
      'Approved Qty': 'approved_qty',
      'Pending Qty': 'pending_qty',
      'SE REJ REASON': 'se_rej_reason',
      'SO REJ REASON': 'so_rej_reason',
      'Loss making': 'loss_making',
      'Days 45': 'days_45',
      'Repeat call': 'repeat_call',
      'HV': 'hv',
      'RPF': 'rpf',
      'Problem Description': 'problem_description',
      'Serial Item': 'serial_item',
      'SA Analysis Remark': 'sa_analysis_remark',
      'Dc qty': 'dc_qty',
      'PEND DLV STAT': 'pend_dlv_stat',
      'Grn no': 'grn_no',
      'Dc no': 'dc_no',
      'Approved qty': 'approved_qty_dc',
      'Dc qty ': 'dc_qty_dc',
      'Received qty': 'received_qty',
      'Rej qty': 'rej_qty',
      'z tkt doc': 'z_tkt_doc',
      'tkt call typ': 'tkt_call_typ',
      'serial hdr': 'serial_hdr',
      'po ref no': 'po_ref_no',
      'follow up doc': 'follow_up_doc'
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

  /**
   * Helper to compute the warranty status (IN WARRANTY / OG) for a single CRM record
   */
  private calculateWarrantyStatus(
    dbRow: any,
    rules: any[],
    partDetailsMap: { [key: string]: string }
  ): string {
    const partType = partDetailsMap[dbRow.item_code];
    if (!partType) return 'OG';

    // 1. Determine manufacturing year (4-digit)
    let mfgYearVal = dbRow.mfg_year;
    if (mfgYearVal === null && dbRow.serial_number && dbRow.serial_number.length >= 10) {
      const yearStr = dbRow.serial_number.substring(6, 8);
      const parsed = parseInt(yearStr, 10);
      if (!isNaN(parsed)) {
        mfgYearVal = parsed;
      }
    }

    let mfgYear4Digit = mfgYearVal !== null ? (2000 + mfgYearVal) : null;
    if (mfgYear4Digit === null) {
      const refDate = dbRow.dop || dbRow.doi;
      if (refDate) {
        mfgYear4Digit = new Date(refDate).getFullYear();
      }
    }

    // 2. Determine effective installation date and call date
    const effectiveInstDate = dbRow.doi ? new Date(dbRow.doi) : (dbRow.dop ? new Date(dbRow.dop) : null);
    const callBooked = dbRow.call_booked_date ? new Date(dbRow.call_booked_date) : null;

    // 3. Find matching warranty rule
    let duration: number | null = null;
    const partRules = rules.filter(r => r.part_type === partType);

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

    // 4. Calculate day difference
    const startUtc = this.getUtcDateOnly(effectiveInstDate);
    const callUtc = this.getUtcDateOnly(callBooked);

    if (duration !== null && startUtc && callUtc) {
      const diffTime = callUtc.getTime() - startUtc.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= duration) {
        return 'IN WARRANTY';
      }
    }

    return 'OG';
  }

  /**
   * Helper to strip time from Date for comparison in UTC
   */
  private getUtcDateOnly(dateInput: any): Date | null {
    if (!dateInput) return null;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
}
