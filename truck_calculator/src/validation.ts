import { z } from 'zod';

export const UnitsSchema = z.enum(['metric', 'imperial']);

export const ContainerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  innerLength: z.number().finite().nonnegative(),
  innerWidth: z.number().finite().nonnegative(),
  innerHeight: z.number().finite().nonnegative().optional(),
  maxPayloadKg: z.number().finite().nonnegative().optional(),
});

export const PalletSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  length: z.number().finite().nonnegative(),
  width: z.number().finite().nonnegative(),
  height: z.number().finite().nonnegative().optional(),
  weightKg: z.number().finite().nonnegative().optional(),
});

export const ConstraintsSchema = z.object({
  allowRotate: z.boolean(),
  wallClearance: z.number().finite().nonnegative(),
  betweenClearance: z.number().finite().nonnegative(),
  aisleLengthReserve: z.number().finite().nonnegative().optional(),
});

export const PlannerInputSchema = z.object({
  container: ContainerSchema,
  pallet: PalletSchema,
  constraints: ConstraintsSchema,
  units: UnitsSchema.default('metric'),
  note: z.string().max(2000).optional(),
});

export type PlannerInputs = z.infer<typeof PlannerInputSchema>;

export function validatePlannerInputs(input: unknown) {
  return PlannerInputSchema.safeParse(input);
}

export type ValidationIssues = z.ZodIssue[];