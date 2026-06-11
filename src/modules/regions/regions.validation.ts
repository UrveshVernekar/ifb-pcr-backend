import { z } from 'zod';

const preprocessBoolean = z.preprocess(
  (val) => {
    if (val === 1 || val === '1' || val === true || val === 'true') return true;
    if (val === 0 || val === '0' || val === false || val === 'false') return false;
    return val;
  },
  z.boolean()
);

export const createRegionSchema = z.object({
  body: z.object({
    nation_id: z.coerce.number().default(1),
    name: z.string().min(2, 'Region name must be at least 2 characters').max(100),
    code: z.string().max(20).optional().nullable(),
    description: z.string().optional().nullable(),
    is_active: preprocessBoolean.default(true),
  }),
});

export const updateRegionSchema = z.object({
  body: z.object({
    nation_id: z.coerce.number().optional(),
    name: z.string().min(2, 'Region name must be at least 2 characters').max(100).optional(),
    code: z.string().max(20).optional().nullable(),
    description: z.string().optional().nullable(),
    is_active: preprocessBoolean.optional(),
  }),
});
