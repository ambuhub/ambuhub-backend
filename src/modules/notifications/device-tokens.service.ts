import mongoose from "mongoose";
import {
  DeviceToken,
  devicePlatformValues,
  type DevicePlatform,
} from "../../models/device-token.model";
import { User } from "../../models/user.model";
import { NotificationsHttpError } from "./notifications.service";

async function assertAuthenticatedUser(userId: string): Promise<void> {
  const user = await User.findById(userId).select("role").lean();
  if (!user) {
    throw new NotificationsHttpError(401, "Unauthorized");
  }
}

function parsePlatform(value: unknown): DevicePlatform {
  if (
    typeof value === "string" &&
    (devicePlatformValues as readonly string[]).includes(value)
  ) {
    return value as DevicePlatform;
  }
  throw new NotificationsHttpError(400, "platform must be web, android, or ios");
}

function parseToken(value: unknown): string {
  const token = typeof value === "string" ? value.trim() : "";
  if (!token) {
    throw new NotificationsHttpError(400, "fcmToken is required");
  }
  return token;
}

export type DeviceTokenDto = {
  id: string;
  fcmToken: string;
  platform: DevicePlatform;
  deviceName: string | null;
  appVersion: string | null;
  lastSeenAt: string;
};

function mapDeviceToken(doc: {
  _id: mongoose.Types.ObjectId;
  fcmToken: string;
  platform: DevicePlatform;
  deviceName?: string | null;
  appVersion?: string | null;
  lastSeenAt: Date;
}): DeviceTokenDto {
  return {
    id: doc._id.toString(),
    fcmToken: doc.fcmToken,
    platform: doc.platform,
    deviceName: doc.deviceName ?? null,
    appVersion: doc.appVersion ?? null,
    lastSeenAt: doc.lastSeenAt.toISOString(),
  };
}

export async function registerDeviceToken(
  userId: string,
  input: {
    fcmToken: unknown;
    platform: unknown;
    deviceName?: unknown;
    appVersion?: unknown;
  },
): Promise<DeviceTokenDto> {
  await assertAuthenticatedUser(userId);
  const fcmToken = parseToken(input.fcmToken);
  const platform = parsePlatform(input.platform);
  const deviceName =
    typeof input.deviceName === "string" ? input.deviceName.trim() : undefined;
  const appVersion =
    typeof input.appVersion === "string" ? input.appVersion.trim() : undefined;
  const now = new Date();
  const userOid = new mongoose.Types.ObjectId(userId);

  const doc = await DeviceToken.findOneAndUpdate(
    { userId: userOid, fcmToken },
    {
      $set: {
        platform,
        deviceName: deviceName || undefined,
        appVersion: appVersion || undefined,
        lastSeenAt: now,
      },
      $setOnInsert: { userId: userOid, fcmToken },
    },
    { upsert: true, new: true },
  ).lean();

  return mapDeviceToken(doc as Parameters<typeof mapDeviceToken>[0]);
}

export async function refreshDeviceToken(
  userId: string,
  input: {
    oldToken: unknown;
    newToken: unknown;
    platform: unknown;
    deviceName?: unknown;
    appVersion?: unknown;
  },
): Promise<DeviceTokenDto> {
  await assertAuthenticatedUser(userId);
  const oldToken =
    typeof input.oldToken === "string" ? input.oldToken.trim() : "";
  const newToken = parseToken(input.newToken);
  const platform = parsePlatform(input.platform);
  const deviceName =
    typeof input.deviceName === "string" ? input.deviceName.trim() : undefined;
  const appVersion =
    typeof input.appVersion === "string" ? input.appVersion.trim() : undefined;
  const now = new Date();
  const userOid = new mongoose.Types.ObjectId(userId);

  if (oldToken) {
    const updated = await DeviceToken.findOneAndUpdate(
      { userId: userOid, fcmToken: oldToken },
      {
        $set: {
          fcmToken: newToken,
          platform,
          deviceName: deviceName || undefined,
          appVersion: appVersion || undefined,
          lastSeenAt: now,
        },
      },
      { new: true },
    ).lean();

    if (updated) {
      await DeviceToken.deleteMany({
        userId: userOid,
        fcmToken: oldToken,
        _id: { $ne: updated._id },
      });
      return mapDeviceToken(updated as Parameters<typeof mapDeviceToken>[0]);
    }
  }

  return registerDeviceToken(userId, {
    fcmToken: newToken,
    platform,
    deviceName,
    appVersion,
  });
}

export async function deleteDeviceToken(
  userId: string,
  fcmTokenInput: unknown,
): Promise<void> {
  await assertAuthenticatedUser(userId);
  const fcmToken = parseToken(fcmTokenInput);
  await DeviceToken.deleteOne({
    userId: new mongoose.Types.ObjectId(userId),
    fcmToken,
  });
}
