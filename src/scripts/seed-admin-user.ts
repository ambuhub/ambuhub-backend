/**
 * Create or promote an admin user.
 *
 * Usage:
 *   npm run seed:admin
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret123 npm run seed:admin
 *
 * Optional env:
 *   ADMIN_FIRST_NAME, ADMIN_LAST_NAME, ADMIN_PHONE, ADMIN_COUNTRY_CODE
 *   ADMIN_PROMOTE_EXISTING=true  — promote an existing non-admin user to admin
 */

import dotenv from "dotenv";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import { normalizeCountryCode } from "../shared/lib/countryCode";

dotenv.config();

const SALT_ROUNDS = 10;

async function main(): Promise<void> {
  const uri = process.env.DB_URI;
  if (!uri?.trim()) {
    throw new Error("DB_URI is required in .env");
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters");
  }

  await mongoose.connect(uri, {
    dbName: process.env.DB_NAME?.trim() || undefined,
  });

  const promoteExisting =
    process.env.ADMIN_PROMOTE_EXISTING === "1" ||
    process.env.ADMIN_PROMOTE_EXISTING === "true" ||
    process.env.ADMIN_PROMOTE_EXISTING === "yes";

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role === "admin") {
      console.log("Admin user already exists:", email);
      await mongoose.disconnect();
      return;
    }
    if (!promoteExisting) {
      throw new Error(
        `User ${email} exists with role ${existing.role}. Set ADMIN_PROMOTE_EXISTING=true to promote.`,
      );
    }
    existing.role = "admin";
    existing.emailVerified = true;
    existing.password = await bcrypt.hash(password, SALT_ROUNDS);
    await existing.save();
    console.log("Promoted existing user to admin:", email);
    await mongoose.disconnect();
    return;
  }

  const firstName = process.env.ADMIN_FIRST_NAME?.trim() || "Admin";
  const lastName = process.env.ADMIN_LAST_NAME?.trim() || "User";
  const phone = process.env.ADMIN_PHONE?.trim() || "0000000000";
  const countryCode = normalizeCountryCode(
    process.env.ADMIN_COUNTRY_CODE?.trim() || "NG",
  );
  if (!countryCode) {
    throw new Error("Invalid ADMIN_COUNTRY_CODE");
  }

  await User.create({
    firstName,
    lastName,
    email,
    phone,
    countryCode,
    password: await bcrypt.hash(password, SALT_ROUNDS),
    role: "admin",
    emailVerified: true,
    dateOfBirth: null,
  });

  console.log("Created admin user:", email);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
