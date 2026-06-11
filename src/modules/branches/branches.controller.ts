import { Request, Response, NextFunction } from 'express';
import { BranchesService } from './branches.service';
import { successResponse } from '../../common/utils/response.util';

export class BranchesController {
  private branchesService: BranchesService;

  constructor() {
    this.branchesService = new BranchesService();
  }

  getBranches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.branchesService.getAllBranches(req.user);
      return successResponse(res, 'Branches fetched successfully', result);
    } catch (error) {
      return next(error);
    }
  };

  getBranchById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const result = await this.branchesService.getBranchById(id, req.user);
      return successResponse(res, 'Branch fetched successfully', result);
    } catch (error) {
      return next(error);
    }
  };

  createBranch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req.user as any).userId;
      const result = await this.branchesService.createBranch(req.body, userId, req.user);
      return successResponse(res, 'Branch created successfully', result, 201);
    } catch (error) {
      return next(error);
    }
  };

  updateBranch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const userId = (req.user as any).userId;
      const result = await this.branchesService.updateBranch(id, req.body, userId, req.user);
      return successResponse(res, 'Branch updated successfully', result);
    } catch (error) {
      return next(error);
    }
  };

  deleteBranch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const userId = (req.user as any).userId;
      await this.branchesService.deleteBranch(id, userId, req.user);
      return successResponse(res, 'Branch deleted successfully');
    } catch (error) {
      return next(error);
    }
  };
}

export default BranchesController;
