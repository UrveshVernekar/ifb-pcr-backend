import db from '../../config/database';
import { IBranch } from './branches.types';

export class BranchesRepository {
  async findAll(): Promise<any[]> {
    return db('branches')
      .leftJoin('regions', 'branches.region_id', 'regions.region_id')
      .leftJoin('nations', 'regions.nation_id', 'nations.nation_id')
      .select(
        'branches.*',
        'regions.name as region_name',
        'nations.name as nation_name'
      )
      .whereNull('branches.deleted_at');
  }

  async findById(id: number): Promise<IBranch | null> {
    const row = await db('branches')
      .where({ branch_id: id })
      .whereNull('deleted_at')
      .first();
    return row || null;
  }

  async findByCode(code: string): Promise<IBranch | null> {
    const row = await db('branches')
      .where({ code })
      .whereNull('deleted_at')
      .first();
    return row || null;
  }

  async create(data: Partial<IBranch>): Promise<IBranch> {
    const [insertedId] = await db('branches').insert(data);
    const newRow = await this.findById(insertedId);
    if (!newRow) throw new Error('Failed to retrieve created branch');
    return newRow;
  }

  async update(id: number, data: Partial<IBranch>): Promise<IBranch> {
    await db('branches')
      .where({ branch_id: id })
      .update({
        ...data,
        updated_at: db.fn.now(),
      });
    const updatedRow = await this.findById(id);
    if (!updatedRow) throw new Error('Failed to retrieve updated branch');
    return updatedRow;
  }

  async softDelete(id: number, userId: number): Promise<void> {
    await db('branches')
      .where({ branch_id: id })
      .update({
        deleted_at: db.fn.now(),
        deleted_by: userId,
        is_active: false,
      });
  }
}
