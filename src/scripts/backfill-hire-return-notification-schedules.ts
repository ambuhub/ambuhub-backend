/**
 * Backfill NotificationSchedule rows for existing hire orders with future return deadlines.
 * Run: npm run backfill:hire-return-notification-schedules
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database";
import { Order } from "../models/order.model";
import {
  scheduleHireReturnReminders,
  scheduleProviderHireReturnReminders,
} from "../modules/notifications/notifications.service";

dotenv.config();

function mapLinesForSchedule(
  lines: {
    lineKind?: "sale" | "hire" | "book" | null;
    serviceId: mongoose.Types.ObjectId;
    title: string;
    hireEnd?: Date | null;
  }[],
) {
  return lines.map((l) => ({
    ...(l.lineKind === "sale" || l.lineKind === "hire"
      ? { lineKind: l.lineKind }
      : {}),
    serviceId: l.serviceId,
    title: l.title,
    hireEnd: l.hireEnd ?? undefined,
  }));
}

function isFutureHireLine(l: {
  lineKind?: "sale" | "hire" | "book" | null;
  hireEnd?: Date | null;
}): boolean {
  return (
    l.lineKind === "hire" &&
    l.hireEnd instanceof Date &&
    l.hireEnd > new Date()
  );
}

async function main(): Promise<void> {
  await connectDatabase();
  const now = new Date();
  let processed = 0;
  let clientLines = 0;
  let providerLines = 0;

  const cursor = Order.find({ "lines.hireEnd": { $gt: now } }).cursor();

  for await (const order of cursor) {
    const hireLines = order.lines.filter(isFutureHireLine);
    if (hireLines.length === 0) {
      continue;
    }
    processed += 1;
    const mapped = mapLinesForSchedule(order.lines);

    await scheduleHireReturnReminders({
      userId: order.userId.toString(),
      orderId: order._id,
      lines: mapped,
    });
    clientLines += hireLines.length;

    const sellerIds = new Set<string>();
    for (const line of order.lines) {
      if (!isFutureHireLine(line) || !line.sellerUserId) {
        continue;
      }
      if (line.sellerUserId.equals(order.userId)) {
        continue;
      }
      const sid = line.sellerUserId.toString();
      if (sellerIds.has(sid)) {
        continue;
      }
      sellerIds.add(sid);
      await scheduleProviderHireReturnReminders({
        sellerUserId: sid,
        orderId: order._id,
        lines: mapped,
      });
      providerLines += 1;
    }
  }

  console.log(
    `Backfill complete: ${processed} orders, ${clientLines} client hire line(s), ${providerLines} provider seller line(s) with future deadlines.`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
