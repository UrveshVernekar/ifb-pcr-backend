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

  async getAllFranchises(branchId?: number): Promise<any[]> {
    return this.franchisesRepository.findAll(branchId);
  }

  async getFranchiseById(id: number): Promise<IFranchise> {
    const franchise = await this.franchisesRepository.findById(id);
    if (!franchise) {
      throw ApiError.notFound('Franchise not found');
    }
    return franchise;
  }

  async createFranchise(data: Partial<IFranchise>, userId: number): Promise<IFranchise> {
    // 1. Verify branch exists
    const branch = await this.branchesRepository.findById(data.branch_id!);
    if (!branch) {
      throw ApiError.badRequest('Invalid branch ID: Branch does not exist');
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

  async updateFranchise(id: number, data: Partial<IFranchise>, userId: number): Promise<IFranchise> {
    await this.getFranchiseById(id);

    // 1. Verify branch if updated
    if (data.branch_id) {
      const branch = await this.branchesRepository.findById(data.branch_id);
      if (!branch) {
        throw ApiError.badRequest('Invalid branch ID: Branch does not exist');
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

  async deleteFranchise(id: number, userId: number): Promise<void> {
    await this.getFranchiseById(id);
    await this.franchisesRepository.softDelete(id, userId);
  }
}
