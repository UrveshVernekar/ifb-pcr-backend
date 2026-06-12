import { ValidationRepository } from './validation.repository';
import { ApiError } from '../../common/errors/ApiError';

export class ValidationService {
  private repository: ValidationRepository;

  constructor() {
    this.repository = new ValidationRepository();
  }

  async getMachineHistory(barcode: string): Promise<any[]> {
    if (!barcode) {
      throw ApiError.badRequest('Barcode is required');
    }

    // Try finding by part barcode first
    let rows = await this.repository.getHistoryByBarcode(barcode);
    
    // If not found, try finding by product barcode / machine serial number
    if (!rows || rows.length === 0) {
      rows = await this.repository.getHistoryByProductBarcode(barcode);
    }

    return rows;
  }
}
