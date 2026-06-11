import { Roles } from '../../common/constants/roles';

export interface IEmployee {
  id: number;
  employee_id?: string | null;
  name: string;
  email: string;
  password_hash: string;
  old_password_hash?: string | null;
  role: Roles;
  permissions?: string | string[] | null;
  refresh_token?: string | null;
  refresh_token_expires_at?: Date | string | null;
  is_active: boolean;
  last_login_at?: Date | string | null;
  region_id?: number | null;
  branch_id?: number | null;
  franchise_id?: number | null;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface IAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    employee_id?: string | null;
    name: string;
    email: string;
    role: Roles;
    permissions: string[];
    region_id?: number | null;
    branch_id?: number | null;
    franchise_id?: number | null;
  };
}

export interface ILoginResult {
  accessToken: string;
  refreshToken: string;
  user: IEmployee;
}
