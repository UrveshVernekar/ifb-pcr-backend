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

  getPhysicalVerificationList = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const monthVal = req.query.month;
      const yearVal = req.query.year;
      const branchIdVal = req.query.branchId;
      const search = req.query.search ? String(req.query.search) : undefined;
      const pageVal = req.query.page;
      const limitVal = req.query.limit;

      // Default to current month and year if not provided
      const currentDate = new Date();
      const month = monthVal ? parseInt(monthVal as string, 10) : currentDate.getMonth() + 1;
      const year = yearVal ? parseInt(yearVal as string, 10) : currentDate.getFullYear();
      const branchId = (branchIdVal && branchIdVal !== 'all' && branchIdVal !== '') 
        ? parseInt(branchIdVal as string, 10) 
        : undefined;

      const page = pageVal ? parseInt(pageVal as string, 10) : 1;
      const limit = limitVal ? parseInt(limitVal as string, 10) : 10;

      if (isNaN(month) || month < 1 || month > 12) {
        throw new ApiError(400, 'Month must be a valid number between 1 and 12');
      }

      if (isNaN(year) || year < 2000 || year > 2100) {
        throw new ApiError(400, 'Year must be a valid 4-digit number');
      }

      if (branchId !== undefined && isNaN(branchId)) {
        throw new ApiError(400, 'Branch ID must be a valid number');
      }

      if (isNaN(page) || page < 1) {
        throw new ApiError(400, 'Page must be a positive integer');
      }

      if (isNaN(limit) || limit < 1) {
        throw new ApiError(400, 'Limit must be a positive integer');
      }

      const result = await this.pcrService.getPhysicalVerificationList(month, year, branchId, search, page, limit);

      return successResponse(res, 'Physical verification list retrieved successfully', result);
    } catch (error) {
      return next(error);
    }
  };


  savePhysicalVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ticketId, partCode, status, condition, remarks } = req.body;
      const userId = req.user?.userId;

      if (!ticketId || !partCode || !status) {
        throw new ApiError(400, 'Ticket ID, Part Code, and Status are required');
      }

      const result = await this.pcrService.savePhysicalVerification(
        ticketId,
        partCode,
        status,
        condition || 'OK',
        remarks || null,
        userId
      );

      return successResponse(res, 'Physical verification saved successfully', result);
    } catch (error) {
      return next(error);
    }
  };
}

export default PcrController;

