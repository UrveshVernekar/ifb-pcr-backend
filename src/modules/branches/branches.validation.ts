import { z } from 'zod';

const preprocessBoolean = z.preprocess(
  (val) => {
    if (val === 1 || val === '1' || val === true || val === 'true') return true;
    if (val === 0 || val === '0' || val === false || val === 'false') return false;
    return val;
  },
  z.boolean()
);

export const createBranchSchema = z.object({
  body: z.object({
    region_id: z.number({ message: 'Region is required' }),
    name: z.string().min(2, 'Branch name must be at least 2 characters').max(100),
    code: z.string().min(2, 'Branch code must be at least 2 characters').max(50),
    address: z.string().optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    state: z.string().max(100).optional().nullable(),
    contact_number: z.string().max(20).optional().nullable(),
    is_active: preprocessBoolean.default(true),
  }),
});

export const updateBranchSchema = z.object({
  body: z.object({
    region_id: z.coerce.number().optional(),
    name: z.string().min(2, 'Branch name must be at least 2 characters').max(100).optional(),
    code: z.string().min(2, 'Branch code must be at least 2 characters').max(50).optional(),
    address: z.string().optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    state: z.string().max(100).optional().nullable(),
    contact_number: z.string().max(20).optional().nullable(),
    is_active: preprocessBoolean.optional(),
  }),
});
