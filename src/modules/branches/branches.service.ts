import { BranchesRepository } from './branches.repository';
import { RegionsRepository } from '../regions/regions.repository';
import { IBranch } from './branches.types';
import { ApiError } from '../../common/errors/ApiError';

export class BranchesService {
  private branchesRepository: BranchesRepository;
  private regionsRepository: RegionsRepository;

  constructor() {
    this.branchesRepository = new BranchesRepository();
    this.regionsRepository = new RegionsRepository();
  }

  async getAllBranches(user?: any): Promise<any[]> {
    if (user && user.role !== 'ADMIN') {
      const options = {
        regionId: user.role === 'REGION_HEAD' ? user.regionId : undefined,
        branchId: user.role === 'BRANCH_HEAD' ? user.branchId : undefined,
        franchiseId: user.role === 'FRANCHISE_HEAD' ? user.franchiseId : undefined,
      };
      return this.branchesRepository.findAll(options);
    }
    return this.branchesRepository.findAll();
  }

  async getBranchById(id: number, user?: any): Promise<IBranch> {
    const branch = await this.branchesRepository.findById(id);
    if (!branch) {
      throw ApiError.notFound('Branch not found');
    }
    if (user && user.role !== 'ADMIN') {
      if (user.role === 'REGION_HEAD' && branch.region_id !== user.regionId) {
        throw new ApiError(403, 'Forbidden: You do not have access to this branch');
      }
      if (user.role === 'BRANCH_HEAD' && branch.branch_id !== user.branchId) {
        throw new ApiError(403, 'Forbidden: You do not have access to this branch');
      }
      if (user.role === 'FRANCHISE_HEAD') {
        const allowedBranches = await this.branchesRepository.findAll({ franchiseId: user.franchiseId });
        const isAllowed = allowedBranches.some((b) => b.branch_id === branch.branch_id);
        if (!isAllowed) throw new ApiError(403, 'Forbidden: You do not have access to this branch');
      }
    }
    return branch;
  }

  async createBranch(data: Partial<IBranch>, userId: number, user?: any): Promise<IBranch> {
    // If region head, force region_id to their assigned region
    if (user && user.role === 'REGION_HEAD') {
      data.region_id = user.regionId;
    }

    // 1. Verify region exists
    const region = await this.regionsRepository.findById(data.region_id!);
    if (!region) {
      throw ApiError.badRequest('Invalid region ID: Region does not exist');
    }

    // Extra safety: double check region head is inserting in their own region
    if (user && user.role === 'REGION_HEAD' && data.region_id !== user.regionId) {
      throw new ApiError(403, 'Forbidden: You cannot create a branch in another region');
    }

    // 2. Verify code uniqueness
    const existing = await this.branchesRepository.findByCode(data.code!);
    if (existing) {
      throw ApiError.conflict('Branch code already exists');
    }

    const payload: Partial<IBranch> = {
      ...data,
      created_by: userId,
      updated_by: userId,
    };

    return this.branchesRepository.create(payload);
  }

  async updateBranch(id: number, data: Partial<IBranch>, userId: number, user?: any): Promise<IBranch> {
    await this.getBranchById(id, user);

    // 1. Verify region if updated
    if (data.region_id) {
      if (user && user.role === 'REGION_HEAD' && data.region_id !== user.regionId) {
        throw new ApiError(403, 'Forbidden: You cannot change branch region');
      }
      const region = await this.regionsRepository.findById(data.region_id);
      if (!region) {
        throw ApiError.badRequest('Invalid region ID: Region does not exist');
      }
    }

    // 2. Verify code if updated
    if (data.code) {
      const existing = await this.branchesRepository.findByCode(data.code);
      if (existing && existing.branch_id !== id) {
        throw ApiError.conflict('Branch code already exists');
      }
    }

    const payload: Partial<IBranch> = {
      ...data,
      updated_by: userId,
    };

    return this.branchesRepository.update(id, payload);
  }

  async deleteBranch(id: number, userId: number, user?: any): Promise<void> {
    await this.getBranchById(id, user);
    await this.branchesRepository.softDelete(id, userId);
  }
}
