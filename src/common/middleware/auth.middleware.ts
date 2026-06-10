import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import { ApiError } from '../errors/ApiError';
import redisClient from '../../config/redis';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new ApiError(401, 'Access token is required'));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(new ApiError(401, 'Invalid access token format'));
    }

    // Optional: Check if token is blacklisted in Redis (e.g. after logout)
    const isBlacklisted = await redisClient.exists(`blacklist:${token}`);
    if (isBlacklisted) {
      return next(new ApiError(401, 'Token has been invalidated'));
    }

    const payload = verifyAccessToken(token);
    req.user = payload;
    return next();
  } catch (error) {
    return next(error);
  }
};

export const authorize = (
  allowedRoles?: string[],
  requiredPermissions?: string[]
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ApiError(401, 'User authentication required'));
    }

    const { role, permissions = [] } = req.user;

    // Check Roles
    if (allowedRoles && allowedRoles.length > 0) {
      if (!allowedRoles.includes(role)) {
        return next(new ApiError(403, 'Forbidden: Insufficient role permissions'));
      }
    }

    // Check Permissions
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasPermission = requiredPermissions.every((perm) =>
        permissions.includes(perm)
      );
      if (!hasPermission) {
        return next(new ApiError(403, 'Forbidden: Missing required permission(s)'));
      }
    }

    return next();
  };
};
