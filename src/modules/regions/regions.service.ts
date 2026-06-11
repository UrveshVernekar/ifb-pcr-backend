import { RegionsRepository } from './regions.repository';
import { IRegion } from './regions.types';
import { ApiError } from '../../common/errors/ApiError';

export class RegionsService {
  private regionsRepository: RegionsRepository;

  constructor() {
    this.regionsRepository = new RegionsRepository();
  }

  async getAllRegions(): Promise<any[]> {
    return this.regionsRepository.findAll();
  }

  async getRegionById(id: number): Promise<IRegion> {
    const region = await this.regionsRepository.findById(id);
    if (!region) {
      throw ApiError.notFound('Region not found');
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
