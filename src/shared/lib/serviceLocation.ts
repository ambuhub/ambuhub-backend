import { State } from "country-state-city";
import { normalizeCountryCode } from "./countryCode";

const OFFICE_ADDRESS_MAX = 500;
const STATE_MANUAL_MAX = 120;

export type ServiceLocationInput = {
  countryCode?: unknown;
  stateProvince?: unknown;
  officeAddress?: unknown;
};

export type NormalizedServiceLocation = {
  countryCode: string;
  stateProvince: string;
  officeAddress: string;
};

export type StateOption = {
  code: string;
  name: string;
};

export function listStatesForCountry(countryCode: string): StateOption[] {
  const normalized = normalizeCountryCode(countryCode);
  if (!normalized) {
    return [];
  }
  return State.getStatesOfCountry(normalized)
    .map((s) => ({
      code: s.isoCode.trim(),
      name: s.name.trim(),
    }))
    .filter((s) => s.code && s.name)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function resolveStateProvinceName(
  countryCode: string | null | undefined,
  stateProvince: string | null | undefined,
): string | null {
  if (!countryCode || !stateProvince?.trim()) {
    return null;
  }
  const states = listStatesForCountry(countryCode);
  const code = stateProvince.trim();
  const match = states.find((s) => s.code === code);
  if (match) {
    return match.name;
  }
  if (states.length === 0) {
    return code;
  }
  return null;
}

function hasLocationInput(input: ServiceLocationInput): boolean {
  return (
    input.countryCode !== undefined ||
    input.stateProvince !== undefined ||
    input.officeAddress !== undefined
  );
}

function validateStateForCountry(
  countryCode: string,
  stateRaw: string,
): string {
  const trimmed = stateRaw.trim();
  if (!trimmed) {
    throw new Error("stateProvince is required");
  }
  const states = listStatesForCountry(countryCode);
  if (states.length === 0) {
    if (trimmed.length > STATE_MANUAL_MAX) {
      throw new Error(`stateProvince must be at most ${STATE_MANUAL_MAX} characters`);
    }
    return trimmed;
  }
  const match = states.find((s) => s.code === trimmed);
  if (!match) {
    throw new Error("stateProvince is not valid for the selected country");
  }
  return match.code;
}

/**
 * Normalizes service location fields. When requireLocation is true, all three are required.
 * When false, returns null if no location fields were sent; otherwise validates partial updates.
 */
export function normalizeServiceLocation(
  input: ServiceLocationInput,
  options: { requireLocation: boolean },
): NormalizedServiceLocation | null {
  const { requireLocation } = options;

  if (!requireLocation && !hasLocationInput(input)) {
    return null;
  }

  const countryRaw =
    input.countryCode === undefined || input.countryCode === null
      ? ""
      : String(input.countryCode);
  const stateRaw =
    input.stateProvince === undefined || input.stateProvince === null
      ? ""
      : String(input.stateProvince);
  const addressRaw =
    input.officeAddress === undefined || input.officeAddress === null
      ? ""
      : String(input.officeAddress);

  const countryCode = normalizeCountryCode(countryRaw);
  if (!countryCode) {
    throw new Error("countryCode must be a valid ISO 3166-1 alpha-2 code");
  }

  const stateProvince = validateStateForCountry(countryCode, stateRaw);

  const officeAddress = addressRaw.trim();
  if (!officeAddress) {
    throw new Error("officeAddress is required");
  }
  if (officeAddress.length > OFFICE_ADDRESS_MAX) {
    throw new Error(`officeAddress must be at most ${OFFICE_ADDRESS_MAX} characters`);
  }

  return { countryCode, stateProvince, officeAddress };
}
