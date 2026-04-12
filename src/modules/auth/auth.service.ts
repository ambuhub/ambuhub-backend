import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User, type UserRole } from "../../models/user.model";
import { logger } from "../../shared/lib/logger";

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
  name: string;
  email: string;
  phone: string;
  country: string;
  password: string;
  role: UserRole;
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

function toPublicUser(user: {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
}) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
  };
}

export async function register(
  input: RegisterInput
): Promise<{ token: string; user: ReturnType<typeof toPublicUser> }> {
  const { name, email, phone, country, password, role } = input;

  if (!name?.trim() || !email?.trim() || !phone?.trim() || !country?.trim()) {
    throw new AuthHttpError(400, "All fields are required");
  }
  if (!password || password.length < 8) {
    throw new AuthHttpError(400, "Password must be at least 8 characters");
  }
  if (role !== "patient" && role !== "service_provider") {
    throw new AuthHttpError(400, "Invalid role");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  let user;
  try {
    user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      country: country.trim(),
      password: passwordHash,
      role,
      emailVerified: false,
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

  await scheduleEmailVerificationOtp(user._id.toString(), user.email);

  const token = signToken(user._id.toString(), user.role);

  return {
    token,
    user: toPublicUser(user),
  };
}

export async function login(
  input: LoginInput
): Promise<{ token: string; user: ReturnType<typeof toPublicUser> }> {
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

  const token = signToken(user._id.toString(), user.role);

  return {
    token,
    user: toPublicUser(user),
  };
}
