import { logger } from "../../shared/lib/logger";

export class GoogleGeocodingError extends Error {
  constructor(
    message: string,
    public statusCode = 502,
  ) {
    super(message);
    this.name = "GoogleGeocodingError";
  }
}

export type GeocodedLocation = {
  lat: number;
  lng: number;
  formattedAddress: string;
};

function getServerApiKey(): string {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  if (!key) {
    throw new GoogleGeocodingError(
      "Google Maps server API key is not configured",
      503,
    );
  }
  return key;
}

export async function geocodeAddress(
  address: string,
  options?: { countryCode?: string },
): Promise<GeocodedLocation> {
  const trimmed = address.trim();
  if (!trimmed) {
    throw new GoogleGeocodingError("Address is required", 400);
  }

  const key = getServerApiKey();
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", trimmed);
  const countryCode = options?.countryCode?.trim().toUpperCase() ?? "NG";
  if (countryCode) {
    url.searchParams.set("components", `country:${countryCode}`);
  }
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  if (!res.ok) {
    logger.error("Geocoding API HTTP error", { status: res.status });
    throw new GoogleGeocodingError("Geocoding service unavailable");
  }

  const data = (await res.json()) as {
    status: string;
    results?: {
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }[];
    error_message?: string;
  };

  if (data.status !== "OK" || !data.results?.[0]) {
    logger.warn("Geocoding failed", {
      status: data.status,
      error: data.error_message,
    });
    throw new GoogleGeocodingError(
      data.status === "ZERO_RESULTS"
        ? "Could not find that address"
        : "Geocoding failed",
      data.status === "ZERO_RESULTS" ? 400 : 502,
    );
  }

  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  };
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  const key = getServerApiKey();
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as {
    status: string;
    results?: { formatted_address: string }[];
  };

  if (data.status !== "OK" || !data.results?.[0]) {
    return null;
  }

  return data.results[0].formatted_address;
}
