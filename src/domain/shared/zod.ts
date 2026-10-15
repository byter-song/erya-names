import { z as mini } from "zod/mini";
import type { z as classic } from "zod";

type ChainableSchema = {
  _zod: { def: { type: string } };
  check: (...checks: unknown[]) => unknown;
  shape?: Record<string, unknown>;
};

function decorate<T>(schema: T): T {
  if (!schema || typeof schema !== "object" || !("_zod" in schema)) return schema;
  const chain = schema as ChainableSchema & Record<string, unknown>;
  if (chain.optional) return schema;

  const checked = (check: unknown) => decorate(chain.check(check));
  Object.assign(chain, {
    min(value: number, message?: string) {
      return checked(
        chain._zod.def.type === "number"
          ? mini.minimum(value, message)
          : mini.minLength(value, message),
      );
    },
    max(value: number, message?: string) {
      return checked(
        chain._zod.def.type === "number"
          ? mini.maximum(value, message)
          : mini.maxLength(value, message),
      );
    },
    length(value: number, message?: string) {
      return checked(mini.length(value, message));
    },
    regex(pattern: RegExp, message?: string) {
      return checked(mini.regex(pattern, message));
    },
    trim() {
      return checked(mini.trim());
    },
    int() {
      return checked(mini.int());
    },
    positive() {
      return checked(mini.positive());
    },
    nonnegative() {
      return checked(mini.nonnegative());
    },
    refine(predicate: (value: unknown) => boolean, message?: string) {
      return checked(mini.refine(predicate, message));
    },
    superRefine(refinement: Parameters<typeof mini.superRefine>[0]) {
      return checked(mini.superRefine(refinement));
    },
    optional() {
      return decorate(mini.optional(chain as never));
    },
    nullable() {
      return decorate(mini.nullable(chain as never));
    },
    default(value: unknown) {
      return decorate(mini._default(chain as never, value as never));
    },
    extend(shape: Record<string, unknown>) {
      return decorate(mini.extend(chain as never, shape as never));
    },
    strict() {
      return decorate(mini.strictObject(chain.shape ?? {}));
    },
  });
  return schema;
}

const wrapped = {
  array: (...args: Parameters<typeof mini.array>) => decorate(mini.array(...args)),
  boolean: (...args: Parameters<typeof mini.boolean>) => decorate(mini.boolean(...args)),
  discriminatedUnion: (...args: Parameters<typeof mini.discriminatedUnion>) =>
    decorate(mini.discriminatedUnion(...args)),
  enum: (...args: Parameters<typeof mini.enum>) => decorate(mini.enum(...args)),
  literal: (...args: Parameters<typeof mini.literal>) => decorate(mini.literal(...args)),
  never: (...args: Parameters<typeof mini.never>) => decorate(mini.never(...args)),
  number: (...args: Parameters<typeof mini.number>) => decorate(mini.number(...args)),
  object: (...args: Parameters<typeof mini.object>) => decorate(mini.object(...args)),
  record: (...args: Parameters<typeof mini.record>) => decorate(mini.record(...args)),
  string: (...args: Parameters<typeof mini.string>) => decorate(mini.string(...args)),
  union: (...args: Parameters<typeof mini.union>) => decorate(mini.union(...args)),
  unknown: (...args: Parameters<typeof mini.unknown>) => decorate(mini.unknown(...args)),
  url: (...args: Parameters<typeof mini.url>) => decorate(mini.url(...args)),
  iso: {
    date: (...args: Parameters<typeof mini.iso.date>) => decorate(mini.iso.date(...args)),
    datetime: (...args: Parameters<typeof mini.iso.datetime>) =>
      decorate(mini.iso.datetime(...args)),
  },
};

export const z = wrapped as unknown as typeof classic;
export const ZodError = mini.core.$ZodError;
export type Infer<T extends classic.ZodType> = classic.infer<T>;
