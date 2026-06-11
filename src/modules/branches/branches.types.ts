export interface IBranch {
  branch_id: number;
  region_id: number;
  name: string;
  code?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  contact_number?: string | null;
  is_active: boolean;
  created_at?: Date | string;
  created_by?: number | null;
  updated_at?: Date | string;
  updated_by?: number | null;
  deleted_at?: Date | string | null;
  deleted_by?: number | null;
}
