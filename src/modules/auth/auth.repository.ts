import db from '../../config/database';
import { IEmployee } from './auth.types';

export class AuthRepository {
  
  private mapFromDb(row: any): IEmployee | null {
    if (!row) return null;
    
    let parsedPermissions: string[] = [];
    if (typeof row.permissions === 'string') {
      try {
        parsedPermissions = JSON.parse(row.permissions);
      } catch {
        parsedPermissions = [];
      }
    } else if (Array.isArray(row.permissions)) {
      parsedPermissions = row.permissions;
    }

    return {
      id: row.user_id,
      employee_id: row.employee_code,
      name: row.full_name,
      email: row.email,
      password_hash: row.password_hash,
      old_password_hash: row.old_password_hash,
      role: row.role_code || row.role,
      permissions: parsedPermissions,
      refresh_token: row.refresh_token,
      refresh_token_expires_at: row.refresh_token_expires_at,
      is_active: Boolean(row.is_active),
      last_login_at: row.last_login_at,
      region_id: row.region_id,
      branch_id: row.branch_id,
      franchise_id: row.franchise_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapToDb(employee: Partial<IEmployee>): any {
    const data = {} as any;
    if (employee.employee_id !== undefined) data.employee_code = employee.employee_id;
    if (employee.name !== undefined) data.full_name = employee.name;
    if (employee.email !== undefined) data.email = employee.email;
    if (employee.password_hash !== undefined) data.password_hash = employee.password_hash;
    if (employee.old_password_hash !== undefined) data.old_password_hash = employee.old_password_hash;
    if (employee.refresh_token !== undefined) data.refresh_token = employee.refresh_token;
    if (employee.refresh_token_expires_at !== undefined) data.refresh_token_expires_at = employee.refresh_token_expires_at;
    if (employee.last_login_at !== undefined) data.last_login_at = employee.last_login_at;
    if (employee.region_id !== undefined) data.region_id = employee.region_id;
    if (employee.branch_id !== undefined) data.branch_id = employee.branch_id;
    if (employee.franchise_id !== undefined) data.franchise_id = employee.franchise_id;
    if (employee.is_active !== undefined) {
      data.is_active = employee.is_active ? 1 : 0;
    }
    return data;
  }

  async findByEmail(email: string): Promise<IEmployee | null> {
    const row = await db('users')
      .leftJoin('roles', 'users.role_id', 'roles.role_id')
      .select('users.*', 'roles.role_code')
      .where({ 'users.email': email })
      .first();
    return this.mapFromDb(row);
  }

  async findById(id: number): Promise<IEmployee | null> {
    const row = await db('users')
      .leftJoin('roles', 'users.role_id', 'roles.role_id')
      .select('users.*', 'roles.role_code')
      .where({ 'users.user_id': id })
      .first();
    return this.mapFromDb(row);
  }

  async create(employeeData: Omit<IEmployee, 'id'>): Promise<IEmployee> {
    const dbData = this.mapToDb(employeeData);
    
    // Resolve role_id from roles table using the role code string
    const roleRow = await db('roles').where({ role_code: employeeData.role }).first();
    dbData.role_id = roleRow ? roleRow.role_id : 1; // Fallback to 1 if not found

    // Knex return values differ by dialect, so we retrieve the ID and fetch the row
    const result = await db('users').insert(dbData);
    
    let insertedId: number;
    if (Array.isArray(result) && result.length > 0) {
      const firstVal = result[0] as any;
      insertedId = typeof firstVal === 'object' && firstVal !== null ? firstVal.id : firstVal;
    } else {
      insertedId = result as any;
    }

    const newRow = await db('users')
      .leftJoin('roles', 'users.role_id', 'roles.role_id')
      .select('users.*', 'roles.role_code')
      .where({ 'users.user_id': insertedId })
      .first();

    const createdEmployee = this.mapFromDb(newRow);
    if (!createdEmployee) {
      throw new Error('Failed to retrieve created user record');
    }
    return createdEmployee;
  }

  async updateRefreshToken(
    id: number,
    refreshToken: string | null,
    expiresAt: Date | string | null
  ): Promise<void> {
    await db('users')
      .where({ user_id: id })
      .update({
        refresh_token: refreshToken,
        refresh_token_expires_at: expiresAt,
        updated_at: db.fn.now(),
      });
  }

  async findByEmployeeId(employeeId: string): Promise<IEmployee | null> {
    const row = await db('users')
      .leftJoin('roles', 'users.role_id', 'roles.role_id')
      .select('users.*', 'roles.role_code')
      .where({ 'users.employee_code': employeeId })
      .first();
    return this.mapFromDb(row);
  }

  async updatePasswordAndHistory(
    id: number,
    newHash: string,
    oldHash: string | null
  ): Promise<void> {
    await db('users')
      .where({ user_id: id })
      .update({
        password_hash: newHash,
        old_password_hash: oldHash,
        updated_at: db.fn.now(),
      });
  }

  async updateLastLogin(id: number): Promise<void> {
    await db('users')
      .where({ user_id: id })
      .update({
        last_login_at: db.fn.now(),
      });
  }

  // OTP Operations
  async cleanupExpiredOtps(): Promise<void> {
    await db('otp_store').where('expiry', '<', Date.now()).delete();
  }

  async getExistingActiveOtp(email: string): Promise<{ otp: string; expiry: number; id: string } | null> {
    const row = await db('otp_store')
      .where({ email })
      .andWhere('expiry', '>', Date.now())
      .first();
    return row ? { otp: row.otp, expiry: Number(row.expiry), id: row.id } : null;
  }

  async storeOtp(email: string, employeeId: string, otp: string, expiry: number): Promise<void> {
    await db('otp_store').insert({
      email,
      id: employeeId,
      otp,
      expiry,
    });
  }

  async getOtpRecord(email: string): Promise<{ otp: string; expiry: number; id: string } | null> {
    const row = await db('otp_store').where({ email }).first();
    return row ? { otp: row.otp, expiry: Number(row.expiry), id: row.id } : null;
  }

  async deleteOtpRecord(email: string): Promise<void> {
    await db('otp_store').where({ email }).delete();
  }

  async findAll(filters?: { regionId?: number; branchId?: number }): Promise<any[]> {
    let query = db('users')
      .leftJoin('roles', 'users.role_id', 'roles.role_id')
      .leftJoin('regions', 'users.region_id', 'regions.region_id')
      .leftJoin('branches', 'users.branch_id', 'branches.branch_id')
      .leftJoin('franchises', 'users.franchise_id', 'franchises.franchise_id')
      .select(
        'users.*',
        'roles.role_code',
        'regions.name as region_name',
        'branches.name as branch_name',
        'franchises.name as franchise_name'
      );

    if (filters?.branchId) {
      query = query.where(function() {
        this.where('users.branch_id', filters.branchId)
            .orWhereIn('users.franchise_id', function() {
              this.select('franchise_id').from('franchises').where('branch_id', filters.branchId);
            });
      });
    } else if (filters?.regionId) {
      query = query.where(function() {
        this.where('users.region_id', filters.regionId)
            .orWhereIn('users.branch_id', function() {
              this.select('branch_id').from('branches').where('region_id', filters.regionId);
            })
            .orWhereIn('users.franchise_id', function() {
              this.select('franchise_id').from('franchises').whereIn('branch_id', function() {
                this.select('branch_id').from('branches').where('region_id', filters.regionId);
              });
            });
      });
    }

    const rows = await query.orderBy('users.user_id', 'desc');

    return rows.map(row => {
      const employee = this.mapFromDb(row);
      if (!employee) return null;
      return {
        ...employee,
        region_name: row.region_name || null,
        branch_name: row.branch_name || null,
        franchise_name: row.franchise_name || null,
      };
    }).filter(Boolean) as any[];
  }

  async update(id: number, employeeData: Partial<IEmployee>): Promise<IEmployee | null> {
    const dbData = this.mapToDb(employeeData);
    
    if (employeeData.role) {
      const roleRow = await db('roles').where({ role_code: employeeData.role }).first();
      dbData.role_id = roleRow ? roleRow.role_id : 1;
    }

    await db('users')
      .where({ user_id: id })
      .update({
        ...dbData,
        updated_at: db.fn.now(),
      });

    const updatedRow = await db('users')
      .leftJoin('roles', 'users.role_id', 'roles.role_id')
      .select('users.*', 'roles.role_code')
      .where({ 'users.user_id': id })
      .first();

    return this.mapFromDb(updatedRow);
  }

  async delete(id: number): Promise<void> {
    await db('users').where({ user_id: id }).delete();
  }
}

export default AuthRepository;
