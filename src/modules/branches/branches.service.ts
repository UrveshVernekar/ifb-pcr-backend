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

  async getAllBranches(): Promise<any[]> {
    return this.branchesRepository.findAll();
  }

  async getBranchById(id: number): Promise<IBranch> {
    const branch = await this.branchesRepository.findById(id);
    if (!branch) {
      throw ApiError.notFound('Branch not found');
    }
    return branch;
  }

  async createBranch(data: Partial<IBranch>, userId: number): Promise<IBranch> {
    // 1. Verify region exists
    const region = await this.regionsRepository.findById(data.region_id!);
    if (!region) {
      throw ApiError.badRequest('Invalid region ID: Region does not exist');
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

  async updateBranch(id: number, data: Partial<IBranch>, userId: number): Promise<IBranch> {
    await this.getBranchById(id);

    // 1. Verify region if updated
    if (data.region_id) {
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

  async deleteBranch(id: number, userId: number): Promise<void> {
    await this.getBranchById(id);
    await this.branchesRepository.softDelete(id, userId);
  }
}
