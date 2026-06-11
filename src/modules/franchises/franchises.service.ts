import { FranchisesRepository } from './franchises.repository';
import { BranchesRepository } from '../branches/branches.repository';
import { IFranchise } from './franchises.types';
import { ApiError } from '../../common/errors/ApiError';

export class FranchisesService {
  private franchisesRepository: FranchisesRepository;
  private branchesRepository: BranchesRepository;

  constructor() {
    this.franchisesRepository = new FranchisesRepository();
    this.branchesRepository = new BranchesRepository();
  }

  async getAllFranchises(branchId?: number, user?: any): Promise<any[]> {
    if (user && user.role !== 'ADMIN') {
      const options = {
        regionId: user.role === 'REGION_HEAD' ? user.regionId : undefined,
        branchId: user.role === 'BRANCH_HEAD' ? user.branchId : undefined,
        franchiseId: user.role === 'FRANCHISE_HEAD' ? user.franchiseId : undefined,
      };
      return this.franchisesRepository.findAll(branchId, options);
    }
    return this.franchisesRepository.findAll(branchId);
  }

  async getFranchiseById(id: number, user?: any): Promise<IFranchise> {
    const franchise = await this.franchisesRepository.findById(id);
    if (!franchise) {
      throw ApiError.notFound('Franchise not found');
    }
    if (user && user.role !== 'ADMIN') {
      if (user.role === 'BRANCH_HEAD' && franchise.branch_id !== user.branchId) {
        throw new ApiError(403, 'Forbidden: You do not have access to this franchise');
      }
      if (user.role === 'FRANCHISE_HEAD' && franchise.franchise_id !== user.franchiseId) {
        throw new ApiError(403, 'Forbidden: You do not have access to this franchise');
      }
      if (user.role === 'REGION_HEAD') {
        const allowedFranchises = await this.franchisesRepository.findAll(undefined, { regionId: user.regionId });
        const isAllowed = allowedFranchises.some((f) => f.franchise_id === franchise.franchise_id);
        if (!isAllowed) throw new ApiError(403, 'Forbidden: You do not have access to this franchise');
      }
    }
    return franchise;
  }

  async createFranchise(data: Partial<IFranchise>, userId: number, user?: any): Promise<IFranchise> {
    // If branch head, force branch_id to their assigned branch
    if (user && user.role === 'BRANCH_HEAD') {
      data.branch_id = user.branchId;
    }

    // 1. Verify branch exists
    const branch = await this.branchesRepository.findById(data.branch_id!);
    if (!branch) {
      throw ApiError.badRequest('Invalid branch ID: Branch does not exist');
    }

    // Verify regional access
    if (user && user.role === 'REGION_HEAD' && branch.region_id !== user.regionId) {
      throw new ApiError(403, 'Forbidden: You cannot create a franchise in a branch outside your region');
    }

    // Verify branch head access
    if (user && user.role === 'BRANCH_HEAD' && data.branch_id !== user.branchId) {
      throw new ApiError(403, 'Forbidden: You cannot create a franchise in another branch');
    }

    // 2. Verify code uniqueness
    const existing = await this.franchisesRepository.findByCode(data.code!);
    if (existing) {
      throw ApiError.conflict('Franchise code already exists');
    }

    const payload: Partial<IFranchise> = {
      ...data,
      created_by: userId,
      updated_by: userId,
    };

    return this.franchisesRepository.create(payload);
  }

  async updateFranchise(id: number, data: Partial<IFranchise>, userId: number, user?: any): Promise<IFranchise> {
    await this.getFranchiseById(id, user);

    // 1. Verify branch if updated
    if (data.branch_id) {
      if (user && user.role === 'BRANCH_HEAD' && data.branch_id !== user.branchId) {
        throw new ApiError(403, 'Forbidden: You cannot change franchise branch');
      }
      const branch = await this.branchesRepository.findById(data.branch_id);
      if (!branch) {
        throw ApiError.badRequest('Invalid branch ID: Branch does not exist');
      }
      if (user && user.role === 'REGION_HEAD' && branch.region_id !== user.regionId) {
        throw new ApiError(403, 'Forbidden: You cannot move a franchise to a branch outside your region');
      }
    }

    // 2. Verify code if updated
    if (data.code) {
      const existing = await this.franchisesRepository.findByCode(data.code);
      if (existing && existing.franchise_id !== id) {
        throw ApiError.conflict('Franchise code already exists');
      }
    }

    const payload: Partial<IFranchise> = {
      ...data,
      updated_by: userId,
    };

    return this.franchisesRepository.update(id, payload);
  }

  async deleteFranchise(id: number, userId: number, user?: any): Promise<void> {
    await this.getFranchiseById(id, user);
    await this.franchisesRepository.softDelete(id, userId);
  }
}
