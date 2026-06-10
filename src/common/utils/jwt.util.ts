import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { ApiError } from '../errors/ApiError';

export interface ITokenPayload {
  userId: string | number;
  role: string;
  permissions?: string[];
}

export const signAccessToken = (payload: ITokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRATION as any,
  });
};

export const signRefreshToken = (payload: ITokenPayload): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRATION as any,
  });
};

export const verifyAccessToken = (token: string): ITokenPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as ITokenPayload;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Access token has expired');
    }
    throw new ApiError(401, 'Invalid access token');
  }
};

export const verifyRefreshToken = (token: string): ITokenPayload => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as ITokenPayload;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Refresh token has expired');
    }
    throw new ApiError(401, 'Invalid refresh token');
  }
};
