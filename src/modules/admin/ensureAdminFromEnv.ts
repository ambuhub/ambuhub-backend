import bcrypt from "bcrypt";
import { User } from "../../models/user.model";
import { normalizeCountryCode } from "../../shared/lib/countryCode";
import { logger } from "../../shared/lib/logger";

const SALT_ROUNDS = 10;

export async function ensureAdminFromEnv(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD?.trim();

  if (!email || !password) {
    return;
  }

  if (password.length < 8) {
    logger.warn("ADMIN_PASSWORD must be at least 8 characters; skipping admin bootstrap");
    return;
  }

  const existing = await User.findOne({ email }).lean();
  if (existing) {
    if (existing.role === "admin") {
      logger.info("Admin bootstrap skipped: admin user already exists", { email });
      return;
    }
    logger.warn("Admin bootstrap skipped: email already registered with another role", {
      email,
      role: existing.role,
    });
    return;
  }

  const firstName = process.env.ADMIN_FIRST_NAME?.trim() || "Admin";
  const lastName = process.env.ADMIN_LAST_NAME?.trim() || "User";
  const phone = process.env.ADMIN_PHONE?.trim() || "0000000000";
  const countryRaw = process.env.ADMIN_COUNTRY_CODE?.trim() || "NG";
  const countryCode = normalizeCountryCode(countryRaw);
  if (!countryCode) {
    logger.warn("Invalid ADMIN_COUNTRY_CODE; skipping admin bootstrap", {
      countryRaw,
    });
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await User.create({
    firstName,
    lastName,
    email,
    phone,
    countryCode,
    password: passwordHash,
    role: "admin",
    emailVerified: true,
    dateOfBirth: null,
  });

  logger.info("Admin user created from environment bootstrap", { email });
}
