import { z } from 'zod';

/** Operational ceiling for the weight of one pallet, in kilograms. */
export const MAX_PALLET_WEIGHT_KG = 100_000;

export type WeightEntryInput = {
  id: number;
  weight: unknown;
  quantity: unknown;
};

export type ValidatedWeightEntry = {
  id: number;
  weight: number;
  quantity: number;
};

export type LoadingValidationError = {
  entryId: number | null;
  field: 'entry' | 'weight' | 'quantity';
  code: string;
  message: string;
};

const decimalWeight = z.string().superRefine((value, context) => {
  if (value.trim() === '') {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Gewicht ist erforderlich.' });
    return;
  }
  // Deliberately exclude exponent notation and partial numeric strings.
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value.trim())) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Gewicht muss eine gültige nicht-negative Zahl sein.' });
    return;
  }
  const numeric = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(numeric)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Gewicht muss endlich sein.' });
  } else if (numeric > MAX_PALLET_WEIGHT_KG) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `Gewicht darf höchstens ${MAX_PALLET_WEIGHT_KG.toLocaleString('de-DE')} kg betragen.` });
  }
});

const quantity = z.number({ invalid_type_error: 'Anzahl muss eine Zahl sein.' })
  .finite('Anzahl muss endlich sein.')
  .int('Anzahl muss eine ganze Zahl sein.')
  .nonnegative('Anzahl darf nicht negativ sein.');

const entrySchema = z.object({
  id: z.number().finite(),
  weight: z.union([
    decimalWeight.transform((value) => Number(value.trim().replace(',', '.'))),
    z.number().finite('Gewicht muss endlich sein.').nonnegative('Gewicht darf nicht negativ sein.').max(MAX_PALLET_WEIGHT_KG),
  ]),
  quantity,
});

export type LoadingValidationResult =
  | { success: true; data: ValidatedWeightEntry[]; errors: [] }
  | { success: false; data: null; errors: LoadingValidationError[] };

/** Validates untrusted UI/programmatic state before pallet candidates are built. */
export function validateWeightEntries(input: unknown): LoadingValidationResult {
  const result = z.array(entrySchema).safeParse(input);
  if (result.success) return { success: true, data: result.data, errors: [] };

  return {
    success: false,
    data: null,
    errors: result.error.issues.map((issue) => {
      const index = typeof issue.path[0] === 'number' ? issue.path[0] : null;
      const rawEntry = index == null || !Array.isArray(input) ? undefined : input[index] as { id?: unknown };
      const field = issue.path[1] === 'weight' || issue.path[1] === 'quantity' ? issue.path[1] : 'entry';
      return {
        entryId: typeof rawEntry?.id === 'number' ? rawEntry.id : null,
        field,
        code: issue.code,
        message: issue.message,
      };
    }),
  };
}
