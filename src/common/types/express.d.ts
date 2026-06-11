declare namespace Express {
  export interface Request {
    user?: {
      userId: number;
      role: string;
      permissions?: string[];
      regionId?: number | null;
      branchId?: number | null;
      franchiseId?: number | null;
    };
  }
}
