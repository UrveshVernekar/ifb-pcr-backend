import db from '../../config/database';
import { IFranchise } from './franchises.types';

export class FranchisesRepository {
  async findAll(branchId?: number, options?: { regionId?: number | null; branchId?: number | null; franchiseId?: number | null }): Promise<any[]> {
    const query = db('franchises')
      .leftJoin('branches', 'franchises.branch_id', 'branches.branch_id')
      .leftJoin('regions', 'branches.region_id', 'regions.region_id')
      .select(
        'franchises.*',
        'branches.name as branch_name',
        'regions.name as region_name'
      )
      .whereNull('franchises.deleted_at');

    if (branchId) {
      query.andWhere('franchises.branch_id', branchId);
    }

    if (options?.regionId) {
      query.andWhere('branches.region_id', options.regionId);
    }
    if (options?.branchId) {
      query.andWhere('franchises.branch_id', options.branchId);
    }
    if (options?.franchiseId) {
      query.andWhere('franchises.franchise_id', options.franchiseId);
    }

    return query;
  }

  async findById(id: number): Promise<IFranchise | null> {
    const row = await db('franchises')
      .where({ franchise_id: id })
      .whereNull('deleted_at')
      .first();
    return row || null;
  }

  async findByCode(code: string): Promise<IFranchise | null> {
    const row = await db('franchises')
      .where({ code })
      .whereNull('deleted_at')
      .first();
    return row || null;
  }

  async create(data: Partial<IFranchise>): Promise<IFranchise> {
    const [insertedId] = await db('franchises').insert(data);
    const newRow = await this.findById(insertedId);
    if (!newRow) throw new Error('Failed to retrieve created franchise');
    return newRow;
  }

  async update(id: number, data: Partial<IFranchise>): Promise<IFranchise> {
    await db('franchises')
      .where({ franchise_id: id })
      .update({
        ...data,
        updated_at: db.fn.now(),
      });
    const updatedRow = await this.findById(id);
    if (!updatedRow) throw new Error('Failed to retrieve updated franchise');
    return updatedRow;
  }

  async softDelete(id: number, userId: number): Promise<void> {
    await db('franchises')
      .where({ franchise_id: id })
      .update({
        deleted_at: db.fn.now(),
        deleted_by: userId,
        is_active: false,
      });
  }
}
