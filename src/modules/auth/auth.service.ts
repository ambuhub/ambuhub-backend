import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User, type UserRole } from "../../models/user.model";
import { Otp } from "../../models/otp.model";
import { ServiceProvider } from "../../models/serviceProvider.model";
import { ensureWallet } from "../wallet/wallet.service";
import { logger } from "../../shared/lib/logger";
import { normalizeCountryCode } from "../../shared/lib/countryCode";
import { isMarketplaceCountry } from "../../shared/currency/countryCurrency";
import { AuthHttpError } from "./auth.errors";
import {
  getVerifyEmailOtpStatus,
  issueOtp,
  verifyEmailOtp,
  verifyOtpForPurpose,
  verifyOtpForUserPurpose,
  type IssueOtpResult,
} from "./otp.service";

export { AuthHttpError } from "./auth.errors";
export { getVerifyEmailOtpStatus };

const SALT_ROUNDS = 10;
const JWT_EXPIRES = "7d";

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
 * Create and email a verify_email OTP (15-minute expiry).
 */
export async function scheduleEmailVerificationOtp(
  userId: string,
  email: string,
): Promise<IssueOtpResult> {
  return issueOtp({
    userId,
    email,
    purpose: "verify_email",
    force: true,
  });
}

function signToken(
  userId: string,
  role: UserRole,
  emailVerified: boolean,
): string {
  return jwt.sign(
    { sub: userId, userId, role, emailVerified },
    requireEnvJwtSecret(),
    { expiresIn: JWT_EXPIRES },
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
  input: RegisterInput,
): Promise<{
  token: string;
  user: PublicAuthUser;
  requiresEmailVerification: true;
  otp: IssueOtpResult;
}> {
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
  if (role === "admin") {
    throw new AuthHttpError(400, "Admin accounts cannot be created via registration");
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
    if (!isMarketplaceCountry(normalizedCountryCode)) {
      throw new AuthHttpError(
        400,
        "Service providers must register with Nigeria (NG) or Ghana (GH) as their country",
      );
    }
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

  const otpMeta = await scheduleEmailVerificationOtp(
    user._id.toString(),
    user.email,
  );

  const token = signToken(user._id.toString(), user.role, false);

  return {
    token,
    user: toPublicUser(user, providerForResponse),
    requiresEmailVerification: true,
    otp: otpMeta,
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

  if (user.isSuspended) {
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
  input: LoginInput,
): Promise<{
  token: string;
  user: PublicAuthUser;
  requiresEmailVerification?: boolean;
  otp?: IssueOtpResult;
}> {
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

  if (user.isSuspended) {
    throw new AuthHttpError(403, "This account has been suspended.");
  }

  if (user.role === "admin") {
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

  if (!user.emailVerified) {
    const otp = await scheduleEmailVerificationOtp(
      user._id.toString(),
      user.email,
    );
    const token = signToken(user._id.toString(), user.role, false);
    return {
      token,
      user: toPublicUser(user, providerForResponse),
      requiresEmailVerification: true,
      otp,
    };
  }

  const token = signToken(user._id.toString(), user.role, true);

  return {
    token,
    user: toPublicUser(user, providerForResponse),
  };
}

export async function adminLogin(
  input: LoginInput,
): Promise<{ token: string; user: PublicAuthUser }> {
  const { email, password } = input;
  if (!email?.trim() || !password) {
    throw new AuthHttpError(400, "Email and password are required");
  }

  const user = await User.findOne({
    email: email.trim().toLowerCase(),
  }).select("+password");

  if (!user || user.role !== "admin") {
    throw new AuthHttpError(401, "Invalid email or password");
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new AuthHttpError(401, "Invalid email or password");
  }

  if (user.isSuspended) {
    throw new AuthHttpError(403, "This account has been suspended.");
  }

  const token = signToken(user._id.toString(), user.role, true);

  return {
    token,
    user: toPublicUser(user, null),
  };
}

export interface ResetPasswordUnverifiedInput {
  email: string;
  newPassword: string;
}

const PASSWORD_RESET_TOKEN_PURPOSE = "password_reset";
const PASSWORD_RESET_TOKEN_EXPIRES = "15m";

const FORGOT_PASSWORD_GENERIC_MESSAGE =
  "If an account exists for that email, we sent a verification code.";

export async function requestPasswordResetOtp(input: {
  email: string;
  force?: boolean;
}): Promise<{
  ok: true;
  message: string;
  resendAvailableAt: string;
  resendCooldownAfterSeconds: number;
}> {
  const email = input.email?.trim().toLowerCase() ?? "";
  if (!email) {
    throw new AuthHttpError(400, "Email is required");
  }

  const fallbackAvailableAt = new Date(
    Date.now() + 90_000,
  ).toISOString();

  const user = await User.findOne({ email }).select("_id email role").lean();
  if (!user || user.role === "admin") {
    return {
      ok: true,
      message: FORGOT_PASSWORD_GENERIC_MESSAGE,
      resendAvailableAt: fallbackAvailableAt,
      resendCooldownAfterSeconds: 90,
    };
  }

  try {
    const otp = await issueOtp({
      userId: user._id.toString(),
      email: user.email,
      purpose: "reset_password",
      force: input.force ?? false,
    });
    return {
      ok: true,
      message: FORGOT_PASSWORD_GENERIC_MESSAGE,
      resendAvailableAt: otp.resendAvailableAt,
      resendCooldownAfterSeconds: otp.resendCooldownAfterSeconds,
    };
  } catch (err) {
    if (err instanceof AuthHttpError && err.statusCode === 429) {
      throw err;
    }
    if (err instanceof AuthHttpError && err.statusCode === 503) {
      throw err;
    }
    throw err;
  }
}

export async function verifyPasswordResetOtp(input: {
  email: string;
  code: string;
}): Promise<{ resetToken: string; email: string }> {
  const { userId, email } = await verifyOtpForPurpose({
    email: input.email,
    code: input.code,
    purpose: "reset_password",
  });

  const resetToken = jwt.sign(
    {
      purpose: PASSWORD_RESET_TOKEN_PURPOSE,
      sub: userId,
      userId,
      email,
    },
    requireEnvJwtSecret(),
    { expiresIn: PASSWORD_RESET_TOKEN_EXPIRES },
  );

  return { resetToken, email };
}

export async function resetPasswordWithToken(input: {
  resetToken: string;
  newPassword: string;
}): Promise<{ ok: true; message: string }> {
  const newPassword = input.newPassword ?? "";
  if (!newPassword || newPassword.length < 8) {
    throw new AuthHttpError(400, "Password must be at least 8 characters");
  }

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(
      input.resetToken?.trim() ?? "",
      requireEnvJwtSecret(),
    ) as jwt.JwtPayload;
  } catch {
    throw new AuthHttpError(
      400,
      "Reset session expired. Please verify your email again.",
    );
  }

  if (payload.purpose !== PASSWORD_RESET_TOKEN_PURPOSE) {
    throw new AuthHttpError(400, "Invalid reset session");
  }

  const userId = String(payload.sub ?? payload.userId ?? "");
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new AuthHttpError(400, "Invalid reset session");
  }

  const user = await User.findById(userId).select("+password role emailVerified");
  if (!user || user.role === "admin") {
    throw new AuthHttpError(400, "Invalid reset session");
  }

  user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.emailVerified = true;
  await user.save();

  logger.info("Password reset completed via OTP", { userId });

  return {
    ok: true,
    message: "Password updated successfully. You can sign in with your new password.",
  };
}

export interface UpdateClientProfileInput {
  firstName: string;
  lastName: string;
  phone: string;
  countryCode: string;
  dateOfBirth: string;
}

export async function updateClientProfile(
  userId: string,
  input: UpdateClientProfileInput,
): Promise<PublicAuthUser> {
  const trimmedId = userId?.trim() ?? "";
  if (!trimmedId || !mongoose.Types.ObjectId.isValid(trimmedId)) {
    throw new AuthHttpError(400, "Invalid user id");
  }

  const user = await User.findById(trimmedId);
  if (!user) {
    throw new AuthHttpError(404, "User not found");
  }
  if (user.role !== "client") {
    throw new AuthHttpError(
      403,
      "Only client accounts can update profile here",
    );
  }

  const { firstName, lastName, phone, countryCode, dateOfBirth } = input;
  if (
    !firstName?.trim() ||
    !lastName?.trim() ||
    !phone?.trim() ||
    !countryCode?.trim()
  ) {
    throw new AuthHttpError(400, "All fields are required");
  }

  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!normalizedCountryCode) {
    throw new AuthHttpError(
      400,
      "Country must be a valid ISO 3166-1 alpha-2 code",
    );
  }

  const parsedDateOfBirth = parseClientDateOfBirth(dateOfBirth);

  user.firstName = firstName.trim();
  user.lastName = lastName.trim();
  user.phone = phone.trim();
  user.countryCode = normalizedCountryCode;
  user.dateOfBirth = parsedDateOfBirth;
  await user.save();

  const updated = await getSessionUser(userId);
  if (!updated) {
    throw new AuthHttpError(500, "Could not load updated profile");
  }
  return updated;
}

export interface UpdateProviderProfileInput {
  firstName: string;
  lastName: string;
  phone: string;
  countryCode: string;
  businessName: string;
  physicalAddress: string;
  website?: string;
}

export async function updateProviderProfile(
  userId: string,
  input: UpdateProviderProfileInput,
): Promise<PublicAuthUser> {
  const trimmedId = userId?.trim() ?? "";
  if (!trimmedId || !mongoose.Types.ObjectId.isValid(trimmedId)) {
    throw new AuthHttpError(400, "Invalid user id");
  }

  const user = await User.findById(trimmedId);
  if (!user) {
    throw new AuthHttpError(404, "User not found");
  }
  if (user.role !== "service_provider") {
    throw new AuthHttpError(
      403,
      "Only service provider accounts can update profile here",
    );
  }

  const provider = await ServiceProvider.findOne({ userId: user._id });
  if (!provider) {
    throw new AuthHttpError(404, "Service provider profile not found");
  }

  const {
    firstName,
    lastName,
    phone,
    countryCode,
    businessName,
    physicalAddress,
    website,
  } = input;

  if (
    !firstName?.trim() ||
    !lastName?.trim() ||
    !phone?.trim() ||
    !countryCode?.trim() ||
    !businessName?.trim() ||
    !physicalAddress?.trim()
  ) {
    throw new AuthHttpError(400, "All required fields must be provided");
  }

  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!normalizedCountryCode) {
    throw new AuthHttpError(
      400,
      "Country must be a valid ISO 3166-1 alpha-2 code",
    );
  }

  const websiteTrimmed = website?.trim() ?? "";

  user.firstName = firstName.trim();
  user.lastName = lastName.trim();
  user.phone = phone.trim();
  user.countryCode = normalizedCountryCode;
  await user.save();

  provider.businessName = businessName.trim();
  provider.physicalAddress = physicalAddress.trim();
  provider.website = websiteTrimmed || "";
  await provider.save();

  const updated = await getSessionUser(userId);
  if (!updated) {
    throw new AuthHttpError(500, "Could not load updated profile");
  }
  return updated;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<void> {
  const trimmedId = userId?.trim() ?? "";
  if (!trimmedId || !mongoose.Types.ObjectId.isValid(trimmedId)) {
    throw new AuthHttpError(400, "Invalid user id");
  }

  const currentPassword = input.currentPassword ?? "";
  const newPassword = input.newPassword ?? "";

  if (!currentPassword) {
    throw new AuthHttpError(400, "Current password is required");
  }
  if (!newPassword || newPassword.length < 8) {
    throw new AuthHttpError(400, "Password must be at least 8 characters");
  }
  if (currentPassword === newPassword) {
    throw new AuthHttpError(
      400,
      "New password must be different from the current password",
    );
  }

  const user = await User.findById(trimmedId).select("+password");
  if (!user) {
    throw new AuthHttpError(404, "User not found");
  }

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) {
    throw new AuthHttpError(401, "Current password is incorrect");
  }

  user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.save();
}

export async function verifyEmailAndIssueSession(
  userId: string,
  code: string,
): Promise<{ token: string; user: PublicAuthUser }> {
  await verifyEmailOtp({ userId, code });
  const user = await getSessionUser(userId);
  if (!user) {
    throw new AuthHttpError(404, "User not found");
  }
  const token = signToken(user.id, user.role, true);
  return { token, user };
}

export async function resendVerifyEmailOtp(
  userId: string,
): Promise<IssueOtpResult> {
  const user = await User.findById(userId).select("email emailVerified role");
  if (!user) {
    throw new AuthHttpError(404, "User not found");
  }
  if (user.role === "admin") {
    throw new AuthHttpError(400, "Admin accounts do not require email verification");
  }
  if (user.emailVerified) {
    throw new AuthHttpError(400, "Email is already verified");
  }
  return issueOtp({
    userId: user._id.toString(),
    email: user.email,
    purpose: "verify_email",
  });
}

export async function requestChangeEmailOtp(input: {
  userId: string;
  newEmail: string;
  password: string;
  force?: boolean;
}): Promise<IssueOtpResult & { pendingEmail: string }> {
  const newEmail = input.newEmail?.trim().toLowerCase() ?? "";
  const password = input.password ?? "";
  if (!newEmail) {
    throw new AuthHttpError(400, "New email is required");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    throw new AuthHttpError(400, "Invalid email address");
  }
  if (!password) {
    throw new AuthHttpError(400, "Password is required to change your email");
  }

  const user = await User.findById(input.userId).select("email role +password");
  if (!user) {
    throw new AuthHttpError(404, "User not found");
  }
  if (user.role === "admin") {
    throw new AuthHttpError(400, "Admin accounts cannot change email here");
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new AuthHttpError(401, "Password is incorrect");
  }

  if (user.email === newEmail) {
    throw new AuthHttpError(400, "That is already your current email address");
  }

  const taken = await User.findOne({ email: newEmail }).select("_id").lean();
  if (taken) {
    throw new AuthHttpError(409, "An account with this email already exists");
  }

  const otp = await issueOtp({
    userId: user._id.toString(),
    email: newEmail,
    purpose: "change_email",
    force: input.force ?? false,
  });

  return { ...otp, pendingEmail: newEmail };
}

export async function verifyChangeEmailAndIssueSession(input: {
  userId: string;
  code: string;
}): Promise<{ token: string; user: PublicAuthUser }> {
  const code = (input.code ?? "").replace(/\D/g, "").slice(0, 6);
  if (code.length !== 6) {
    throw new AuthHttpError(400, "Enter the 6-digit verification code");
  }

  const user = await User.findById(input.userId);
  if (!user) {
    throw new AuthHttpError(404, "User not found");
  }
  if (user.role === "admin") {
    throw new AuthHttpError(400, "Admin accounts cannot change email here");
  }

  const verified = await verifyOtpForUserPurpose({
    userId: user._id.toString(),
    code,
    purpose: "change_email",
  });

  const taken = await User.findOne({
    email: verified.email,
    _id: { $ne: user._id },
  })
    .select("_id")
    .lean();
  if (taken) {
    throw new AuthHttpError(409, "An account with this email already exists");
  }

  user.email = verified.email;
  user.emailVerified = true;
  try {
    await user.save();
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

  const sessionUser = await getSessionUser(user._id.toString());
  if (!sessionUser) {
    throw new AuthHttpError(500, "Could not load updated profile");
  }
  const token = signToken(sessionUser.id, sessionUser.role, true);
  return { token, user: sessionUser };
}

export async function resendChangeEmailOtp(
  userId: string,
): Promise<IssueOtpResult & { pendingEmail: string }> {
  const user = await User.findById(userId).select("email role");
  if (!user) {
    throw new AuthHttpError(404, "User not found");
  }
  if (user.role === "admin") {
    throw new AuthHttpError(400, "Admin accounts cannot change email here");
  }

  const latest = await Otp.findOne({
    userId: user._id,
    purpose: "change_email",
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!latest?.email) {
    throw new AuthHttpError(
      400,
      "No pending email change. Enter a new email address first.",
    );
  }

  if (latest.email === user.email) {
    throw new AuthHttpError(400, "That is already your current email address");
  }

  const taken = await User.findOne({
    email: latest.email,
    _id: { $ne: user._id },
  })
    .select("_id")
    .lean();
  if (taken) {
    throw new AuthHttpError(409, "An account with this email already exists");
  }

  const otp = await issueOtp({
    userId: user._id.toString(),
    email: latest.email,
    purpose: "change_email",
  });

  return { ...otp, pendingEmail: latest.email };
}