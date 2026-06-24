import { Request, Response, NextFunction } from 'express';
import { CrmService } from './crm.service';
import { successResponse } from '../../common/utils/response.util';
import { ApiError } from '../../common/errors/ApiError';

export class CrmController {
  private crmService: CrmService;

  constructor() {
    this.crmService = new CrmService();
  }

  uploadCRMData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        throw new ApiError(400, 'Excel file is required');
      }

      const monthVal = req.body.month;
      const yearVal = req.body.year;

      if (!monthVal || !yearVal) {
        throw new ApiError(400, 'Month and Year parameters are required');
      }

      const month = parseInt(monthVal as string, 10);
      const year = parseInt(yearVal as string, 10);

      if (isNaN(month) || month < 1 || month > 12) {
        throw new ApiError(400, 'Month must be a valid number between 1 and 12');
      }

      if (isNaN(year) || year < 2000 || year > 2100) {
        throw new ApiError(400, 'Year must be a valid 4-digit number');
      }

      const insertedCount = await this.crmService.uploadCRMData(file.buffer, month, year);

      return successResponse(res, 'CRM data uploaded and parsed successfully', {
        count: insertedCount,
        month,
        year
      });
    } catch (error) {
      return next(error);
    }
  };
}

export default CrmController;
