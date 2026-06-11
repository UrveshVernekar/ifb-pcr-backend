import { Request, Response, NextFunction } from 'express';
import { FranchisesService } from './franchises.service';
import { successResponse } from '../../common/utils/response.util';

export class FranchisesController {
  private franchisesService: FranchisesService;

  constructor() {
    this.franchisesService = new FranchisesService();
  }

  getFranchises = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const branchId = req.query.branch_id ? parseInt(req.query.branch_id as string, 10) : undefined;
      const result = await this.franchisesService.getAllFranchises(branchId, req.user);
      return successResponse(res, 'Franchises fetched successfully', result);
    } catch (error) {
      return next(error);
    }
  };

  getFranchiseById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const result = await this.franchisesService.getFranchiseById(id, req.user);
      return successResponse(res, 'Franchise fetched successfully', result);
    } catch (error) {
      return next(error);
    }
  };

  createFranchise = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req.user as any).userId;
      const result = await this.franchisesService.createFranchise(req.body, userId, req.user);
      return successResponse(res, 'Franchise created successfully', result, 201);
    } catch (error) {
      return next(error);
    }
  };

  updateFranchise = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const userId = (req.user as any).userId;
      const result = await this.franchisesService.updateFranchise(id, req.body, userId, req.user);
      return successResponse(res, 'Franchise updated successfully', result);
    } catch (error) {
      return next(error);
    }
  };

  deleteFranchise = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const userId = (req.user as any).userId;
      await this.franchisesService.deleteFranchise(id, userId, req.user);
      return successResponse(res, 'Franchise deleted successfully');
    } catch (error) {
      return next(error);
    }
  };
}

export default FranchisesController;
