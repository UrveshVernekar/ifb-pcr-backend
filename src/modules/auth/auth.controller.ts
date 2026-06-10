import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { successResponse } from '../../common/utils/response.util';
import { ApiError } from '../../common/errors/ApiError';
import { AuthRepository } from './auth.repository';

export class AuthController {
  private authService: AuthService;
  private authRepository: AuthRepository;

  constructor() {
    this.authService = new AuthService();
    this.authRepository = new AuthRepository();
  }

  // Register Controller
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.register(req.body);
      
      // Set refresh token in HTTP-only cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return successResponse(res, 'User registered successfully', {
        user: result.user,
        accessToken: result.accessToken,
      }, 201);
    } catch (error) {
      return next(error);
    }
  };

  // Login Controller
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.login(req.body);

      // Set refresh token in HTTP-only cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return successResponse(res, 'Login successful', {
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (error) {
      return next(error);
    }
  };

  // Token Refresh Controller
  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Look for token in cookies, and fallback to request body
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
      
      if (!refreshToken) {
        throw new ApiError(400, 'Refresh token is required');
      }

      const result = await this.authService.refresh(refreshToken);

      // Update refresh token cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return successResponse(res, 'Token refreshed successfully', {
        accessToken: result.accessToken,
      });
    } catch (error) {
      return next(error);
    }
  };

  // Logout Controller
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Unauthorized');
      }

      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
      
      await this.authService.logout(req.user.userId as number, accessToken);

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      return successResponse(res, 'Logged out successfully');
    } catch (error) {
      return next(error);
    }
  };

  // Me Controller (Get active profile info)
  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Unauthorized');
      }

      const employee = await this.authRepository.findById(req.user.userId as number);
      if (!employee) {
        throw new ApiError(404, 'User profile not found');
      }

      return successResponse(res, 'User profile fetched successfully', {
        id: employee.id,
        employee_id: employee.employee_id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        permissions: employee.permissions,
      });
    } catch (error) {
      return next(error);
    }
  };

  // Generate Altcha Challenge
  generateChallenge = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const challenge = await this.authService.generateAltchaChallenge();
      res.status(200).json(challenge);
    } catch (error) {
      return next(error);
    }
  };

  // Forgot Password Controller
  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.forgotPassword(req.body);
      return successResponse(res, 'OTP sent successfully', result);
    } catch (error) {
      return next(error);
    }
  };

  // Verify OTP Controller
  verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.verifyOtp(req.body);
      return successResponse(res, result.message, { employeeCode: result.employeeCode });
    } catch (error) {
      return next(error);
    }
  };

  // Change Password Controller
  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.changePassword(req.body);
      return successResponse(res, result.message);
    } catch (error) {
      return next(error);
    }
  };
}

export default AuthController;
