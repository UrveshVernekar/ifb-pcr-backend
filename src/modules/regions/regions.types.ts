export interface IRegion {
  region_id: number;
  nation_id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  is_active: boolean;
  created_at?: Date | string;
  created_by?: number | null;
  updated_at?: Date | string;
  updated_by?: number | null;
  deleted_at?: Date | string | null;
  deleted_by?: number | null;
}
