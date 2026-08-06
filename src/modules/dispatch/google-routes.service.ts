import { logger } from "../../shared/lib/logger";

export class GoogleRoutesError extends Error {
  constructor(
    message: string,
    public statusCode = 502,
  ) {
    super(message);
    this.name = "GoogleRoutesError";
  }
}

export type RouteResult = {
  polyline: string;
  distanceMeters: number;
  durationSeconds: number;
};

function getServerApiKey(): string {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  if (!key) {
    throw new GoogleRoutesError(
      "Google Maps server API key is not configured",
      503,
    );
  }
  return key;
}

export async function computeDrivingRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<RouteResult> {
  const key = getServerApiKey();

  const res = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: { latitude: origin.lat, longitude: origin.lng },
          },
        },
        destination: {
          location: {
            latLng: { latitude: destination.lat, longitude: destination.lng },
          },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    logger.error("Routes API HTTP error", { status: res.status, body: text });
    throw new GoogleRoutesError("Route computation service unavailable");
  }

  const data = (await res.json()) as {
    routes?: {
      distanceMeters?: number;
      duration?: string;
      polyline?: { encodedPolyline?: string };
    }[];
    error?: { message?: string };
  };

  const route = data.routes?.[0];
  if (!route?.polyline?.encodedPolyline) {
    logger.warn("Routes API returned no route", { error: data.error });
    throw new GoogleRoutesError("No driving route found", 404);
  }

  const durationSeconds = parseDurationSeconds(route.duration);

  return {
    polyline: route.polyline.encodedPolyline,
    distanceMeters: route.distanceMeters ?? 0,
    durationSeconds,
  };
}

function parseDurationSeconds(duration: string | undefined): number {
  if (!duration) {
    return 0;
  }
  const match = duration.match(/^(\d+)s$/);
  if (match?.[1]) {
    return Number.parseInt(match[1], 10);
  }
  return 0;
}
