import { RegionsRepository } from './regions.repository';
import { IRegion } from './regions.types';
import { ApiError } from '../../common/errors/ApiError';

export class RegionsService {
  private regionsRepository: RegionsRepository;

  constructor() {
    this.regionsRepository = new RegionsRepository();
  }

  async getAllRegions(user?: any): Promise<any[]> {
    if (user && user.role !== 'ADMIN') {
      const options = {
        regionId: user.role === 'REGION_HEAD' ? user.regionId : undefined,
        branchId: user.role === 'BRANCH_HEAD' ? user.branchId : undefined,
        franchiseId: user.role === 'FRANCHISE_HEAD' ? user.franchiseId : undefined,
      };
      return this.regionsRepository.findAll(options);
    }
    return this.regionsRepository.findAll();
  }

  async getRegionById(id: number, user?: any): Promise<IRegion> {
    const region = await this.regionsRepository.findById(id);
    if (!region) {
      throw ApiError.notFound('Region not found');
    }
    if (user && user.role !== 'ADMIN') {
      if (user.role === 'REGION_HEAD' && region.region_id !== user.regionId) {
        throw new ApiError(403, 'Forbidden: You do not have access to this region');
      }
      if (user.role === 'BRANCH_HEAD') {
        const allowedRegions = await this.regionsRepository.findAll({ branchId: user.branchId });
        const isAllowed = allowedRegions.some((r) => r.region_id === region.region_id);
        if (!isAllowed) throw new ApiError(403, 'Forbidden: You do not have access to this region');
      }
      if (user.role === 'FRANCHISE_HEAD') {
        const allowedRegions = await this.regionsRepository.findAll({ franchiseId: user.franchiseId });
        const isAllowed = allowedRegions.some((r) => r.region_id === region.region_id);
        if (!isAllowed) throw new ApiError(403, 'Forbidden: You do not have access to this region');
      }
    }
    return region;
  }

  async createRegion(data: Partial<IRegion>, userId: number): Promise<IRegion> {
    const nationId = data.nation_id || 1;
    const existing = await this.regionsRepository.findByNameAndNation(data.name!, nationId);
    if (existing) {
      throw ApiError.conflict('Region name already exists in this nation');
    }

    const payload: Partial<IRegion> = {
      ...data,
      nation_id: nationId,
      created_by: userId,
      updated_by: userId,
    };

    return this.regionsRepository.create(payload);
  }

  async updateRegion(id: number, data: Partial<IRegion>, userId: number): Promise<IRegion> {
    const region = await this.getRegionById(id);

    if (data.name) {
      const nationId = data.nation_id || region.nation_id;
      const existing = await this.regionsRepository.findByNameAndNation(data.name, nationId);
      if (existing && existing.region_id !== id) {
        throw ApiError.conflict('Region name already exists in this nation');
      }
    }

    const payload: Partial<IRegion> = {
      ...data,
      updated_by: userId,
    };

    return this.regionsRepository.update(id, payload);
  }

  async deleteRegion(id: number, userId: number): Promise<void> {
    await this.getRegionById(id);
    await this.regionsRepository.softDelete(id, userId);
  }
}
