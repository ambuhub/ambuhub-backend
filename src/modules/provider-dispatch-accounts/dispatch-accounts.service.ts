import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { Service } from "../../models/service.model";
import { User } from "../../models/user.model";
import { normalizeCountryCode } from "../../shared/lib/countryCode";
import { GROUND_AMBULANCE_DEPARTMENT_SLUG } from "../dispatch/nearest-ambulance.service";

const SALT_ROUNDS = 10;

export class ProviderDispatchAccountsHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ProviderDispatchAccountsHttpError";
  }
}

export type CreateDispatchAccountInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
  password: string;
  serviceId: string;
};

export type DispatchAccountDto = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
  isDisabled: boolean;
  assignedServiceId: string;
  listingTitle: string;
  dispatchEnabled: boolean;
  liveLocationUpdatedAt: string | null;
  isAvailable: boolean;
  activeRequestId: string | null;
  activeRequestStatus: string | null;
  lastAttemptOutcome: string | null;
};

export async function createDispatchAccount(
  providerUserId: string,
  input: CreateDispatchAccountInput,
): Promise<DispatchAccountDto> {
  const firstName = input.firstName?.trim() ?? "";
  const lastName = input.lastName?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  const phone = input.phone?.trim() ?? "";
  const password = input.password ?? "";
  const serviceId = input.serviceId?.trim() ?? "";

  if (!firstName || !lastName || !email || !phone || !serviceId) {
    throw new ProviderDispatchAccountsHttpError(400, "All fields are required");
  }
  if (password.length < 8) {
    throw new ProviderDispatchAccountsHttpError(
      400,
      "Password must be at least 8 characters",
    );
  }
  if (!mongoose.Types.ObjectId.isValid(serviceId)) {
    throw new ProviderDispatchAccountsHttpError(400, "Invalid service id");
  }

  const countryCode = normalizeCountryCode(input.countryCode);
  if (!countryCode) {
    throw new ProviderDispatchAccountsHttpError(
      400,
      "Country must be a valid ISO 3166-1 alpha-2 code",
    );
  }

  const service = await Service.findOne({
    _id: new mongoose.Types.ObjectId(serviceId),
    userId: new mongoose.Types.ObjectId(providerUserId),
    departmentSlug: GROUND_AMBULANCE_DEPARTMENT_SLUG,
  });

  if (!service) {
    throw new ProviderDispatchAccountsHttpError(
      404,
      "Ground ambulance listing not found for this provider",
    );
  }
  if (service.dispatchUserId) {
    throw new ProviderDispatchAccountsHttpError(
      409,
      "This listing is already linked to a dispatch account",
    );
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  let user;
  try {
    user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      countryCode,
      password: passwordHash,
      role: "dispatch",
      emailVerified: true,
      ownerProviderUserId: new mongoose.Types.ObjectId(providerUserId),
      assignedServiceId: service._id,
      isDisabled: service.isAvailable === false,
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      throw new ProviderDispatchAccountsHttpError(
        409,
        "An account with this email already exists",
      );
    }
    throw err;
  }

  service.dispatchUserId = user._id;
  await service.save();

  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    countryCode: user.countryCode,
    isDisabled: Boolean(user.isDisabled),
    assignedServiceId: service._id.toString(),
    listingTitle: service.title,
    dispatchEnabled: Boolean(service.dispatchEnabled),
    liveLocationUpdatedAt: service.liveLocationUpdatedAt
      ? service.liveLocationUpdatedAt.toISOString()
      : null,
    isAvailable: service.isAvailable !== false,
    activeRequestId: null,
    activeRequestStatus: null,
    lastAttemptOutcome: null,
  };
}

export async function listDispatchAccounts(
  providerUserId: string,
): Promise<DispatchAccountDto[]> {
  const users = await User.find({
    role: "dispatch",
    ownerProviderUserId: new mongoose.Types.ObjectId(providerUserId),
  })
    .sort({ createdAt: -1 })
    .lean();

  if (users.length === 0) {
    return [];
  }

  const serviceIds = users
    .map((u) => u.assignedServiceId)
    .filter((id): id is mongoose.Types.ObjectId => id != null);

  const services = await Service.find({ _id: { $in: serviceIds } })
    .select(
      "title dispatchEnabled liveLocationUpdatedAt isAvailable dispatchUserId",
    )
    .lean();
  const serviceById = new Map(services.map((s) => [s._id.toString(), s]));

  const { AmbulanceDispatchRequest } = await import(
    "../../models/ambulanceDispatchRequest.model"
  );

  const activeRequests = await AmbulanceDispatchRequest.find({
    assignedDispatchUserId: { $in: users.map((u) => u._id) },
    status: { $in: ["offered", "accepted", "en_route"] },
  })
    .select("_id status assignedDispatchUserId")
    .lean();

  const activeByDispatch = new Map(
    activeRequests.map((r) => [
      r.assignedDispatchUserId!.toString(),
      { id: r._id.toString(), status: r.status },
    ]),
  );

  const recent = await AmbulanceDispatchRequest.find({
    assignedProviderUserId: new mongoose.Types.ObjectId(providerUserId),
  })
    .select("attempts")
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  const lastOutcomeByDispatch = new Map<string, string>();
  for (const req of recent) {
    for (const attempt of [...(req.attempts ?? [])].reverse()) {
      const did = attempt.dispatchUserId?.toString();
      if (!did || lastOutcomeByDispatch.has(did)) continue;
      if (attempt.outcome && attempt.outcome !== "pending") {
        lastOutcomeByDispatch.set(did, attempt.outcome);
      }
    }
  }

  return users.map((u) => {
    const sid = u.assignedServiceId?.toString() ?? "";
    const service = serviceById.get(sid);
    const active = activeByDispatch.get(u._id.toString());
    return {
      id: u._id.toString(),
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      countryCode: u.countryCode,
      isDisabled: Boolean(u.isDisabled),
      assignedServiceId: sid,
      listingTitle: service?.title ?? "Unknown listing",
      dispatchEnabled: Boolean(service?.dispatchEnabled),
      liveLocationUpdatedAt: service?.liveLocationUpdatedAt
        ? service.liveLocationUpdatedAt.toISOString()
        : null,
      isAvailable: service?.isAvailable !== false,
      activeRequestId: active?.id ?? null,
      activeRequestStatus: active?.status ?? null,
      lastAttemptOutcome: lastOutcomeByDispatch.get(u._id.toString()) ?? null,
    };
  });
}

export async function listUnlinkedGroundAmbulances(
  providerUserId: string,
): Promise<{ id: string; title: string }[]> {
  const services = await Service.find({
    userId: new mongoose.Types.ObjectId(providerUserId),
    departmentSlug: GROUND_AMBULANCE_DEPARTMENT_SLUG,
    $or: [{ dispatchUserId: null }, { dispatchUserId: { $exists: false } }],
  })
    .select("title")
    .sort({ title: 1 })
    .lean();

  return services.map((s) => ({
    id: s._id.toString(),
    title: s.title,
  }));
}

export async function setDispatchAccountDisabled(
  providerUserId: string,
  dispatchUserId: string,
  isDisabled: boolean,
): Promise<DispatchAccountDto> {
  if (!mongoose.Types.ObjectId.isValid(dispatchUserId)) {
    throw new ProviderDispatchAccountsHttpError(400, "Invalid dispatch user id");
  }

  const user = await User.findOne({
    _id: new mongoose.Types.ObjectId(dispatchUserId),
    role: "dispatch",
    ownerProviderUserId: new mongoose.Types.ObjectId(providerUserId),
  });

  if (!user) {
    throw new ProviderDispatchAccountsHttpError(404, "Dispatch account not found");
  }

  user.isDisabled = isDisabled;
  await user.save();

  if (isDisabled && user.assignedServiceId) {
    await Service.updateOne(
      { _id: user.assignedServiceId },
      {
        $set: { dispatchEnabled: false, liveLocationUpdatedAt: null },
        $unset: { liveLocation: 1 },
      },
    );
  }

  const list = await listDispatchAccounts(providerUserId);
  const row = list.find((a) => a.id === user._id.toString());
  if (!row) {
    throw new ProviderDispatchAccountsHttpError(404, "Dispatch account not found");
  }
  return row;
}

/** Called when provider toggles listing availability. */
export async function syncDispatchAccountWithListingAvailability(
  serviceId: string,
  isAvailable: boolean,
): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(serviceId)) {
    return;
  }

  const service = await Service.findById(serviceId).select("dispatchUserId").lean();
  if (!service?.dispatchUserId) {
    return;
  }

  await User.updateOne(
    { _id: service.dispatchUserId, role: "dispatch" },
    { $set: { isDisabled: !isAvailable } },
  );

  if (!isAvailable) {
    await Service.updateOne(
      { _id: service._id },
      {
        $set: { dispatchEnabled: false, liveLocationUpdatedAt: null },
        $unset: { liveLocation: 1 },
      },
    );
  }
}
