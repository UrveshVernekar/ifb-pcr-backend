import { z } from 'zod';

const preprocessBoolean = z.preprocess(
  (val) => {
    if (val === 1 || val === '1' || val === true || val === 'true') return true;
    if (val === 0 || val === '0' || val === false || val === 'false') return false;
    return val;
  },
  z.boolean()
);

export const createFranchiseSchema = z.object({
  body: z.object({
    branch_id: z.number({ message: 'Branch is required' }),
    name: z.string().min(2, 'Franchise name must be at least 2 characters').max(150),
    code: z.string().min(2, 'Franchise code must be at least 2 characters').max(50),
    contact_person: z.string().max(100).optional().nullable(),
    contact_email: z.string().email('Invalid contact email format').or(z.string().length(0)).optional().nullable(),
    address: z.string().optional().nullable(),
    is_active: preprocessBoolean.default(true),
  }),
});

export const updateFranchiseSchema = z.object({
  body: z.object({
    branch_id: z.coerce.number().optional(),
    name: z.string().min(2, 'Franchise name must be at least 2 characters').max(150).optional(),
    code: z.string().min(2, 'Franchise code must be at least 2 characters').max(50).optional(),
    contact_person: z.string().max(100).optional().nullable(),
    contact_email: z.string().email('Invalid contact email format').or(z.string().length(0)).optional().nullable(),
    address: z.string().optional().nullable(),
    is_active: preprocessBoolean.optional(),
  }),
});
