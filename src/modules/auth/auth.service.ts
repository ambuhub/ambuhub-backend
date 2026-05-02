import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User, type UserRole } from "../../models/user.model";
import { ServiceProvider } from "../../models/serviceProvider.model";
import { ensureWallet } from "../wallet/wallet.service";
import { logger } from "../../shared/lib/logger";
import { normalizeCountryCode } from "../../shared/lib/countryCode";

const SALT_ROUNDS = 10;
const JWT_EXPIRES = "7d";

export class AuthHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "AuthHttpError";
  }
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** ISO 3166-1 alpha-2, uppercase preferred (e.g. US, NG) */
  countryCode: string;
  password: string;
  role: UserRole;
  /** Required when role is service_provider */
  businessName?: string;
  website?: string;
  /** Required when role is service_provider */
  physicalAddress?: string;
  /** Required when role is client; ISO date string YYYY-MM-DD */
  dateOfBirth?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

function requireEnvJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

/**
 * Reserved for OTP email verification (nodemailer + stored OTP + expiry).
 * Call after successful registration once the flow is implemented.
 */
export async function scheduleEmailVerificationOtp(
  userId: string,
  email: string
): Promise<void> {
  logger.info("OTP email verification scheduled (not implemented yet)", {
    userId,
    email,
  });
}

function signToken(userId: string, role: UserRole): string {
  return jwt.sign(
    { sub: userId, userId, role },
    requireEnvJwtSecret(),
    { expiresIn: JWT_EXPIRES }
  );
}

export type PublicAuthUserProvider = {
  businessName: string;
  physicalAddress: string;
  website: string | null;
};

export type PublicAuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  dateOfBirth: string | null;
  phone: string;
  countryCode: string;
  businessName?: string;
  physicalAddress?: string;
  website?: string | null;
};

function toPublicUser(
  user: {
    _id: mongoose.Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    countryCode: string;
    role: UserRole;
    emailVerified: boolean;
    dateOfBirth?: Date | null;
  },
  provider: PublicAuthUserProvider | null,
): PublicAuthUser {
  const base: PublicAuthUser = {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    dateOfBirth:
      user.dateOfBirth != null
        ? new Date(user.dateOfBirth).toISOString().slice(0, 10)
        : null,
    phone: user.phone,
    countryCode: user.countryCode,
  };
  if (user.role === "service_provider" && provider) {
    base.businessName = provider.businessName;
    base.physicalAddress = provider.physicalAddress;
    base.website = provider.website;
  }
  return base;
}

const MIN_AGE_YEARS = 13;

function parseClientDateOfBirth(raw: string): Date {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    throw new AuthHttpError(400, "Date of birth is required");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new AuthHttpError(400, "Invalid date of birth");
  }
  const [y, m, d] = trimmed.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (
    utc.getUTCFullYear() !== y ||
    utc.getUTCMonth() !== m - 1 ||
    utc.getUTCDate() !== d
  ) {
    throw new AuthHttpError(400, "Invalid date of birth");
  }
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  if (utc.getTime() > todayUtc) {
    throw new AuthHttpError(400, "Date of birth cannot be in the future");
  }
  const minCalendar = Date.UTC(1900, 0, 1);
  if (utc.getTime() < minCalendar) {
    throw new AuthHttpError(400, "Invalid date of birth");
  }
  const cutoff = new Date(today);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - MIN_AGE_YEARS);
  const cutoffUtc = Date.UTC(
    cutoff.getUTCFullYear(),
    cutoff.getUTCMonth(),
    cutoff.getUTCDate(),
  );
  if (utc.getTime() > cutoffUtc) {
    throw new AuthHttpError(
      400,
      `You must be at least ${MIN_AGE_YEARS} years old to register`,
    );
  }
  return utc;
}

export async function register(
  input: RegisterInput
): Promise<{ token: string; user: PublicAuthUser }> {
  const {
    firstName,
    lastName,
    email,
    phone,
    countryCode,
    password,
    role,
    businessName,
    website,
    physicalAddress,
    dateOfBirth,
  } = input;

  if (
    !firstName?.trim() ||
    !lastName?.trim() ||
    !email?.trim() ||
    !phone?.trim() ||
    !countryCode?.trim()
  ) {
    throw new AuthHttpError(400, "All fields are required");
  }
  if (!password || password.length < 8) {
    throw new AuthHttpError(400, "Password must be at least 8 characters");
  }
  if (role !== "client" && role !== "service_provider") {
    throw new AuthHttpError(400, "Invalid role");
  }

  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!normalizedCountryCode) {
    throw new AuthHttpError(
      400,
      "Country must be a valid ISO 3166-1 alpha-2 code",
    );
  }

  let parsedDateOfBirth: Date | null = null;
  if (role === "client") {
    parsedDateOfBirth = parseClientDateOfBirth(dateOfBirth ?? "");
  }

  if (role === "service_provider") {
    if (!businessName?.trim() || !physicalAddress?.trim()) {
      throw new AuthHttpError(
        400,
        "Business name and physical address are required for service providers"
      );
    }
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  let user;
  try {
    user = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      countryCode: normalizedCountryCode,
      password: passwordHash,
      role,
      emailVerified: false,
      dateOfBirth: parsedDateOfBirth,
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      throw new AuthHttpError(409, "An account with this email already exists");
    }
    throw err;
  }

  let providerForResponse: PublicAuthUserProvider | null = null;

  if (role === "service_provider") {
    const websiteTrimmed = website?.trim() ?? "";
    try {
      await ServiceProvider.create({
        userId: user._id,
        businessName: businessName!.trim(),
        physicalAddress: physicalAddress!.trim(),
        ...(websiteTrimmed ? { website: websiteTrimmed } : {}),
      });
      try {
        await ensureWallet(user._id.toString());
      } catch (walletErr: unknown) {
        await ServiceProvider.deleteOne({ userId: user._id });
        await User.findByIdAndDelete(user._id);
        logger.error("wallet create failed; provider signup rolled back", {
          error: walletErr,
          userId: user._id.toString(),
        });
        throw new AuthHttpError(500, "Could not complete service provider signup");
      }
    } catch (err: unknown) {
      if (err instanceof AuthHttpError) {
        throw err;
      }
      await User.findByIdAndDelete(user._id);
      logger.error("service provider profile create failed; user rolled back", {
        error: err,
        userId: user._id.toString(),
      });
      throw new AuthHttpError(500, "Could not complete service provider signup");
    }
    providerForResponse = {
      businessName: businessName!.trim(),
      physicalAddress: physicalAddress!.trim(),
      website: websiteTrimmed !== "" ? websiteTrimmed : null,
    };
  }

  await scheduleEmailVerificationOtp(user._id.toString(), user.email);

  const token = signToken(user._id.toString(), user.role);

  return {
    token,
    user: toPublicUser(user, providerForResponse),
  };
}

export async function getSessionUser(userId: string): Promise<PublicAuthUser | null> {
  const trimmed = userId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    return null;
  }

  const user = await User.findById(trimmed).lean();
  if (!user) {
    return null;
  }

  let providerForResponse: PublicAuthUserProvider | null = null;
  if (user.role === "service_provider") {
    const row = await ServiceProvider.findOne({ userId: user._id }).lean();
    if (
      row &&
      typeof row.businessName === "string" &&
      typeof row.physicalAddress === "string"
    ) {
      const w = row.website;
      providerForResponse = {
        businessName: row.businessName,
        physicalAddress: row.physicalAddress,
        website:
          typeof w === "string" && w.trim() !== "" ? w.trim() : null,
      };
    }
  }

  return toPublicUser(user, providerForResponse);
}

export async function login(
  input: LoginInput
): Promise<{ token: string; user: PublicAuthUser }> {
  const { email, password } = input;
  if (!email?.trim() || !password) {
    throw new AuthHttpError(400, "Email and password are required");
  }

  const user = await User.findOne({
    email: email.trim().toLowerCase(),
  }).select("+password");

  if (!user) {
    throw new AuthHttpError(401, "Invalid email or password");
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new AuthHttpError(401, "Invalid email or password");
  }

  let providerForResponse: PublicAuthUserProvider | null = null;
  if (user.role === "service_provider") {
    const row = await ServiceProvider.findOne({ userId: user._id }).lean();
    if (
      row &&
      typeof row.businessName === "string" &&
      typeof row.physicalAddress === "string"
    ) {
      const w = row.website;
      providerForResponse = {
        businessName: row.businessName,
        physicalAddress: row.physicalAddress,
        website:
          typeof w === "string" && w.trim() !== "" ? w.trim() : null,
      };
    }
  }

  const token = signToken(user._id.toString(), user.role);

  return {
    token,
    user: toPublicUser(user, providerForResponse),
  };
}

export interface ResetPasswordUnverifiedInput {
  email: string;
  newPassword: string;
}

/**
 * Sets a new password from the account email only (no OTP or email link).
 * Replace with email-based reset when outbound mail is available.
 * Set DISABLE_UNVERIFIED_PASSWORD_RESET=true to turn this off (recommended once email reset ships).
 */
export async function resetPasswordWithoutVerification(
  input: ResetPasswordUnverifiedInput,
): Promise<void> {
  if (process.env.DISABLE_UNVERIFIED_PASSWORD_RESET === "true") {
    throw new AuthHttpError(
      403,
      "Password reset without email is disabled on this server.",
    );
  }

  const email = input.email?.trim().toLowerCase() ?? "";
  const newPassword = input.newPassword ?? "";

  if (!email) {
    throw new AuthHttpError(400, "Email is required");
  }
  if (!newPassword || newPassword.length < 8) {
    throw new AuthHttpError(400, "Password must be at least 8 characters");
  }

  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const result = await User.updateOne({ email }, { $set: { password: hash } });

  logger.info("Unverified password reset processed", {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
  });
}
