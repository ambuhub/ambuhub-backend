import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { Otp, type OtpPurpose } from "../../models/otp.model";
import { User } from "../../models/user.model";
import { sendOtpEmail } from "../../shared/lib/email";
import { logger } from "../../shared/lib/logger";
import { AuthHttpError } from "./auth.errors";

const SALT_ROUNDS = 10;
const OTP_LENGTH = 6;
const OTP_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 90 * 1000;
const MAX_ATTEMPTS = 5;

export type IssueOtpResult = {
  email: string;
  purpose: OtpPurpose;
  expiresAt: string;
  resendAvailableAt: string;
  resendCooldownAfterSeconds: number;
};

function generateOtpCode(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return String(n).padStart(OTP_LENGTH, "0");
}

function normalizeCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

async function invalidatePendingOtps(
  userId: mongoose.Types.ObjectId,
  purpose: OtpPurpose,
): Promise<void> {
  await Otp.updateMany(
    {
      userId,
      purpose,
      consumedAt: null,
    },
    { $set: { consumedAt: new Date() } },
  );
}

export async function issueOtp(input: {
  userId: string;
  email: string;
  purpose: OtpPurpose;
  force?: boolean;
}): Promise<IssueOtpResult> {
  if (!mongoose.Types.ObjectId.isValid(input.userId)) {
    throw new AuthHttpError(400, "Invalid user id");
  }

  const userOid = new mongoose.Types.ObjectId(input.userId);
  const email = input.email.trim().toLowerCase();
  const now = new Date();

  const latest = await Otp.findOne({
    userId: userOid,
    purpose: input.purpose,
    consumedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!input.force && latest?.sentAt) {
    const elapsed = now.getTime() - new Date(latest.sentAt).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitMs = RESEND_COOLDOWN_MS - elapsed;
      const resendAvailableAt = new Date(now.getTime() + waitMs);
      throw new AuthHttpError(
        429,
        `Please wait ${Math.ceil(waitMs / 1000)} seconds before requesting another code.`,
      );
    }
  }

  const code = generateOtpCode();
  const codeHash = await bcrypt.hash(code, SALT_ROUNDS);
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

  await invalidatePendingOtps(userOid, input.purpose);

  await Otp.create({
    userId: userOid,
    email,
    purpose: input.purpose,
    codeHash,
    expiresAt,
    sentAt: now,
    attempts: 0,
    consumedAt: null,
  });

  try {
    await sendOtpEmail({
      to: email,
      code,
      purpose: input.purpose,
    });
  } catch (err) {
    const detail =
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : "Could not send verification email. Please try again shortly.";
    logger.error("OTP email send failed", {
      error: err,
      userId: input.userId,
      purpose: input.purpose,
      detail,
    });
    throw new AuthHttpError(503, detail);
  }

  const resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_MS);
  return {
    email,
    purpose: input.purpose,
    expiresAt: expiresAt.toISOString(),
    resendAvailableAt: resendAvailableAt.toISOString(),
    resendCooldownAfterSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
  };
}

export async function getVerifyEmailOtpStatus(userId: string): Promise<{
  email: string;
  emailVerified: boolean;
  role: string;
  expiresAt: string | null;
  resendAvailableAt: string | null;
  resendCooldownAfterSeconds: number;
}> {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AuthHttpError(400, "Invalid user id");
  }

  const user = await User.findById(userId)
    .select("email emailVerified role")
    .lean();
  if (!user) {
    throw new AuthHttpError(404, "User not found");
  }

  if (user.emailVerified) {
    return {
      email: user.email,
      emailVerified: true,
      role: user.role,
      expiresAt: null,
      resendAvailableAt: null,
      resendCooldownAfterSeconds: 0,
    };
  }

  const latest = await Otp.findOne({
    userId: user._id,
    purpose: "verify_email",
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();

  const now = Date.now();
  let resendAvailableAt: string | null = null;
  let resendCooldownAfterSeconds = 0;

  if (latest?.sentAt) {
    const available = new Date(latest.sentAt).getTime() + RESEND_COOLDOWN_MS;
    if (available > now) {
      resendAvailableAt = new Date(available).toISOString();
      resendCooldownAfterSeconds = Math.ceil((available - now) / 1000);
    } else {
      resendAvailableAt = new Date(now).toISOString();
      resendCooldownAfterSeconds = 0;
    }
  }

  return {
    email: user.email,
    emailVerified: false,
    role: user.role,
    expiresAt: latest?.expiresAt
      ? new Date(latest.expiresAt).toISOString()
      : null,
    resendAvailableAt,
    resendCooldownAfterSeconds,
  };
}

export async function verifyEmailOtp(input: {
  userId: string;
  code: string;
}): Promise<{ email: string }> {
  if (!mongoose.Types.ObjectId.isValid(input.userId)) {
    throw new AuthHttpError(400, "Invalid user id");
  }

  const code = normalizeCode(input.code);
  if (code.length !== OTP_LENGTH) {
    throw new AuthHttpError(400, "Enter the 6-digit verification code");
  }

  const user = await User.findById(input.userId);
  if (!user) {
    throw new AuthHttpError(404, "User not found");
  }

  if (user.emailVerified) {
    return { email: user.email };
  }

  const otp = await Otp.findOne({
    userId: user._id,
    purpose: "verify_email",
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .select("+codeHash");

  if (!otp) {
    throw new AuthHttpError(
      400,
      "Verification code expired or missing. Please request a new one.",
    );
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    otp.consumedAt = new Date();
    await otp.save();
    throw new AuthHttpError(
      400,
      "Too many incorrect attempts. Please request a new code.",
    );
  }

  const match = await bcrypt.compare(code, otp.codeHash);
  if (!match) {
    otp.attempts += 1;
    await otp.save();
    const remaining = MAX_ATTEMPTS - otp.attempts;
    throw new AuthHttpError(
      400,
      remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
        : "Too many incorrect attempts. Please request a new code.",
    );
  }

  otp.consumedAt = new Date();
  await otp.save();

  user.emailVerified = true;
  await user.save();

  return { email: user.email };
}

export async function verifyOtpForPurpose(input: {
  email: string;
  code: string;
  purpose: OtpPurpose;
}): Promise<{ userId: string; email: string }> {
  const email = input.email.trim().toLowerCase();
  const code = normalizeCode(input.code);
  if (!email) {
    throw new AuthHttpError(400, "Email is required");
  }
  if (code.length !== OTP_LENGTH) {
    throw new AuthHttpError(400, "Enter the 6-digit verification code");
  }

  const user = await User.findOne({ email }).select("_id email role");
  if (!user || user.role === "admin") {
    throw new AuthHttpError(400, "Invalid or expired verification code");
  }

  const otp = await Otp.findOne({
    userId: user._id,
    purpose: input.purpose,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .select("+codeHash");

  if (!otp) {
    throw new AuthHttpError(
      400,
      "Verification code expired or missing. Please request a new one.",
    );
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    otp.consumedAt = new Date();
    await otp.save();
    throw new AuthHttpError(
      400,
      "Too many incorrect attempts. Please request a new code.",
    );
  }

  const match = await bcrypt.compare(code, otp.codeHash);
  if (!match) {
    otp.attempts += 1;
    await otp.save();
    const remaining = MAX_ATTEMPTS - otp.attempts;
    throw new AuthHttpError(
      400,
      remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
        : "Too many incorrect attempts. Please request a new code.",
    );
  }

  otp.consumedAt = new Date();
  await otp.save();

  return { userId: user._id.toString(), email: user.email };
}

export async function verifyOtpForUserPurpose(input: {
  userId: string;
  code: string;
  purpose: OtpPurpose;
}): Promise<{ email: string }> {
  if (!mongoose.Types.ObjectId.isValid(input.userId)) {
    throw new AuthHttpError(400, "Invalid user id");
  }

  const code = normalizeCode(input.code);
  if (code.length !== OTP_LENGTH) {
    throw new AuthHttpError(400, "Enter the 6-digit verification code");
  }

  const userOid = new mongoose.Types.ObjectId(input.userId);
  const otp = await Otp.findOne({
    userId: userOid,
    purpose: input.purpose,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .select("+codeHash");

  if (!otp) {
    throw new AuthHttpError(
      400,
      "Verification code expired or missing. Please request a new one.",
    );
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    otp.consumedAt = new Date();
    await otp.save();
    throw new AuthHttpError(
      400,
      "Too many incorrect attempts. Please request a new code.",
    );
  }

  const match = await bcrypt.compare(code, otp.codeHash);
  if (!match) {
    otp.attempts += 1;
    await otp.save();
    const remaining = MAX_ATTEMPTS - otp.attempts;
    throw new AuthHttpError(
      400,
      remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
        : "Too many incorrect attempts. Please request a new code.",
    );
  }

  otp.consumedAt = new Date();
  await otp.save();

  return { email: otp.email };
}

export async function getLatestOtpResendStatus(input: {
  email: string;
  purpose: OtpPurpose;
}): Promise<{
  resendAvailableAt: string | null;
  resendCooldownAfterSeconds: number;
}> {
  const email = input.email.trim().toLowerCase();
  const user = await User.findOne({ email }).select("_id").lean();
  if (!user) {
    return { resendAvailableAt: null, resendCooldownAfterSeconds: 0 };
  }

  const latest = await Otp.findOne({
    userId: user._id,
    purpose: input.purpose,
    consumedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!latest?.sentAt) {
    return { resendAvailableAt: null, resendCooldownAfterSeconds: 0 };
  }

  const now = Date.now();
  const available = new Date(latest.sentAt).getTime() + RESEND_COOLDOWN_MS;
  if (available > now) {
    return {
      resendAvailableAt: new Date(available).toISOString(),
      resendCooldownAfterSeconds: Math.ceil((available - now) / 1000),
    };
  }
  return {
    resendAvailableAt: new Date(now).toISOString(),
    resendCooldownAfterSeconds: 0,
  };
}

export { RESEND_COOLDOWN_MS, OTP_TTL_MS, OTP_LENGTH };

