import mongoose from "mongoose";
import {
  ACTIVE_PROVIDER_DISPATCH_STATUSES,
  AmbulanceDispatchRequest,
} from "../../models/ambulanceDispatchRequest.model";
import { Service } from "../../models/service.model";
import { logger } from "../../shared/lib/logger";

export const GROUND_AMBULANCE_DEPARTMENT_SLUG = "ground-ambulance";

export type NearestAmbulanceCandidate = {
  serviceId: string;
  providerUserId: string;
  title: string;
  distanceMeters: number;
  lat: number;
  lng: number;
};

export function getDispatchOfferTimeoutMs(): number {
  const raw = process.env.DISPATCH_OFFER_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : 240_000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 240_000;
}

export function getDispatchLocationStaleMs(): number {
  const raw = process.env.DISPATCH_LOCATION_STALE_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : 300_000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300_000;
}

async function getBusyServiceIds(): Promise<mongoose.Types.ObjectId[]> {
  const busy = await AmbulanceDispatchRequest.find({
    status: { $in: ACTIVE_PROVIDER_DISPATCH_STATUSES },
    assignedServiceId: { $ne: null },
  })
    .select("assignedServiceId")
    .lean();

  return busy
    .map((row) => row.assignedServiceId)
    .filter((id): id is mongoose.Types.ObjectId => id != null);
}

async function logNoAmbulanceMatchDiagnostics(
  pickupLng: number,
  pickupLat: number,
  excludeServiceIds: string[],
  blockedIds: mongoose.Types.ObjectId[],
): Promise<void> {
  const staleBefore = new Date(Date.now() - getDispatchLocationStaleMs());
  const base = { departmentSlug: GROUND_AMBULANCE_DEPARTMENT_SLUG };

  const [
    totalGroundAmbulance,
    onDuty,
    withFreshLocation,
    available,
    eligibleExcludingBusy,
  ] = await Promise.all([
    Service.countDocuments(base),
    Service.countDocuments({ ...base, dispatchEnabled: true }),
    Service.countDocuments({
      ...base,
      dispatchEnabled: true,
      liveLocation: { $exists: true, $ne: null },
      liveLocationUpdatedAt: { $gte: staleBefore },
      "liveLocation.coordinates.0": { $exists: true },
    }),
    Service.countDocuments({ ...base, isAvailable: true }),
    Service.countDocuments({
      ...base,
      dispatchEnabled: true,
      isAvailable: true,
      liveLocation: { $exists: true, $ne: null },
      liveLocationUpdatedAt: { $gte: staleBefore },
      "liveLocation.coordinates.0": { $exists: true },
      ...(blockedIds.length > 0 ? { _id: { $nin: blockedIds } } : {}),
    }),
  ]);

  logger.info("Dispatch matching found no eligible ambulance", {
    pickupLng,
    pickupLat,
    totalGroundAmbulance,
    onDuty,
    withFreshLocation,
    available,
    eligibleExcludingBusy,
    blockedServiceCount: blockedIds.length,
    excludedAttemptCount: excludeServiceIds.length,
  });
}

export async function findNearestAmbulance(
  pickupLng: number,
  pickupLat: number,
  excludeServiceIds: string[] = [],
): Promise<NearestAmbulanceCandidate | null> {
  const staleBefore = new Date(Date.now() - getDispatchLocationStaleMs());
  const busyServiceIds = await getBusyServiceIds();

  const excludeObjectIds = excludeServiceIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const blockedIds = [...busyServiceIds, ...excludeObjectIds];

  const matchStage: Record<string, unknown> = {
    departmentSlug: GROUND_AMBULANCE_DEPARTMENT_SLUG,
    isAvailable: true,
    dispatchEnabled: true,
    liveLocation: { $exists: true, $ne: null },
    liveLocationUpdatedAt: { $gte: staleBefore },
    "liveLocation.coordinates.0": { $exists: true },
  };

  if (blockedIds.length > 0) {
    matchStage._id = { $nin: blockedIds };
  }

  const results = await Service.aggregate<{
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    title: string;
    liveLocation: { coordinates: [number, number] };
    distanceMeters: number;
  }>([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [pickupLng, pickupLat],
        },
        distanceField: "distanceMeters",
        spherical: true,
        key: "liveLocation",
        query: matchStage,
      },
    },
    { $limit: 1 },
    {
      $project: {
        userId: 1,
        title: 1,
        liveLocation: 1,
        distanceMeters: 1,
      },
    },
  ]);

  const candidate = results[0];
  if (!candidate) {
    await logNoAmbulanceMatchDiagnostics(
      pickupLng,
      pickupLat,
      excludeServiceIds,
      blockedIds,
    );
    return null;
  }

  const [lng, lat] = candidate.liveLocation.coordinates;

  return {
    serviceId: candidate._id.toString(),
    providerUserId: candidate.userId.toString(),
    title: candidate.title,
    distanceMeters: Math.round(candidate.distanceMeters),
    lat,
    lng,
  };
}
