/**
 * Set countryCode NG and company profile for dolphines@gmail.com.
 *
 * Usage: npx ts-node --transpile-only src/scripts/set-dolphines-provider-profile.ts
 */

const dns = require("dns");
import dotenv from "dotenv";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import { ServiceProvider } from "../models/serviceProvider.model";
import { normalizeCountryCode } from "../shared/lib/countryCode";

dotenv.config();

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const EMAIL = "dolphines@gmail.com";

const PROFILE = {
  countryCode: "NG",
  businessName: "Dolphines Ambulance & Medical Transport Ltd",
  physicalAddress: "12 Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
  website: "https://dolphines-ambulance.example",
};

async function main(): Promise<void> {
  const uri = process.env.DB_URI;
  if (!uri?.trim()) {
    throw new Error("DB_URI is required in .env");
  }

  await mongoose.connect(uri, {
    dbName: process.env.DB_NAME?.trim() || undefined,
  });

  const normalizedCountry = normalizeCountryCode(PROFILE.countryCode);
  if (!normalizedCountry) {
    throw new Error("Invalid country code NG");
  }

  const user = await User.findOne({ email: EMAIL.toLowerCase().trim() }).lean();
  if (!user?._id) {
    throw new Error(`User not found: ${EMAIL}`);
  }
  if (user.role !== "service_provider") {
    throw new Error(
      `User ${EMAIL} has role ${String(user.role)}; expected service_provider`,
    );
  }

  const userId = user._id as mongoose.Types.ObjectId;

  const userPatch: Record<string, string> = { countryCode: normalizedCountry };
  const legacyName =
    typeof (user as { name?: string }).name === "string"
      ? (user as { name: string }).name.trim()
      : "";
  if (!user.firstName?.trim() && legacyName) {
    const parts = legacyName.split(/\s+/);
    userPatch.firstName = parts[0] ?? "Dolphines";
    userPatch.lastName = parts.slice(1).join(" ") || "Provider";
  } else if (!user.firstName?.trim()) {
    userPatch.firstName = "Dolphines";
    userPatch.lastName = user.lastName?.trim() || "Provider";
  } else if (!user.lastName?.trim()) {
    userPatch.lastName = "Provider";
  }

  await User.updateOne({ _id: userId }, { $set: userPatch });

  const providerUpdate = {
    businessName: PROFILE.businessName,
    physicalAddress: PROFILE.physicalAddress,
    website: PROFILE.website,
  };

  const providerResult = await ServiceProvider.updateOne(
    { userId },
    { $set: providerUpdate },
    { upsert: true },
  );

  const updatedUser = await User.findById(userId)
    .select("email countryCode firstName lastName phone role")
    .lean();
  const provider = await ServiceProvider.findOne({ userId }).lean();

  console.log("Updated user:", {
    email: updatedUser?.email,
    countryCode: updatedUser?.countryCode,
    firstName: updatedUser?.firstName,
    lastName: updatedUser?.lastName,
    phone: updatedUser?.phone,
    userFieldsPatched: userPatch,
  });
  console.log("Service provider upsert:", {
    matched: providerResult.matchedCount,
    modified: providerResult.modifiedCount,
    upserted: providerResult.upsertedCount,
  });
  console.log("Updated service provider profile:", {
    businessName: provider?.businessName,
    physicalAddress: provider?.physicalAddress,
    website: provider?.website,
  });

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
