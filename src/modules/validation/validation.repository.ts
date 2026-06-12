import db from '../../config/database';

export class ValidationRepository {
  async getHistoryByBarcode(barcode: string): Promise<any[]> {
    const [result] = await db.raw('CALL sp_get_machine_history_by_barcode(?)', [barcode]);
    return Array.isArray(result) && Array.isArray(result[0]) ? result[0] : [];
  }

  async getHistoryByProductBarcode(productBarcode: string): Promise<any[]> {
    const [result] = await db.raw('CALL sp_get_machine_history_by_product_barcode(?)', [productBarcode]);
    return Array.isArray(result) && Array.isArray(result[0]) ? result[0] : [];
  }
}
