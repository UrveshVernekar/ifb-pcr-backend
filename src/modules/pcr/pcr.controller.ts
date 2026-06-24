import { Request, Response, NextFunction } from 'express';
import { PcrService } from './pcr.service';
import { successResponse } from '../../common/utils/response.util';
import { ApiError } from '../../common/errors/ApiError';

export class PcrController {
  private pcrService: PcrService;

  constructor() {
    this.pcrService = new PcrService();
  }

  uploadPCRData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        throw new ApiError(400, 'Excel file is required');
      }

      const branchIdVal = req.body.branchId;
      const monthVal = req.body.month;
      const yearVal = req.body.year;

      if (!branchIdVal || !monthVal || !yearVal) {
        throw new ApiError(400, 'Branch, Month, and Year parameters are required');
      }

      const branchId = parseInt(branchIdVal as string, 10);
      const month = parseInt(monthVal as string, 10);
      const year = parseInt(yearVal as string, 10);

      if (isNaN(branchId)) {
        throw new ApiError(400, 'Branch ID must be a valid number');
      }

      if (isNaN(month) || month < 1 || month > 12) {
        throw new ApiError(400, 'Month must be a valid number between 1 and 12');
      }

      if (isNaN(year) || year < 2000 || year > 2100) {
        throw new ApiError(400, 'Year must be a valid 4-digit number');
      }

      const insertedCount = await this.pcrService.uploadPCRData(file.buffer, branchId, month, year);

      return successResponse(res, 'PCR data uploaded and parsed successfully', {
        count: insertedCount,
        branchId,
        month,
        year
      });
    } catch (error) {
      return next(error);
    }
  };
}

export default PcrController;
