import db from '../../config/database';
import { IRegion } from './regions.types';

export class RegionsRepository {
  async findAll(options?: { regionId?: number | null; branchId?: number | null; franchiseId?: number | null }): Promise<any[]> {
    const query = db('regions')
      .leftJoin('nations', 'regions.nation_id', 'nations.nation_id')
      .select('regions.*', 'nations.name as nation_name')
      .whereNull('regions.deleted_at');

    if (options?.regionId) {
      query.where('regions.region_id', options.regionId);
    } else if (options?.branchId) {
      query.whereExists(
        db('branches')
          .select(1)
          .whereRaw('branches.region_id = regions.region_id')
          .andWhere('branches.branch_id', options.branchId)
          .whereNull('branches.deleted_at')
      );
    } else if (options?.franchiseId) {
      query.whereExists(
        db('franchises')
          .join('branches', 'franchises.branch_id', 'branches.branch_id')
          .select(1)
          .whereRaw('branches.region_id = regions.region_id')
          .andWhere('franchises.franchise_id', options.franchiseId)
          .whereNull('branches.deleted_at')
          .whereNull('franchises.deleted_at')
      );
    }

    return query;
  }

  async findById(id: number): Promise<IRegion | null> {
    const row = await db('regions')
      .where({ region_id: id })
      .whereNull('deleted_at')
      .first();
    return row || null;
  }

  async findByNameAndNation(name: string, nationId: number): Promise<IRegion | null> {
    const row = await db('regions')
      .where({ name, nation_id: nationId })
      .whereNull('deleted_at')
      .first();
    return row || null;
  }

  async create(data: Partial<IRegion>): Promise<IRegion> {
    const [insertedId] = await db('regions').insert(data);
    const newRow = await this.findById(insertedId);
    if (!newRow) throw new Error('Failed to retrieve created region');
    return newRow;
  }

  async update(id: number, data: Partial<IRegion>): Promise<IRegion> {
    await db('regions')
      .where({ region_id: id })
      .update({
        ...data,
        updated_at: db.fn.now(),
      });
    const updatedRow = await this.findById(id);
    if (!updatedRow) throw new Error('Failed to retrieve updated region');
    return updatedRow;
  }

  async softDelete(id: number, userId: number): Promise<void> {
    await db('regions')
      .where({ region_id: id })
      .update({
        deleted_at: db.fn.now(),
        deleted_by: userId,
        is_active: false,
      });
  }
}
