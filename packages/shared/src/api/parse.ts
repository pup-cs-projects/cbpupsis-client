import { isRecord } from "./client";
import { ApiError } from "./errors";

// Small narrowing helpers for parsing responses at the boundary. Each throws INVALID_RESPONSE,
// so a contract drift surfaces as one clear error instead of `undefined` in a component.

export function invalid(): never {
  throw new ApiError(0, "INVALID_RESPONSE");
}

export function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : invalid();
}

export function string(value: unknown): string {
  return typeof value === "string" && value.length > 0 ? value : invalid();
}

export function optionalString(value: unknown): string | null {
  return value === undefined || value === null ? null : string(value);
}

export function boolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : invalid();
}

export function positiveNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : invalid();
}

export function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : invalid();
}

export function literal<const T extends string>(value: unknown, expected: T): T {
  return value === expected ? expected : invalid();
}

export function oneOf<const T extends string>(value: unknown, allowed: readonly T[]): T {
  return allowed.includes(value as T) ? (value as T) : invalid();
}

export function nonEmptyArray(value: unknown): unknown[] {
  return Array.isArray(value) && value.length > 0 ? value : invalid();
}

export function stringArray(value: unknown): string[] {
  return nonEmptyArray(value).map(string);
}
