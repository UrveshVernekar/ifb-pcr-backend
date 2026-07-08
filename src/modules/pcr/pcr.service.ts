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
    const cleanHeader = header.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // Map normalized alphanumeric headers to database columns
    const mapping: { [key: string]: string } = {
      'zone': 'zone',
      'branch': 'branch',
      'machineserial': 'machine_serial',
      'machineserialno': 'machine_serial',
      'machineserialnumber': 'machine_serial',
      'serialno': 'machine_serial',
      'serialnumber': 'machine_serial',
      'partcode': 'part_code',
      'partdescription': 'part_description',
      'tickernumber': 'ticker_number',
      'ticketnumber': 'ticker_number',
      'ticketno': 'ticker_number',
      'ticket': 'ticker_number',
      'ticker': 'ticker_number'
    };

    return mapping[cleanHeader] || null;
  }

  /**
   * Retrieves PCR claims list joined with CRM details and verification status,
   * along with verification summary statistics and branch overview metrics.
   */
  async getPhysicalVerificationList(
    month: number,
    year: number,
    branchId?: number,
    search?: string,
    page: number = 1,
    limit: number = 10,
    ticketNumber?: string,
    partCode?: string,
    regionId?: number,
    franchiseId?: number,
    verificationStatus?: string,
    partCondition?: string
  ): Promise<{ parts: any[]; summary: any; branchOverview: any[]; pagination: any }> {
    try {
      // 1. Build list count query (for pagination)
      const countQuery = db('pcr_data as p')
        .leftJoin('pcr_physical_verifications as pv', function () {
          this.on('p.ticker_number', '=', 'pv.ticket_id')
            .andOn('p.part_code', '=', 'pv.part_code');
        })
        .where('p.selected_month', month)
        .where('p.selected_year', year);

      if (branchId) {
        countQuery.where('p.selected_branch_id', branchId);
      } else if (regionId) {
        countQuery.join('branches as b', 'p.selected_branch_id', 'b.branch_id')
          .where('b.region_id', regionId);
      }

      if (franchiseId) {
        countQuery.join('crm_data as c', function () {
          this.on('p.ticker_number', '=', 'c.ticket')
            .andOn('p.part_code', '=', 'c.item_code')
            .andOn('p.selected_month', '=', 'c.month')
            .andOn('p.selected_year', '=', 'c.year');
        })
        .join('franchises as f', 'c.fr_code', 'f.code')
        .where('f.franchise_id', franchiseId);
      }

      if (search) {
        const term = `%${search.trim()}%`;
        countQuery.where((builder) => {
          builder.where('p.ticker_number', 'like', term)
            .orWhere('p.part_code', 'like', term)
            .orWhere('p.part_description', 'like', term);
        });
      }

      if (ticketNumber) {
        countQuery.where('p.ticker_number', 'like', `%${ticketNumber.trim()}%`);
      }

      if (partCode) {
        countQuery.where('p.part_code', 'like', `%${partCode.trim()}%`);
      }

      if (verificationStatus) {
        if (verificationStatus === 'Pending') {
          countQuery.where((builder) => {
            builder.whereNull('pv.status').orWhere('pv.status', 'Pending');
          });
        } else {
          countQuery.where('pv.status', verificationStatus);
        }
      }

      if (partCondition) {
        if (partCondition === 'Damaged') {
          countQuery.where('pv.condition', 'Damaged').where('pv.status', 'Received');
        } else {
          countQuery.where('pv.condition', partCondition);
        }
      }

      const totalPartsCountRes = await countQuery.count('p.id as total');
      const totalCount = parseInt(String(totalPartsCountRes[0]?.total || '0'), 10);


      // 2. Build list data query with offset limit
      const query = db('pcr_data as p')
        .leftJoin('crm_data as c', function () {
          this.on('p.ticker_number', '=', 'c.ticket')
            .andOn('p.part_code', '=', 'c.item_code')
            .andOn('p.selected_month', '=', 'c.month')
            .andOn('p.selected_year', '=', 'c.year');
        })
        .leftJoin('branches as b', 'p.selected_branch_id', 'b.branch_id')
        .leftJoin('pcr_physical_verifications as pv', function () {
          this.on('p.ticker_number', '=', 'pv.ticket_id')
            .andOn('p.part_code', '=', 'pv.part_code');
        })
        .leftJoin('users as u', 'pv.verified_by', 'u.user_id')
        .select(
          'p.id as pcr_data_id',
          'p.ticker_number as ticket_id',
          'p.part_code',
          'p.part_description',
          'p.selected_month',
          'p.selected_year',
          'p.selected_branch_id',
          'b.name as branch_name',
          'c.customer_name',
          'c.warranty_status',
          db.raw('COALESCE(c.approved_qty, 1) as expected_qty'),
          db.raw('COALESCE(pv.status, \'Pending\') as verification_status'),
          'pv.remarks',
          db.raw('COALESCE(pv.condition, \'-\') as part_condition'),
          'pv.verified_at',
          'u.full_name as verified_by_name'
        );

      // Filters
      query.where('p.selected_month', month);
      query.where('p.selected_year', year);

      if (branchId) {
        query.where('p.selected_branch_id', branchId);
      } else if (regionId) {
        query.where('b.region_id', regionId);
      }

      if (franchiseId) {
        query.leftJoin('franchises as f', 'c.fr_code', 'f.code')
          .where('f.franchise_id', franchiseId);
      }

      if (search) {
        const term = `%${search.trim()}%`;
        query.where((builder) => {
          builder.where('p.ticker_number', 'like', term)
            .orWhere('p.part_code', 'like', term)
            .orWhere('p.part_description', 'like', term);
        });
      }

      if (ticketNumber) {
        query.where('p.ticker_number', 'like', `%${ticketNumber.trim()}%`);
      }

      if (partCode) {
        query.where('p.part_code', 'like', `%${partCode.trim()}%`);
      }

      if (verificationStatus) {
        if (verificationStatus === 'Pending') {
          query.where((builder) => {
            builder.whereNull('pv.status').orWhere('pv.status', 'Pending');
          });
        } else {
          query.where('pv.status', verificationStatus);
        }
      }

      if (partCondition) {
        if (partCondition === 'Damaged') {
          query.where('pv.condition', 'Damaged').where('pv.status', 'Received');
        } else {
          query.where('pv.condition', partCondition);
        }
      }

      query.orderBy('p.ticker_number', 'asc');
      
      const offset = (page - 1) * limit;
      query.limit(limit).offset(offset);

      const parts = await query;

      // 3. Fetch summary counts matching current filters (unpaginated total counts)
      const statsQuery = db('pcr_data as p')
        .leftJoin('pcr_physical_verifications as pv', function () {
          this.on('p.ticker_number', '=', 'pv.ticket_id')
            .andOn('p.part_code', '=', 'pv.part_code');
        })
        .where('p.selected_month', month)
        .where('p.selected_year', year);

      if (branchId) {
        statsQuery.where('p.selected_branch_id', branchId);
      } else if (regionId) {
        statsQuery.join('branches as b', 'p.selected_branch_id', 'b.branch_id')
          .where('b.region_id', regionId);
      }

      if (franchiseId) {
        statsQuery.join('crm_data as c', function () {
          this.on('p.ticker_number', '=', 'c.ticket')
            .andOn('p.part_code', '=', 'c.item_code')
            .andOn('p.selected_month', '=', 'c.month')
            .andOn('p.selected_year', '=', 'c.year');
        })
        .join('franchises as f', 'c.fr_code', 'f.code')
        .where('f.franchise_id', franchiseId);
      }

      if (search) {
        const term = `%${search.trim()}%`;
        statsQuery.where((builder) => {
          builder.where('p.ticker_number', 'like', term)
            .orWhere('p.part_code', 'like', term)
            .orWhere('p.part_description', 'like', term);
        });
      }

      if (ticketNumber) {
        statsQuery.where('p.ticker_number', 'like', `%${ticketNumber.trim()}%`);
      }

      if (partCode) {
        statsQuery.where('p.part_code', 'like', `%${partCode.trim()}%`);
      }

      const stats = await statsQuery
        .select(
          db.raw('count(p.id) as total_pcr'),
          db.raw('sum(case when pv.status = \'Received\' then 1 else 0 end) as received_count'),
          db.raw('sum(case when pv.status = \'Not Received\' then 1 else 0 end) as not_received_count'),
          db.raw('sum(case when pv.status is null or pv.status = \'Pending\' then 1 else 0 end) as pending_count'),
          db.raw('sum(case when pv.condition = \'Damaged\' and pv.status = \'Received\' then 1 else 0 end) as damaged_count')
        )
        .first();

      const summary = {
        total: parseInt(stats?.total_pcr || '0', 10),
        received: parseInt(stats?.received_count || '0', 10),
        notReceived: parseInt(stats?.not_received_count || '0', 10),
        pending: parseInt(stats?.pending_count || '0', 10),
        damaged: parseInt(stats?.damaged_count || '0', 10),
      };

      // 4. Fetch branch damage overview list for selected month/year
      const branchOverviewQuery = db('pcr_data as p')
        .join('branches as b', 'p.selected_branch_id', 'b.branch_id')
        .leftJoin('pcr_physical_verifications as pv', function () {
          this.on('p.ticker_number', '=', 'pv.ticket_id')
            .andOn('p.part_code', '=', 'pv.part_code');
        })
        .where('p.selected_month', month)
        .where('p.selected_year', year);

      if (branchId) {
        branchOverviewQuery.where('p.selected_branch_id', branchId);
      } else if (regionId) {
        branchOverviewQuery.where('b.region_id', regionId);
      }

      if (franchiseId) {
        branchOverviewQuery.join('crm_data as c', function () {
          this.on('p.ticker_number', '=', 'c.ticket')
            .andOn('p.part_code', '=', 'c.item_code')
            .andOn('p.selected_month', '=', 'c.month')
            .andOn('p.selected_year', '=', 'c.year');
        })
        .join('franchises as f', 'c.fr_code', 'f.code')
        .where('f.franchise_id', franchiseId);
      }

      branchOverviewQuery.groupBy('p.selected_branch_id', 'b.name')
        .select(
          'p.selected_branch_id as branch_id',
          'b.name as branch_name',
          db.raw('count(p.id) as total_count'),
          db.raw('sum(case when pv.condition = \'Damaged\' and pv.status = \'Received\' then 1 else 0 end) as damaged_count')
        );

      const rawOverview = await branchOverviewQuery;
      const branchOverview = rawOverview.map((item: any) => {
        const total = parseInt(item.total_count || '0', 10);
        const damaged = parseInt(item.damaged_count || '0', 10);
        const damagePercentage = total > 0 ? parseFloat(((damaged / total) * 100).toFixed(2)) : 0;
        return {
          branchId: item.branch_id,
          branchName: item.branch_name,
          totalCount: total,
          damagedCount: damaged,
          damagePercentage
        };
      });

      const totalPages = Math.ceil(totalCount / limit);
      const pagination = {
        page,
        limit,
        totalCount,
        totalPages
      };

      return { parts, summary, branchOverview, pagination };
    } catch (error: any) {
      logger.error(`Error in getPhysicalVerificationList: ${error.message}`);
      throw new ApiError(500, `Failed to retrieve physical verification details: ${error.message}`);
    }
  }

  /**
   * Idempotent status update / insert operation (upsert) for physical verification.
   */
  async savePhysicalVerification(
    ticketId: string,
    partCode: string,
    status: string,
    condition: string = 'OK',
    remarks: string | null = null,
    userId?: number
  ): Promise<any> {
    if (!ticketId || !partCode) {
      throw new ApiError(400, 'Ticket ID and Part Code are required');
    }

    if (!['Pending', 'Received', 'Not Received'].includes(status)) {
      throw new ApiError(400, 'Invalid status value. Must be Pending, Received, or Not Received');
    }

    if (!['OK', 'Damaged', '-'].includes(condition)) {
      throw new ApiError(400, 'Invalid condition value. Must be OK, Damaged, or -');
    }

    try {
      const existing = await db('pcr_physical_verifications')
        .where({ ticket_id: ticketId, part_code: partCode })
        .first();

      if (existing) {
        await db('pcr_physical_verifications')
          .where({ ticket_id: ticketId, part_code: partCode })
          .update({
            status,
            condition,
            remarks: remarks || null,
            verified_by: userId || null,
            verified_at: db.fn.now(),
            updated_at: db.fn.now()
          });
      } else {
        await db('pcr_physical_verifications')
          .insert({
            ticket_id: ticketId,
            part_code: partCode,
            status,
            condition,
            remarks: remarks || null,
            verified_by: userId || null,
            verified_at: db.fn.now(),
            created_at: db.fn.now(),
            updated_at: db.fn.now()
          });
      }

      return { ticketId, partCode, status, condition, remarks };
    } catch (error: any) {
      logger.error(`Error in savePhysicalVerification: ${error.message}`);
      throw new ApiError(500, `Failed to save physical verification: ${error.message}`);
    }
  }

  /**
   * Retrieves aggregated monthly upload status details for both CRM and PCR claims.
   */
  async getUploadStatus(): Promise<any[]> {
    try {
      // 1. Fetch active branches
      const branches = await db('branches')
        .whereNull('deleted_at')
        .where('is_active', true)
        .select('branch_id', 'name', 'region_id')
        .orderBy('name', 'asc');

      // 2. Fetch CRM uploads summary
      const crmUploads = await db('crm_data')
        .select('month', 'year')
        .count('* as count')
        .max('created_at as last_uploaded')
        .groupBy('month', 'year');

      // 3. Fetch PCR uploads summary
      const pcrUploads = await db('pcr_data')
        .select('selected_month as month', 'selected_year as year', 'selected_branch_id as branch_id')
        .count('* as count')
        .max('created_at as last_uploaded')
        .groupBy('selected_month', 'selected_year', 'selected_branch_id');

      // 4. Extract all unique year-month combinations
      const monthYearSet = new Set<string>();
      
      crmUploads.forEach((c: any) => {
        monthYearSet.add(`${c.year}-${c.month}`);
      });
      pcrUploads.forEach((p: any) => {
        monthYearSet.add(`${p.year}-${p.month}`);
      });

      const uniquePeriods = Array.from(monthYearSet).map(s => {
        const [year, month] = s.split('-').map(Number);
        return { year, month };
      });

      // Sort chronological ascending (oldest to newest)
      uniquePeriods.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });

      // 5. Construct monthly structure
      const slides = uniquePeriods.map((period) => {
        const { year, month } = period;

        // CRM data for this month
        const crmMatch = crmUploads.find((c: any) => c.month === month && c.year === year);
        const crmStatus = {
          uploaded: !!crmMatch,
          recordCount: crmMatch ? parseInt(crmMatch.count || '0', 10) : 0,
          uploadedAt: crmMatch ? crmMatch.last_uploaded : null
        };

        // PCR details per branch
        const branchesDetail = branches.map((b: any) => {
          const pcrMatch = pcrUploads.find((p: any) => p.month === month && p.year === year && p.branch_id === b.branch_id);
          return {
            branchId: b.branch_id,
            branchName: b.name,
            regionId: b.region_id,
            uploaded: !!pcrMatch,
            recordCount: pcrMatch ? parseInt(pcrMatch.count || '0', 10) : 0,
            uploadedAt: pcrMatch ? pcrMatch.last_uploaded : null
          };
        });

        const uploadedBranchesCount = branchesDetail.filter(b => b.uploaded).length;
        const pcrRecordCount = branchesDetail.reduce((acc, curr) => acc + curr.recordCount, 0);
        const pcrLastUploaded = branchesDetail.reduce((latest: any, curr) => {
          if (!curr.uploadedAt) return latest;
          if (!latest) return curr.uploadedAt;
          return new Date(curr.uploadedAt) > new Date(latest) ? curr.uploadedAt : latest;
        }, null);

        const pcrStatus = {
          uploaded: uploadedBranchesCount > 0,
          uploadedBranchesCount,
          totalBranches: branches.length,
          recordCount: pcrRecordCount,
          uploadedAt: pcrLastUploaded,
          branchesDetail
        };

        return {
          month,
          year,
          crm: crmStatus,
          pcr: pcrStatus
        };
      });

      return slides;
    } catch (error: any) {
      logger.error(`Error in getUploadStatus: ${error.message}`);
      throw new ApiError(500, `Failed to retrieve upload status: ${error.message}`);
    }
  }

  /**
   * Queries and generates an Excel spreadsheet buffer of claims matching export filters.
   */
  async exportPhysicalVerification(options: {
    type: string;
    month?: number;
    year?: number;
    date?: string;
    startDate?: string;
    endDate?: string;
    branchId?: number;
    regionId?: number;
  }): Promise<Buffer> {
    try {
      const { type, month, year, date, startDate, endDate, branchId, regionId } = options;

      const query = db('pcr_data as p')
        .leftJoin('crm_data as c', function () {
          this.on('p.ticker_number', '=', 'c.ticket')
            .andOn('p.part_code', '=', 'c.item_code')
            .andOn('p.selected_month', '=', 'c.month')
            .andOn('p.selected_year', '=', 'c.year');
        })
        .leftJoin('branches as b', 'p.selected_branch_id', 'b.branch_id')
        .leftJoin('pcr_physical_verifications as pv', function () {
          this.on('p.ticker_number', '=', 'pv.ticket_id')
            .andOn('p.part_code', '=', 'pv.part_code');
        })
        .leftJoin('users as u', 'pv.verified_by', 'u.user_id')
        .select(
          'p.ticker_number as ticket_id',
          'p.part_code',
          'p.part_description',
          'b.name as branch_name',
          db.raw('COALESCE(c.approved_qty, 1) as expected_qty'),
          db.raw('COALESCE(pv.status, \'Pending\') as verification_status'),
          db.raw('COALESCE(pv.condition, \'-\') as part_condition'),
          'pv.remarks',
          'u.full_name as verified_by_name',
          'pv.verified_at'
        );

      // Branch/Region Filters
      if (branchId) {
        query.where('p.selected_branch_id', branchId);
      } else if (regionId) {
        query.where('b.region_id', regionId);
      }

      // Temporal filters
      if (type === 'month' && month && year) {
        query.where('p.selected_month', month).where('p.selected_year', year);
      } else if (type === 'year' && year) {
        query.where('p.selected_year', year);
      } else if (type === 'day' && date) {
        query.whereBetween('pv.verified_at', [`${date} 00:00:00`, `${date} 23:59:59`]);
      } else if (type === 'range' && startDate && endDate) {
        query.whereBetween('pv.verified_at', [`${startDate} 00:00:00`, `${endDate} 23:59:59`]);
      } else {
        if (month && year) {
          query.where('p.selected_month', month).where('p.selected_year', year);
        }
      }

      query.orderBy('p.ticker_number', 'asc');

      const records = await query;

      // Format records for Excel rows
      const formatted = records.map((r: any, idx: number) => ({
        'S.No.': idx + 1,
        'Ticket ID': r.ticket_id,
        'Part Code': r.part_code,
        'Part Description': r.part_description,
        'Branch': r.branch_name || '-',
        'Expected Qty': r.expected_qty,
        'Verification Status': r.verification_status,
        'Part Condition': r.part_condition,
        'Remarks': r.remarks || '-',
        'Verified By': r.verified_by_name || '-',
        'Verified At': r.verified_at ? new Date(r.verified_at).toLocaleString('en-IN') : '-'
      }));

      // Generate workbook
      const worksheet = XLSX.utils.json_to_sheet(formatted);
      const workbook = XLSX.utils.book_new();

      // Auto-fit column widths
      const maxLens = Object.keys(formatted[0] || {}).reduce((acc: any, key) => {
        acc[key] = key.length;
        return acc;
      }, {});

      formatted.forEach((row: any) => {
        Object.keys(row).forEach((key) => {
          const valStr = String(row[key] || '');
          if (valStr.length > maxLens[key]) {
            maxLens[key] = valStr.length;
          }
        });
      });

      worksheet['!cols'] = Object.keys(maxLens).map((key) => ({
        wch: Math.min(Math.max(maxLens[key] + 3, 10), 40)
      }));

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Claims Verification');
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      return buffer;
    } catch (error: any) {
      logger.error(`Error in exportPhysicalVerification: ${error.message}`);
      throw new ApiError(500, `Failed to export claims data: ${error.message}`);
    }
  }
}

