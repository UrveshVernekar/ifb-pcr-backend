import { Response } from 'express';

export interface IApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const successResponse = <T>(
  res: Response,
  message: string,
  data?: T,
  statusCode = 200
): void => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const paginatedResponse = <T>(
  res: Response,
  message: string,
  data: T[],
  pagination: { page: number; limit: number; total: number },
  statusCode = 200
): void => {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  
  res.status(statusCode).json({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages,
    },
  });
};

export const errorResponse = (
  res: Response,
  message: string,
  statusCode = 500,
  errors: any = null
): void => {
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
};
