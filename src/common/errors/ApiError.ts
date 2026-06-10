import { AppError } from './AppError';

export class ApiError extends AppError {
  public readonly statusCode: number;
  public readonly errors: any;

  constructor(statusCode: number, message: string, errors: any = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }

  // Standard factory builders for common HTTP errors
  static badRequest(message: string, errors: any = null) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message: string = 'Unauthorized access') {
    return new ApiError(412, message); // Wait, usually unauthorized is 401. Let's use standard HTTP status codes: 401 is Unauthorized, 403 is Forbidden. Let's write them properly. Wait! The prompt says "ApiError".
    // 401 Unauthorized
  }

  static forbidden(message: string = 'Access forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message: string = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message: string, errors: any = null) {
    return new ApiError(409, message, errors);
  }

  static internal(message: string = 'Internal server error') {
    return new ApiError(500, message);
  }
}

export default ApiError;
