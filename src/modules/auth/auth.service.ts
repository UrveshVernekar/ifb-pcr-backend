import bcrypt from 'bcryptjs';
import { AuthRepository } from './auth.repository';
import { RegisterDto, LoginDto, ForgotPasswordDto, VerifyOtpDto, ChangePasswordDto } from './auth.dto';
import { IAuthResponse, IEmployee } from './auth.types';
import { ApiError } from '../../common/errors/ApiError';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../common/utils/jwt.util';
import redisClient from '../../config/redis';
import { verifyAltchaSolution, generateAltchaChallenge } from '../../common/utils/altcha.util';
import { decryptPassword } from '../../common/utils/crypto.util';
import { sendOtpMail, sendPasswordChangedMail } from '../../common/utils/mailer.util';
import db from '../../config/database';

export class AuthService {
  private authRepository: AuthRepository;

  constructor() {
    this.authRepository = new AuthRepository();
  }

  async register(dto: RegisterDto, currentUser?: any): Promise<IAuthResponse> {
    const existing = await this.authRepository.findByEmail(dto.email);
    if (existing) {
      throw ApiError.conflict('Email is already registered');
    }

    // Role-based validation if initiated by a logged in user
    if (currentUser) {
      if (currentUser.role === 'REGION_HEAD') {
        if (['ADMIN', 'REGION_HEAD'].includes(dto.role)) {
          throw new ApiError(403, 'Forbidden: Cannot create ADMIN or REGION_HEAD users');
        }
        if (dto.role === 'BRANCH_HEAD') {
          if (!dto.branch_id) {
            throw ApiError.badRequest('Branch assignment is required for Branch Head');
          }
          const branch = await db('branches').where({ branch_id: dto.branch_id }).first();
          if (!branch || branch.region_id !== currentUser.regionId) {
            throw new ApiError(403, 'Forbidden: Assigned branch is outside your region');
          }
        }
        if (dto.role === 'FRANCHISE_HEAD') {
          if (!dto.franchise_id) {
            throw ApiError.badRequest('Franchise assignment is required for Franchise Head');
          }
          const franchise = await db('franchises').where({ franchise_id: dto.franchise_id }).first();
          if (franchise) {
            const branch = await db('branches').where({ branch_id: franchise.branch_id }).first();
            if (!branch || branch.region_id !== currentUser.regionId) {
              throw new ApiError(403, 'Forbidden: Assigned franchise is outside your region');
            }
          } else {
            throw ApiError.notFound('Assigned franchise not found');
          }
        }
      } else if (currentUser.role === 'BRANCH_HEAD') {
        if (['ADMIN', 'REGION_HEAD', 'BRANCH_HEAD'].includes(dto.role)) {
          throw new ApiError(403, 'Forbidden: Cannot create ADMIN, REGION_HEAD, or BRANCH_HEAD users');
        }
        if (dto.role === 'FRANCHISE_HEAD') {
          if (!dto.franchise_id) {
            throw ApiError.badRequest('Franchise assignment is required for Franchise Head');
          }
          const franchise = await db('franchises').where({ franchise_id: dto.franchise_id }).first();
          if (!franchise || franchise.branch_id !== currentUser.branchId) {
            throw new ApiError(403, 'Forbidden: Assigned franchise is outside your branch');
          }
        }
      }
    } else {
      // Public registration: force role to EMPLOYEE or USER to prevent privilege escalation
      if (dto.role && !['EMPLOYEE', 'USER'].includes(dto.role)) {
        throw new ApiError(403, 'Forbidden: Public registration is restricted to Employee or User roles');
      }
    }

    const decryptedPassword = decryptPassword(dto.password);
    const passwordToHash = decryptedPassword || dto.password;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordToHash, salt);

    const employee = await this.authRepository.create({
      employee_id: dto.employee_id || null,
      name: dto.name,
      email: dto.email,
      password_hash: passwordHash,
      role: dto.role,
      permissions: dto.permissions || [],
      is_active: true,
      region_id: dto.role === 'REGION_HEAD' ? (dto.region_id || null) : null,
      branch_id: dto.role === 'BRANCH_HEAD' ? (dto.branch_id || null) : null,
      franchise_id: dto.role === 'FRANCHISE_HEAD' ? (dto.franchise_id || null) : null,
    });

    return this.generateAuthResponse(employee);
  }

  async login(dto: LoginDto & { altchaPayload?: string }): Promise<IAuthResponse> {
    if (process.env.ALTCHA_SECRET) {
      const altchaValid = await verifyAltchaSolution(dto.altchaPayload);
      if (!altchaValid) {
        throw ApiError.badRequest('ALTCHA verification failed');
      }
    }

    const employee = await this.authRepository.findByEmail(dto.email);
    if (!employee) {
      throw ApiError.badRequest('Invalid email or password');
    }

    if (!employee.is_active) {
      throw new ApiError(403, 'Your account has been deactivated');
    }

    const decryptedPassword = decryptPassword(dto.password);
    const passwordToCompare = decryptedPassword || dto.password;

    const isMatch = await bcrypt.compare(passwordToCompare, employee.password_hash);
    if (!isMatch) {
      throw ApiError.badRequest('Invalid email or password');
    }

    // Update last login asynchronously
    setImmediate(() => {
      this.authRepository.updateLastLogin(employee.id)
        .catch((err) => console.error('Failed to update last login:', err));
    });

    return this.generateAuthResponse(employee);
  }

  async refresh(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = verifyRefreshToken(token);
    
    const employee = await this.authRepository.findById(payload.userId as number);
    if (!employee || !employee.is_active) {
      throw new ApiError(401, 'Invalid user token session');
    }

    if (employee.refresh_token !== token) {
      throw new ApiError(401, 'Token has been revoked or updated');
    }

    // Check expiration explicitly just to be secure (though jwt.verify does it)
    if (employee.refresh_token_expires_at) {
      const expiry = new Date(employee.refresh_token_expires_at).getTime();
      if (Date.now() > expiry) {
        throw new ApiError(401, 'Session has expired, please log in again');
      }
    }

    // Generate new set of tokens (Token Rotation)
    const tokenPayload = {
      userId: employee.id,
      role: employee.role,
      permissions: Array.isArray(employee.permissions) ? employee.permissions : [],
      regionId: employee.region_id || null,
      branchId: employee.branch_id || null,
      franchiseId: employee.franchise_id || null,
    };

    const newAccessToken = signAccessToken(tokenPayload);
    const newRefreshToken = signRefreshToken(tokenPayload);

    // Calculate expiry (7 days from now matches env default)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.authRepository.updateRefreshToken(employee.id, newRefreshToken, expiresAt);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: number, token?: string): Promise<void> {
    // Invalidate refresh token in DB
    await this.authRepository.updateRefreshToken(userId, null, null);

    // Optional: Blacklist active access token in Redis for duration of its expiry (e.g. 15 mins)
    if (token) {
      const blacklistKey = `blacklist:${token}`;
      // Access tokens are short-lived, let's keep in blacklist for 1 hour
      await redisClient.setex(blacklistKey, 3600, 'true');
    }
  }

  private async generateAuthResponse(employee: IEmployee): Promise<IAuthResponse> {
    const permissions = Array.isArray(employee.permissions)
      ? employee.permissions
      : [];

    const tokenPayload = {
      userId: employee.id,
      role: employee.role,
      permissions,
      regionId: employee.region_id || null,
      branchId: employee.branch_id || null,
      franchiseId: employee.franchise_id || null,
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    // Refresh token expiry calculation (7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Store token in database
    await this.authRepository.updateRefreshToken(employee.id, refreshToken, expiresAt);

    return {
      accessToken,
      refreshToken,
      user: {
        id: employee.id,
        employee_id: employee.employee_id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        permissions,
        region_id: employee.region_id || null,
        branch_id: employee.branch_id || null,
        franchise_id: employee.franchise_id || null,
      },
    };
  }

  async generateAltchaChallenge() {
    return generateAltchaChallenge();
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: boolean; message?: string }> {
    await this.authRepository.cleanupExpiredOtps();

    const { email, employeeCode: encryptedEmployeeCode } = dto;
    if (!email || !encryptedEmployeeCode) {
      throw ApiError.badRequest('Email and employee code are required');
    }

    const decryptedEmployeeCode = decryptPassword(encryptedEmployeeCode);
    if (!decryptedEmployeeCode) {
      throw ApiError.badRequest('Employee code decryption failed');
    }

    const employee = await this.authRepository.findByEmail(email);
    if (!employee || employee.employee_id !== decryptedEmployeeCode) {
      throw ApiError.badRequest('Invalid email or employee code');
    }

    const existingOtp = await this.authRepository.getExistingActiveOtp(email);
    if (existingOtp) {
      throw ApiError.conflict('An OTP is already active. Please use it or wait for it to expire.');
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    await this.authRepository.storeOtp(email, decryptedEmployeeCode, otp, expiry);
    
    // Send email asynchronously
    sendOtpMail(email, otp).catch((err) => console.error('OTP mail sending failed:', err));

    return { success: true };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{ success: boolean; message: string; employeeCode: string }> {
    const { email, otp: encryptedOtp, employeeCode: encryptedEmployeeCode } = dto;
    
    const decryptedOtp = decryptPassword(encryptedOtp);
    const decryptedEmployeeCode = decryptPassword(encryptedEmployeeCode);

    if (!decryptedOtp) throw ApiError.badRequest('OTP decryption failed');
    if (!decryptedEmployeeCode) throw ApiError.badRequest('Employee code decryption failed');

    const row = await this.authRepository.getOtpRecord(email);
    if (!row) {
      throw ApiError.badRequest('OTP not requested or expired');
    }

    if (Date.now() > row.expiry) {
      await this.authRepository.deleteOtpRecord(email);
      throw ApiError.badRequest('OTP expired');
    }

    if (decryptedOtp !== row.otp || decryptedEmployeeCode !== row.id) {
      throw ApiError.badRequest('Invalid OTP');
    }

    const employee = await this.authRepository.findByEmail(email);
    if (!employee || employee.employee_id !== decryptedEmployeeCode) {
      throw ApiError.badRequest('User not found after OTP verification');
    }

    await this.authRepository.deleteOtpRecord(email);

    return {
      success: true,
      message: 'OTP verified successfully',
      employeeCode: decryptedEmployeeCode,
    };
  }

  async changePassword(dto: ChangePasswordDto): Promise<{ success: boolean; message: string }> {
    const decryptedId = decryptPassword(dto.id);
    const decryptedNewPassword = decryptPassword(dto.newPassword);
    const decryptedCompany = decryptPassword(dto.company);

    if (!decryptedId) throw ApiError.badRequest('Employee code decryption failed');
    if (!decryptedNewPassword) throw ApiError.badRequest('New password decryption failed');
    if (!decryptedCompany) throw ApiError.badRequest('Company decryption failed');

    const employee = await this.authRepository.findByEmployeeId(decryptedId);
    if (!employee) {
      throw ApiError.notFound('User not found');
    }

    const isSameAsCurrent = await bcrypt.compare(decryptedNewPassword, employee.password_hash);
    const isSameAsOld = employee.old_password_hash
      ? await bcrypt.compare(decryptedNewPassword, employee.old_password_hash)
      : false;

    if (isSameAsCurrent || isSameAsOld) {
      throw ApiError.badRequest(
        'Your new password matches a previously used password. For security, please select a unique password'
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(decryptedNewPassword, salt);

    await this.authRepository.updatePasswordAndHistory(employee.id, hashedNewPassword, employee.password_hash);

    // Send confirmation email asynchronously
    sendPasswordChangedMail(employee.email).catch((err) =>
      console.error('Password changed confirmation email failed:', err)
    );

    return {
      success: true,
      message: 'Password updated successfully',
    };
  }

  private async isUserInScope(currentUser: any, targetUser: any): Promise<boolean> {
    if (currentUser.role === 'ADMIN') {
      return true;
    }

    if (currentUser.role === 'REGION_HEAD') {
      if (targetUser.role === 'ADMIN' || targetUser.role === 'REGION_HEAD') {
        return false;
      }
      if (targetUser.region_id && targetUser.region_id === currentUser.regionId) {
        return true;
      }
      if (targetUser.branch_id) {
        const branch = await db('branches').where({ branch_id: targetUser.branch_id }).first();
        if (branch && branch.region_id === currentUser.regionId) {
          return true;
        }
      }
      if (targetUser.franchise_id) {
        const franchise = await db('franchises').where({ franchise_id: targetUser.franchise_id }).first();
        if (franchise) {
          const branch = await db('branches').where({ branch_id: franchise.branch_id }).first();
          if (branch && branch.region_id === currentUser.regionId) {
            return true;
          }
        }
      }
      return false;
    }

    if (currentUser.role === 'BRANCH_HEAD') {
      if (['ADMIN', 'REGION_HEAD', 'BRANCH_HEAD'].includes(targetUser.role)) {
        return false;
      }
      if (targetUser.branch_id && targetUser.branch_id === currentUser.branchId) {
        return true;
      }
      if (targetUser.franchise_id) {
        const franchise = await db('franchises').where({ franchise_id: targetUser.franchise_id }).first();
        if (franchise && franchise.branch_id === currentUser.branchId) {
          return true;
        }
      }
      return false;
    }

    return false;
  }

  async getUsers(currentUser: any): Promise<any[]> {
    if (currentUser.role === 'ADMIN') {
      return this.authRepository.findAll();
    } else if (currentUser.role === 'REGION_HEAD') {
      return this.authRepository.findAll({ regionId: currentUser.regionId });
    } else if (currentUser.role === 'BRANCH_HEAD') {
      return this.authRepository.findAll({ branchId: currentUser.branchId });
    }
    return [];
  }

  async updateUser(id: number, data: any, currentUser: any): Promise<IEmployee | null> {
    const existing = await this.authRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound('User not found');
    }

    const inScope = await this.isUserInScope(currentUser, existing);
    if (!inScope) {
      throw new ApiError(403, 'Forbidden: User is outside your management scope');
    }

    if (currentUser.role === 'REGION_HEAD') {
      if (['ADMIN', 'REGION_HEAD'].includes(data.role)) {
        throw new ApiError(403, 'Forbidden: Cannot assign ADMIN or REGION_HEAD role');
      }
      if (data.role === 'BRANCH_HEAD') {
        const branch = await db('branches').where({ branch_id: data.branch_id }).first();
        if (!branch || branch.region_id !== currentUser.regionId) {
          throw new ApiError(403, 'Forbidden: Assigned branch is outside your region');
        }
      }
      if (data.role === 'FRANCHISE_HEAD') {
        const franchise = await db('franchises').where({ franchise_id: data.franchise_id }).first();
        if (franchise) {
          const branch = await db('branches').where({ branch_id: franchise.branch_id }).first();
          if (!branch || branch.region_id !== currentUser.regionId) {
            throw new ApiError(403, 'Forbidden: Assigned franchise is outside your region');
          }
        }
      }
    } else if (currentUser.role === 'BRANCH_HEAD') {
      if (['ADMIN', 'REGION_HEAD', 'BRANCH_HEAD'].includes(data.role)) {
        throw new ApiError(403, 'Forbidden: Cannot assign ADMIN, REGION_HEAD, or BRANCH_HEAD roles');
      }
      if (data.role === 'FRANCHISE_HEAD') {
        const franchise = await db('franchises').where({ franchise_id: data.franchise_id }).first();
        if (!franchise || franchise.branch_id !== currentUser.branchId) {
          throw new ApiError(403, 'Forbidden: Assigned franchise is outside your branch');
        }
      }
    }

    const updateData: any = {
      name: data.name,
      email: data.email,
      role: data.role,
      employee_id: data.employee_id || null,
      region_id: data.role === 'REGION_HEAD' ? data.region_id : null,
      branch_id: data.role === 'BRANCH_HEAD' ? data.branch_id : null,
      franchise_id: data.role === 'FRANCHISE_HEAD' ? data.franchise_id : null,
    };

    if (data.is_active !== undefined) {
      updateData.is_active = data.is_active;
    }

    if (data.password) {
      const decryptedPassword = decryptPassword(data.password);
      const passwordToHash = decryptedPassword || data.password;

      const salt = await bcrypt.genSalt(10);
      updateData.password_hash = await bcrypt.hash(passwordToHash, salt);
    }

    return this.authRepository.update(id, updateData);
  }

  async deleteUser(id: number, currentUser: any): Promise<void> {
    const existing = await this.authRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound('User not found');
    }

    const inScope = await this.isUserInScope(currentUser, existing);
    if (!inScope) {
      throw new ApiError(403, 'Forbidden: User is outside your management scope');
    }

    await this.authRepository.delete(id);
  }
}

export default AuthService;
