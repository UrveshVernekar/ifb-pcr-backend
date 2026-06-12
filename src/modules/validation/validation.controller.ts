import { Request, Response, NextFunction } from 'express';
import { ValidationService } from './validation.service';
import { successResponse } from '../../common/utils/response.util';

export class ValidationController {
  private service: ValidationService;

  constructor() {
    this.service = new ValidationService();
  }

  getHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const barcode = req.query.barcode as string;
      const result = await this.service.getMachineHistory(barcode);
      return successResponse(res, 'Machine history fetched successfully', result);
    } catch (error) {
      return next(error);
    }
  };
}

export default ValidationController;
