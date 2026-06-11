export interface IFranchise {
  franchise_id: number;
  branch_id: number;
  name: string;
  code?: string | null;
  contact_person?: string | null;
  contact_email?: string | null;
  address?: string | null;
  is_active: boolean;
  created_at?: Date | string;
  created_by?: number | null;
  updated_at?: Date | string;
  updated_by?: number | null;
  deleted_at?: Date | string | null;
  deleted_by?: number | null;
}
