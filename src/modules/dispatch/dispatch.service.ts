import mongoose from "mongoose";
import {
  ACTIVE_CLIENT_DISPATCH_STATUSES,
  CLIENT_CANCELLABLE_DISPATCH_STATUSES,
  AmbulanceDispatchRequest,
  type AmbulanceDispatchRequestDocument,
  type DispatchStatus,
} from "../../models/ambulanceDispatchRequest.model";
import { Service } from "../../models/service.model";
import { ServiceProvider } from "../../models/serviceProvider.model";
import { User } from "../../models/user.model";
import { NotificationService } from "../notifications/notification.service";
import { NotificationTemplates } from "../notifications/notification-templates";
import {
  GoogleGeocodingError,
  geocodeAddress,
  reverseGeocode,
} from "./google-geocoding.service";
import { GoogleRoutesError, computeDrivingRoute } from "./google-routes.service";
import {
  GROUND_AMBULANCE_DEPARTMENT_SLUG,
  findNearestAmbulance,
  getDispatchLocationStaleMs,
  getDispatchOfferTimeoutMs,
  type NearestAmbulanceCandidate,
} from "./nearest-ambulance.service";

function getDispatchMaxRequestsPerHour(): number {
  const raw = process.env.DISPATCH_MAX_REQUESTS_PER_HOUR;
  const parsed = raw ? Number.parseInt(raw, 10) : 5;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

export class DispatchHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DispatchHttpError";
  }
}

export type CreateDispatchRequestInput = {
  locationSource: "current_location" | "address";
  latitude?: number;
  longitude?: number;
  address?: string;
  notes?: string;
  contactPhone?: string;
};

export type DispatchRequestDto = {
  id: string;
  status: DispatchStatus;
  pickup: { lat: number; lng: number; address: string | null };
  contactPhone: string | null;
  clientNotes: string | null;
  assignedService?: {
    id: string;
    title: string;
    providerName: string;
  };
  offerExpiresAt?: string;
  ambulanceLocation?: { lat: number; lng: number; updatedAt: string };
  route?: {
    polyline: string;
    distanceMeters: number;
    durationSeconds: number;
  };
  attempts: number;
  createdAt: string;
  acceptedAt?: string | null;
  arrivedAt?: string | null;
};

function pointFromLngLat(lng: number, lat: number) {
  return { type: "Point" as const, coordinates: [lng, lat] as [number, number] };
}

function hasValidLiveLocation(
  location?: { coordinates?: number[] | null } | null,
): boolean {
  const coords = location?.coordinates;
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    Number.isFinite(coords[0]) &&
    Number.isFinite(coords[1])
  );
}

function coordsFromPoint(
  point?: { coordinates?: number[] | null } | null,
): { lat: number; lng: number } | null {
  if (!point?.coordinates || point.coordinates.length < 2) {
    return null;
  }
  return { lng: point.coordinates[0]!, lat: point.coordinates[1]! };
}

async function mapDispatchRequest(
  doc: AmbulanceDispatchRequestDocument | Record<string, unknown>,
  options: { includeOfferExpiry?: boolean } = {},
): Promise<DispatchRequestDto> {
  const d = doc as AmbulanceDispatchRequestDocument;
  const pickupCoords = coordsFromPoint(d.pickupLocation);
  const ambulanceCoords = coordsFromPoint(d.ambulanceLiveLocation);

  let assignedService: DispatchRequestDto["assignedService"];
  if (d.assignedServiceId) {
    const service = await Service.findById(d.assignedServiceId)
      .select("title userId")
      .lean();
    let providerName = "Provider";
    if (service?.userId) {
      const provider = await ServiceProvider.findOne({ userId: service.userId })
        .select("businessName")
        .lean();
      providerName = provider?.businessName ?? providerName;
    }
    assignedService = {
      id: d.assignedServiceId.toString(),
      title: service?.title ?? "Ambulance",
      providerName,
    };
  }

  const dto: DispatchRequestDto = {
    id: d._id.toString(),
    status: d.status,
    pickup: {
      lat: pickupCoords?.lat ?? 0,
      lng: pickupCoords?.lng ?? 0,
      address: d.pickupAddress ?? null,
    },
    contactPhone: d.contactPhone?.trim() || null,
    clientNotes: d.clientNotes ?? null,
    assignedService,
    attempts: d.attempts?.length ?? 0,
    createdAt: d.createdAt.toISOString(),
    acceptedAt: d.acceptedAt ? d.acceptedAt.toISOString() : null,
    arrivedAt: d.arrivedAt ? d.arrivedAt.toISOString() : null,
  };

  if (
    options.includeOfferExpiry !== false &&
    d.status === "offered" &&
    d.currentOfferExpiresAt
  ) {
    dto.offerExpiresAt = d.currentOfferExpiresAt.toISOString();
  }

  if (ambulanceCoords && d.ambulanceLiveLocationUpdatedAt) {
    dto.ambulanceLocation = {
      lat: ambulanceCoords.lat,
      lng: ambulanceCoords.lng,
      updatedAt: d.ambulanceLiveLocationUpdatedAt.toISOString(),
    };
  }

  if (d.routePolyline) {
    dto.route = {
      polyline: d.routePolyline,
      distanceMeters: d.routeDistanceMeters ?? 0,
      durationSeconds: d.routeDurationSeconds ?? 0,
    };
  }

  return dto;
}

async function assertClientRole(userId: string): Promise<void> {
  const user = await User.findById(userId).select("role").lean();
  if (!user || user.role !== "client") {
    throw new DispatchHttpError(403, "Only clients can perform this action");
  }
}

async function assertProviderRole(userId: string): Promise<void> {
  const user = await User.findById(userId).select("role").lean();
  if (!user || user.role !== "service_provider") {
    throw new DispatchHttpError(403, "Only providers can perform this action");
  }
}

async function assertDispatchRole(userId: string): Promise<{
  assignedServiceId: string;
  ownerProviderUserId: string;
}> {
  const user = await User.findById(userId)
    .select("role assignedServiceId ownerProviderUserId isDisabled")
    .lean();
  if (!user || user.role !== "dispatch") {
    throw new DispatchHttpError(403, "Only dispatch accounts can perform this action");
  }
  if (user.isDisabled) {
    throw new DispatchHttpError(403, "This dispatch account is disabled");
  }
  if (!user.assignedServiceId || !user.ownerProviderUserId) {
    throw new DispatchHttpError(400, "Dispatch account is not linked to a listing");
  }
  return {
    assignedServiceId: user.assignedServiceId.toString(),
    ownerProviderUserId: user.ownerProviderUserId.toString(),
  };
}

async function notifyOwnerDispatchStatus(
  ownerProviderUserId: string,
  requestId: string,
  title: string,
  body: string,
): Promise<void> {
  await NotificationService.send(
    ownerProviderUserId,
    NotificationTemplates.general({
      title,
      body,
      deepLink: `/provider/dispatch/requests/${encodeURIComponent(requestId)}`,
      entityId: requestId,
    }),
  );
}

async function assertRateLimit(clientUserId: string): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  // Only in-flight matching counts — completed, failed, or dismissed requests
  // must not block the client from requesting again.
  const count = await AmbulanceDispatchRequest.countDocuments({
    clientUserId: new mongoose.Types.ObjectId(clientUserId),
    createdAt: { $gte: oneHourAgo },
    status: { $in: ["searching", "offered"] },
  });
  if (count >= getDispatchMaxRequestsPerHour()) {
    throw new DispatchHttpError(
      429,
      "Too many dispatch requests. Please wait before trying again.",
    );
  }
}

async function resolvePickupLocation(
  input: CreateDispatchRequestInput,
): Promise<{ lat: number; lng: number; address: string | null }> {
  if (input.locationSource === "address") {
    const address = input.address?.trim();
    if (!address) {
      throw new DispatchHttpError(400, "Address is required");
    }
    const geocoded = await geocodeAddress(address);
    return {
      lat: geocoded.lat,
      lng: geocoded.lng,
      address: geocoded.formattedAddress,
    };
  }

  const lat = input.latitude;
  const lng = input.longitude;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new DispatchHttpError(400, "Valid latitude and longitude are required");
  }

  const formatted = await reverseGeocode(lat, lng);
  return { lat, lng, address: formatted };
}

function excludedServiceIds(
  attempts: { serviceId: mongoose.Types.ObjectId; outcome: string }[],
): string[] {
  return attempts.map((a) => a.serviceId.toString());
}

async function notifyDispatchOfOffer(
  requestId: string,
  candidate: NearestAmbulanceCandidate,
  pickupAddress: string | null,
): Promise<void> {
  await NotificationService.send(
    candidate.dispatchUserId,
    NotificationTemplates.ambulanceRequest({
      requestId,
      pickupAddress,
      distanceKm: candidate.distanceMeters / 1000,
    }),
  );
}

async function offerToNearestAmbulance(
  request: AmbulanceDispatchRequestDocument,
): Promise<boolean> {
  const pickupCoords = coordsFromPoint(request.pickupLocation);
  if (!pickupCoords) {
    throw new DispatchHttpError(500, "Invalid pickup location on request");
  }

  const excludeIds = excludedServiceIds(request.attempts ?? []);
  const candidate = await findNearestAmbulance(
    pickupCoords.lng,
    pickupCoords.lat,
    excludeIds,
  );

  if (!candidate) {
    request.status = "no_provider";
    request.currentOfferExpiresAt = undefined;
    request.assignedServiceId = undefined;
    request.assignedProviderUserId = undefined;
    request.assignedDispatchUserId = undefined;
    await request.save();

    await NotificationService.send(
      request.clientUserId.toString(),
      NotificationTemplates.noAmbulanceAvailable({
        requestId: request._id.toString(),
      }),
    );
    return false;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + getDispatchOfferTimeoutMs());

  request.status = "offered";
  request.assignedServiceId = new mongoose.Types.ObjectId(candidate.serviceId);
  request.assignedProviderUserId = new mongoose.Types.ObjectId(
    candidate.providerUserId,
  );
  request.assignedDispatchUserId = new mongoose.Types.ObjectId(
    candidate.dispatchUserId,
  );
  request.currentOfferExpiresAt = expiresAt;
  request.attempts.push({
    serviceId: new mongoose.Types.ObjectId(candidate.serviceId),
    providerUserId: new mongoose.Types.ObjectId(candidate.providerUserId),
    dispatchUserId: new mongoose.Types.ObjectId(candidate.dispatchUserId),
    offeredAt: now,
    expiresAt,
    outcome: "pending",
    distanceMeters: candidate.distanceMeters,
  });
  await request.save();

  await notifyDispatchOfOffer(
    request._id.toString(),
    candidate,
    request.pickupAddress ?? null,
  );

  return true;
}

export async function createDispatchRequest(
  clientUserId: string,
  input: CreateDispatchRequestInput,
): Promise<DispatchRequestDto> {
  await assertClientRole(clientUserId);
  await assertRateLimit(clientUserId);

  const existing = await AmbulanceDispatchRequest.findOne({
    clientUserId: new mongoose.Types.ObjectId(clientUserId),
    status: { $in: ACTIVE_CLIENT_DISPATCH_STATUSES },
  }).lean();

  if (existing) {
    throw new DispatchHttpError(409, "You already have an active dispatch request", {
      requestId: existing._id.toString(),
    });
  }

  let pickup: { lat: number; lng: number; address: string | null };
  try {
    pickup = await resolvePickupLocation(input);
  } catch (err) {
    if (err instanceof GoogleGeocodingError) {
      throw new DispatchHttpError(err.statusCode, err.message);
    }
    throw err;
  }

  const notes = input.notes?.trim().slice(0, 1000) ?? null;

  let contactPhone = input.contactPhone?.trim().slice(0, 32) ?? "";
  if (!contactPhone) {
    const client = await User.findById(clientUserId).select("phone").lean();
    contactPhone = client?.phone?.trim().slice(0, 32) ?? "";
  }
  if (!contactPhone) {
    throw new DispatchHttpError(
      400,
      "A contact phone number is required for dispatch",
    );
  }

  const request = await AmbulanceDispatchRequest.create({
    clientUserId: new mongoose.Types.ObjectId(clientUserId),
    status: "searching",
    locationSource: input.locationSource,
    pickupAddress: pickup.address,
    pickupLocation: pointFromLngLat(pickup.lng, pickup.lat),
    contactPhone,
    clientNotes: notes,
    attempts: [],
  });

  await offerToNearestAmbulance(request);

  const refreshed = await AmbulanceDispatchRequest.findById(request._id);
  if (!refreshed) {
    throw new DispatchHttpError(500, "Failed to create dispatch request");
  }
  return mapDispatchRequest(refreshed);
}

export async function getDispatchRequestById(
  userId: string,
  role: string,
  requestId: string,
): Promise<DispatchRequestDto> {
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw new DispatchHttpError(400, "Invalid request id");
  }

  const request = await AmbulanceDispatchRequest.findById(requestId);
  if (!request) {
    throw new DispatchHttpError(404, "Dispatch request not found");
  }

  const isClient = request.clientUserId.toString() === userId;
  const isAssignedProvider =
    request.assignedProviderUserId?.toString() === userId;
  const isAssignedDispatch =
    request.assignedDispatchUserId?.toString() === userId;

  if (role === "client" && !isClient) {
    throw new DispatchHttpError(403, "Forbidden");
  }
  if (role === "service_provider" && !isAssignedProvider) {
    // Owner can also view requests for any of their listings via attempt history
    const ownsAttempt = (request.attempts ?? []).some(
      (a) => a.providerUserId.toString() === userId,
    );
    if (!ownsAttempt) {
      throw new DispatchHttpError(403, "Forbidden");
    }
  }
  if (role === "dispatch" && !isAssignedDispatch) {
    throw new DispatchHttpError(403, "Forbidden");
  }
  if (
    role !== "client" &&
    role !== "service_provider" &&
    role !== "dispatch" &&
    role !== "admin"
  ) {
    throw new DispatchHttpError(403, "Forbidden");
  }

  return mapDispatchRequest(request);
}

export async function getActiveClientDispatchRequest(
  clientUserId: string,
): Promise<DispatchRequestDto | null> {
  await assertClientRole(clientUserId);

  const request = await AmbulanceDispatchRequest.findOne({
    clientUserId: new mongoose.Types.ObjectId(clientUserId),
    status: { $in: ACTIVE_CLIENT_DISPATCH_STATUSES },
  }).sort({ createdAt: -1 });

  if (!request) {
    return null;
  }
  return mapDispatchRequest(request);
}

export async function getClientDispatchHistory(
  clientUserId: string,
): Promise<DispatchRequestDto[]> {
  await assertClientRole(clientUserId);

  const requests = await AmbulanceDispatchRequest.find({
    clientUserId: new mongoose.Types.ObjectId(clientUserId),
  })
    .sort({ createdAt: -1 })
    .limit(50);

  return Promise.all(requests.map((r) => mapDispatchRequest(r)));
}

export async function getProviderPendingOffer(
  providerUserId: string,
): Promise<DispatchRequestDto | null> {
  await assertProviderRole(providerUserId);

  const request = await AmbulanceDispatchRequest.findOne({
    assignedProviderUserId: new mongoose.Types.ObjectId(providerUserId),
    status: "offered",
    currentOfferExpiresAt: { $gt: new Date() },
  }).sort({ currentOfferExpiresAt: 1 });

  // Providers no longer receive offers — monitoring only.
  return null;
}

export async function getDispatchUserPendingOffer(
  dispatchUserId: string,
): Promise<DispatchRequestDto | null> {
  await assertDispatchRole(dispatchUserId);

  const request = await AmbulanceDispatchRequest.findOne({
    assignedDispatchUserId: new mongoose.Types.ObjectId(dispatchUserId),
    status: "offered",
    currentOfferExpiresAt: { $gt: new Date() },
  }).sort({ currentOfferExpiresAt: 1 });

  if (!request) {
    return null;
  }
  return mapDispatchRequest(request);
}

export async function getDispatchUserRequests(
  dispatchUserId: string,
): Promise<DispatchRequestDto[]> {
  await assertDispatchRole(dispatchUserId);

  const requests = await AmbulanceDispatchRequest.find({
    $or: [
      { assignedDispatchUserId: new mongoose.Types.ObjectId(dispatchUserId) },
      { "attempts.dispatchUserId": new mongoose.Types.ObjectId(dispatchUserId) },
    ],
  })
    .sort({ updatedAt: -1 })
    .limit(50);

  return Promise.all(requests.map((r) => mapDispatchRequest(r)));
}

export async function getProviderDispatchRequests(
  providerUserId: string,
): Promise<DispatchRequestDto[]> {
  await assertProviderRole(providerUserId);

  const requests = await AmbulanceDispatchRequest.find({
    assignedProviderUserId: new mongoose.Types.ObjectId(providerUserId),
  })
    .sort({ updatedAt: -1 })
    .limit(50);

  return Promise.all(requests.map((r) => mapDispatchRequest(r)));
}

export async function acceptDispatchRequest(
  dispatchUserId: string,
  requestId: string,
): Promise<DispatchRequestDto> {
  await assertDispatchRole(dispatchUserId);

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw new DispatchHttpError(400, "Invalid request id");
  }

  const now = new Date();
  const request = await AmbulanceDispatchRequest.findOne({
    _id: new mongoose.Types.ObjectId(requestId),
    assignedDispatchUserId: new mongoose.Types.ObjectId(dispatchUserId),
    status: "offered",
    currentOfferExpiresAt: { $gt: now },
  });

  if (!request) {
    throw new DispatchHttpError(409, "Offer expired or not found");
  }

  const service = await Service.findById(request.assignedServiceId).lean();
  if (!service?.liveLocation?.coordinates) {
    throw new DispatchHttpError(400, "Ambulance location unavailable");
  }

  const ambulanceCoords = coordsFromPoint(service.liveLocation);
  const pickupCoords = coordsFromPoint(request.pickupLocation);
  if (!ambulanceCoords || !pickupCoords) {
    throw new DispatchHttpError(500, "Invalid coordinates");
  }

  let route;
  try {
    route = await computeDrivingRoute(ambulanceCoords, pickupCoords);
  } catch (err) {
    if (err instanceof GoogleRoutesError) {
      throw new DispatchHttpError(err.statusCode, err.message);
    }
    throw err;
  }

  const pendingAttempt = request.attempts.find(
    (a) =>
      a.serviceId.toString() === request.assignedServiceId?.toString() &&
      a.outcome === "pending",
  );
  if (pendingAttempt) {
    pendingAttempt.outcome = "accepted";
  }

  request.status = "accepted";
  request.acceptedAt = now;
  request.currentOfferExpiresAt = undefined;
  request.routePolyline = route.polyline;
  request.routeDistanceMeters = route.distanceMeters;
  request.routeDurationSeconds = route.durationSeconds;
  request.ambulanceLiveLocation = pointFromLngLat(
    ambulanceCoords.lng,
    ambulanceCoords.lat,
  );
  request.ambulanceLiveLocationUpdatedAt = service.liveLocationUpdatedAt ?? now;
  await request.save();

  await NotificationService.send(
    request.clientUserId.toString(),
    NotificationTemplates.ambulanceAccepted({ requestId: request._id.toString() }),
  );

  if (request.assignedProviderUserId) {
    await notifyOwnerDispatchStatus(
      request.assignedProviderUserId.toString(),
      request._id.toString(),
      "Dispatch accepted",
      `${service.title} accepted an ambulance request.`,
    );
  }

  return mapDispatchRequest(request);
}

export async function rejectDispatchRequest(
  dispatchUserId: string,
  requestId: string,
): Promise<DispatchRequestDto> {
  await assertDispatchRole(dispatchUserId);

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw new DispatchHttpError(400, "Invalid request id");
  }

  const request = await AmbulanceDispatchRequest.findOne({
    _id: new mongoose.Types.ObjectId(requestId),
    assignedDispatchUserId: new mongoose.Types.ObjectId(dispatchUserId),
    status: "offered",
  });

  if (!request) {
    throw new DispatchHttpError(404, "Offer not found");
  }

  const ownerId = request.assignedProviderUserId?.toString();
  const serviceId = request.assignedServiceId?.toString();

  const pendingAttempt = request.attempts.find(
    (a) =>
      a.serviceId.toString() === request.assignedServiceId?.toString() &&
      a.outcome === "pending",
  );
  if (pendingAttempt) {
    pendingAttempt.outcome = "rejected";
  }

  request.assignedServiceId = undefined;
  request.assignedProviderUserId = undefined;
  request.assignedDispatchUserId = undefined;
  request.currentOfferExpiresAt = undefined;
  request.status = "searching";
  await request.save();

  if (ownerId) {
    const service = serviceId
      ? await Service.findById(serviceId).select("title").lean()
      : null;
    await notifyOwnerDispatchStatus(
      ownerId,
      request._id.toString(),
      "Dispatch declined",
      `${service?.title ?? "A unit"} declined an ambulance request.`,
    );
  }

  await offerToNearestAmbulance(request);

  const refreshed = await AmbulanceDispatchRequest.findById(request._id);
  if (!refreshed) {
    throw new DispatchHttpError(500, "Request not found after reject");
  }
  return mapDispatchRequest(refreshed);
}

export async function cancelDispatchRequest(
  clientUserId: string,
  requestId: string,
): Promise<DispatchRequestDto> {
  await assertClientRole(clientUserId);

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw new DispatchHttpError(400, "Invalid request id");
  }

  const request = await AmbulanceDispatchRequest.findOne({
    _id: new mongoose.Types.ObjectId(requestId),
    clientUserId: new mongoose.Types.ObjectId(clientUserId),
    status: { $in: CLIENT_CANCELLABLE_DISPATCH_STATUSES },
  });

  if (!request) {
    throw new DispatchHttpError(404, "Dispatch request not found or cannot be cancelled");
  }

  if (request.status === "en_route") {
    throw new DispatchHttpError(
      400,
      "Cannot cancel after the ambulance is en route",
    );
  }

  const providerUserId = request.assignedProviderUserId?.toString();
  const dispatchUserId = request.assignedDispatchUserId?.toString();

  if (request.status === "offered") {
    const pendingAttempt = request.attempts.find((a) => a.outcome === "pending");
    if (pendingAttempt) {
      pendingAttempt.outcome = "rejected";
    }
  }

  request.status = "cancelled";
  request.cancelledAt = new Date();
  request.currentOfferExpiresAt = undefined;
  await request.save();

  if (dispatchUserId) {
    await NotificationService.send(
      dispatchUserId,
      NotificationTemplates.dispatchCancelled({
        requestId: request._id.toString(),
      }),
    );
  }
  if (providerUserId) {
    await notifyOwnerDispatchStatus(
      providerUserId,
      request._id.toString(),
      "Dispatch cancelled",
      "A client cancelled an ambulance request for your fleet.",
    );
  }

  return mapDispatchRequest(request);
}

export async function markDispatchArrived(
  dispatchUserId: string,
  requestId: string,
): Promise<DispatchRequestDto> {
  await assertDispatchRole(dispatchUserId);

  const request = await AmbulanceDispatchRequest.findOne({
    _id: new mongoose.Types.ObjectId(requestId),
    assignedDispatchUserId: new mongoose.Types.ObjectId(dispatchUserId),
    status: { $in: ["accepted", "en_route"] },
  });

  if (!request) {
    throw new DispatchHttpError(404, "Active dispatch not found");
  }

  request.status = "arrived";
  request.arrivedAt = new Date();
  await request.save();

  await NotificationService.send(
    request.clientUserId.toString(),
    NotificationTemplates.ambulanceArrived({ requestId: request._id.toString() }),
  );

  if (request.assignedProviderUserId) {
    await notifyOwnerDispatchStatus(
      request.assignedProviderUserId.toString(),
      request._id.toString(),
      "Ambulance arrived",
      "A dispatch unit marked arrival at the pickup location.",
    );
  }

  return mapDispatchRequest(request);
}

export async function updateServiceDispatchStatus(
  dispatchUserId: string,
  serviceId: string,
  dispatchEnabled: boolean,
  location?: { latitude: number; longitude: number },
): Promise<{ serviceId: string; dispatchEnabled: boolean }> {
  const profile = await assertDispatchRole(dispatchUserId);

  if (!mongoose.Types.ObjectId.isValid(serviceId)) {
    throw new DispatchHttpError(400, "Invalid service id");
  }
  if (profile.assignedServiceId !== serviceId) {
    throw new DispatchHttpError(403, "You can only control your linked ambulance");
  }

  const service = await Service.findOne({
    _id: new mongoose.Types.ObjectId(serviceId),
    dispatchUserId: new mongoose.Types.ObjectId(dispatchUserId),
    departmentSlug: GROUND_AMBULANCE_DEPARTMENT_SLUG,
  });

  if (!service) {
    throw new DispatchHttpError(
      404,
      "Ground ambulance listing not found for this dispatch account",
    );
  }

  if (service.isAvailable === false) {
    throw new DispatchHttpError(
      403,
      "This listing is unavailable. Contact your service provider.",
    );
  }

  const update: mongoose.UpdateQuery<typeof service> = {
    $set: { dispatchEnabled },
  };

  if (!dispatchEnabled) {
    update.$set!.liveLocationUpdatedAt = null;
    update.$unset = { liveLocation: 1 };
  } else {
    const hasIncomingLocation =
      location != null &&
      Number.isFinite(location.latitude) &&
      Number.isFinite(location.longitude) &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      location.longitude >= -180 &&
      location.longitude <= 180;

    const staleBefore = new Date(Date.now() - getDispatchLocationStaleMs());
    const hasFreshExistingLocation =
      hasValidLiveLocation(service.liveLocation) &&
      service.liveLocationUpdatedAt != null &&
      service.liveLocationUpdatedAt >= staleBefore;

    if (!hasIncomingLocation && !hasFreshExistingLocation) {
      throw new DispatchHttpError(
        400,
        "Current location is required to go on duty. Enable location access and try again.",
      );
    }

    if (hasIncomingLocation) {
      const now = new Date();
      update.$set!.liveLocation = pointFromLngLat(
        location!.longitude,
        location!.latitude,
      );
      update.$set!.liveLocationUpdatedAt = now;
    }
  }

  await Service.updateOne({ _id: service._id }, update);

  return { serviceId: service._id.toString(), dispatchEnabled };
}

export async function updateServiceLiveLocation(
  dispatchUserId: string,
  serviceId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  const profile = await assertDispatchRole(dispatchUserId);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new DispatchHttpError(400, "Valid latitude and longitude are required");
  }

  if (profile.assignedServiceId !== serviceId) {
    throw new DispatchHttpError(403, "You can only update your linked ambulance");
  }

  const service = await Service.findOne({
    _id: new mongoose.Types.ObjectId(serviceId),
    dispatchUserId: new mongoose.Types.ObjectId(dispatchUserId),
    departmentSlug: GROUND_AMBULANCE_DEPARTMENT_SLUG,
    dispatchEnabled: true,
  });

  if (!service) {
    throw new DispatchHttpError(
      404,
      "On-duty ground ambulance listing not found",
    );
  }

  const now = new Date();
  service.liveLocation = pointFromLngLat(longitude, latitude);
  service.liveLocationUpdatedAt = now;
  await service.save();

  const activeRequest = await AmbulanceDispatchRequest.findOne({
    assignedServiceId: service._id,
    status: { $in: ["accepted", "en_route"] },
  });

  if (!activeRequest) {
    return;
  }

  const wasAccepted = activeRequest.status === "accepted";
  activeRequest.ambulanceLiveLocation = pointFromLngLat(longitude, latitude);
  activeRequest.ambulanceLiveLocationUpdatedAt = now;

  if (wasAccepted) {
    activeRequest.status = "en_route";
    await activeRequest.save();
    await NotificationService.send(
      activeRequest.clientUserId.toString(),
      NotificationTemplates.ambulanceEnRoute({
        requestId: activeRequest._id.toString(),
      }),
    );
    return;
  }

  await activeRequest.save();
}

export async function listDispatchUserServices(
  dispatchUserId: string,
): Promise<
  {
    id: string;
    title: string;
    dispatchEnabled: boolean;
    liveLocationUpdatedAt: string | null;
  }[]
> {
  const profile = await assertDispatchRole(dispatchUserId);
  const service = await Service.findById(profile.assignedServiceId)
    .select("title dispatchEnabled liveLocationUpdatedAt")
    .lean();
  if (!service) {
    return [];
  }
  return [
    {
      id: service._id.toString(),
      title: service.title,
      dispatchEnabled: Boolean(service.dispatchEnabled),
      liveLocationUpdatedAt: service.liveLocationUpdatedAt
        ? service.liveLocationUpdatedAt.toISOString()
        : null,
    },
  ];
}

export async function listProviderDispatchServices(
  providerUserId: string,
): Promise<
  {
    id: string;
    title: string;
    dispatchEnabled: boolean;
    liveLocationUpdatedAt: string | null;
    dispatchUserId: string | null;
    hasDispatchAccount: boolean;
  }[]
> {
  await assertProviderRole(providerUserId);

  const services = await Service.find({
    userId: new mongoose.Types.ObjectId(providerUserId),
    departmentSlug: GROUND_AMBULANCE_DEPARTMENT_SLUG,
  })
    .select("title dispatchEnabled liveLocationUpdatedAt dispatchUserId")
    .sort({ createdAt: -1 })
    .lean();

  return services.map((s) => ({
    id: s._id.toString(),
    title: s.title,
    dispatchEnabled: Boolean(s.dispatchEnabled),
    liveLocationUpdatedAt: s.liveLocationUpdatedAt
      ? s.liveLocationUpdatedAt.toISOString()
      : null,
    dispatchUserId: s.dispatchUserId ? s.dispatchUserId.toString() : null,
    hasDispatchAccount: Boolean(s.dispatchUserId),
  }));
}

export async function processExpiredDispatchOffers(): Promise<number> {
  const now = new Date();
  const expired = await AmbulanceDispatchRequest.find({
    status: "offered",
    currentOfferExpiresAt: { $lte: now },
  }).limit(20);

  let processed = 0;
  for (const request of expired) {
    const pendingAttempt = request.attempts.find((a) => a.outcome === "pending");
    if (pendingAttempt) {
      pendingAttempt.outcome = "timeout";
    }

    const ownerId = request.assignedProviderUserId?.toString();
    const serviceId = request.assignedServiceId?.toString();

    request.assignedServiceId = undefined;
    request.assignedProviderUserId = undefined;
    request.assignedDispatchUserId = undefined;
    request.currentOfferExpiresAt = undefined;
    request.status = "searching";
    await request.save();

    if (ownerId) {
      const service = serviceId
        ? await Service.findById(serviceId).select("title").lean()
        : null;
      await notifyOwnerDispatchStatus(
        ownerId,
        request._id.toString(),
        "Dispatch offer timed out",
        `${service?.title ?? "A unit"} did not respond in time.`,
      );
    }

    await offerToNearestAmbulance(request);
    processed += 1;
  }

  return processed;
}

export async function getDispatchRoute(
  userId: string,
  role: string,
  requestId: string,
): Promise<NonNullable<DispatchRequestDto["route"]>> {
  const dto = await getDispatchRequestById(userId, role, requestId);
  if (!dto.route) {
    throw new DispatchHttpError(404, "Route not available for this request");
  }
  return dto.route;
}
