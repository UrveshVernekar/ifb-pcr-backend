import db from '../../config/database';
import { IRegion } from './regions.types';

export class RegionsRepository {
  async findAll(): Promise<any[]> {
    return db('regions')
      .leftJoin('nations', 'regions.nation_id', 'nations.nation_id')
      .select('regions.*', 'nations.name as nation_name')
      .whereNull('regions.deleted_at');
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
