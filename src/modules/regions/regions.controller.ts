import { Request, Response, NextFunction } from 'express';
import { RegionsService } from './regions.service';
import { successResponse } from '../../common/utils/response.util';

export class RegionsController {
  private regionsService: RegionsService;

  constructor() {
    this.regionsService = new RegionsService();
  }

  getRegions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.regionsService.getAllRegions();
      return successResponse(res, 'Regions fetched successfully', result);
    } catch (error) {
      return next(error);
    }
  };

  getRegionById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const result = await this.regionsService.getRegionById(id);
      return successResponse(res, 'Region fetched successfully', result);
    } catch (error) {
      return next(error);
    }
  };

  createRegion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req.user as any).userId;
      const result = await this.regionsService.createRegion(req.body, userId);
      return successResponse(res, 'Region created successfully', result, 201);
    } catch (error) {
      return next(error);
    }
  };

  updateRegion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const userId = (req.user as any).userId;
      const result = await this.regionsService.updateRegion(id, req.body, userId);
      return successResponse(res, 'Region updated successfully', result);
    } catch (error) {
      return next(error);
    }
  };

  deleteRegion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const userId = (req.user as any).userId;
      await this.regionsService.deleteRegion(id, userId);
      return successResponse(res, 'Region deleted successfully');
    } catch (error) {
      return next(error);
    }
  };
}

export default RegionsController;
