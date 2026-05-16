/**
 * Backfill hire services with Nigeria location + Mon–Fri 09:00–16:00 WAT return window,
 * then snap existing hire order/receipt hireEnd values to allowed return instants and recalc totals.
 *
 * Runbook:
 *   cd ambuhub-backend
 *   DRY_RUN=1 npm run migrate:hire-location-return   # log only, no writes
 *   npm run migrate:hire-location-return             # apply (requires MONGODB_URI in .env)
 *
 * Back up the database before running on production.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database";
import { computeHireBillableUnits } from "../modules/orders/hire-pricing";
import { Order } from "../models/order.model";
import { Receipt } from "../models/receipt.model";
import { Service } from "../models/service.model";
import {
  normalizeHireReturnWindow,
  parseHireReturnWindowFromDoc,
  snapHireEndToReturnWindow,
  type HirePricingPeriod,
  type HireReturnWindow,
} from "../shared/lib/hireReturnWindow";
import {
  listStatesForCountry,
  resolveStateProvinceName,
} from "../shared/lib/serviceLocation";

dotenv.config();

const DRY_RUN =
  process.env.DRY_RUN === "1" ||
  process.env.DRY_RUN === "true" ||
  process.env.DRY_RUN === "yes";

const DEFAULT_WINDOW = normalizeHireReturnWindow(
  {
    daysOfWeek: [1, 2, 3, 4, 5],
    timeStart: "09:00",
    timeEnd: "16:00",
  },
  { required: true },
)!;

function stableIntInRange(min: number, max: number, idHex: string): number {
  const slice = idHex.slice(-8);
  const n = Number.parseInt(slice, 16);
  const span = max - min + 1;
  return min + (Math.abs(n) % span);
}

type ServiceHireMeta = {
  pricingPeriod: HirePricingPeriod | null;
  price: number;
  hireReturnWindow: HireReturnWindow;
};

function resolvePricingPeriod(
  linePeriod: string | undefined,
  servicePeriod: string | null | undefined,
): HirePricingPeriod | null {
  const raw = linePeriod ?? servicePeriod;
  if (
    raw === "hourly" ||
    raw === "daily" ||
    raw === "weekly" ||
    raw === "monthly" ||
    raw === "yearly"
  ) {
    return raw;
  }
  return null;
}

async function phase1Services(
  ngStates: ReturnType<typeof listStatesForCountry>,
): Promise<{ updated: number }> {
  let updated = 0;

  if (ngStates.length === 0) {
    console.error("No Nigerian states from country-state-city; aborting phase 1.");
    return { updated: 0 };
  }

  const cursor = Service.find({ listingType: "hire" })
    .select("_id countryCode stateProvince officeAddress hireReturnWindow")
    .cursor();

  for await (const doc of cursor) {
    const id = doc._id as mongoose.Types.ObjectId;
    const idHex = id.toHexString();
    const stateIndex = stableIntInRange(0, ngStates.length - 1, idHex);
    const state = ngStates[stateIndex]!;
    const stateName =
      resolveStateProvinceName("NG", state.code) ?? state.name;
    const officeAddress = `Provider office, ${stateName}, Nigeria`;

    const payload = {
      countryCode: "NG",
      stateProvince: state.code,
      officeAddress,
      hireReturnWindow: DEFAULT_WINDOW,
    };

    if (DRY_RUN) {
      console.log(
        `[DRY_RUN] service ${idHex}: ${JSON.stringify(payload)}`,
      );
    } else {
      await Service.updateOne({ _id: id }, { $set: payload });
    }
    updated += 1;
  }

  return { updated };
}

async function loadServiceHireMetaMap(): Promise<Map<string, ServiceHireMeta>> {
  const map = new Map<string, ServiceHireMeta>();
  const cursor = Service.find({ listingType: "hire" })
    .select("_id pricingPeriod price hireReturnWindow")
    .cursor();

  for await (const doc of cursor) {
    const id = (doc._id as mongoose.Types.ObjectId).toHexString();
    const window =
      parseHireReturnWindowFromDoc(doc.hireReturnWindow) ?? DEFAULT_WINDOW;
    const price =
      typeof doc.price === "number" && doc.price >= 0 ? doc.price : 0;
    map.set(id, {
      pricingPeriod: resolvePricingPeriod(undefined, doc.pricingPeriod),
      price,
      hireReturnWindow: window,
    });
  }
  return map;
}

type OrderLineDoc = {
  serviceId: mongoose.Types.ObjectId;
  sellerUserId?: mongoose.Types.ObjectId;
  lineKind?: string;
  title: string;
  unitPriceNgn: number;
  quantity: number;
  lineTotalNgn: number;
  categoryName: string;
  categorySlug: string;
  departmentName: string;
  hireStart?: Date;
  hireEnd?: Date;
  pricingPeriod?: string;
  hireBillableUnits?: number;
};

function receiptLinesFromOrder(lines: OrderLineDoc[]) {
  return lines.map((l) => ({
    serviceId: l.serviceId,
    sellerUserId: l.sellerUserId,
    lineKind: l.lineKind,
    title: l.title,
    unitPriceNgn: l.unitPriceNgn,
    quantity: l.quantity,
    lineTotalNgn: l.lineTotalNgn,
    categoryName: l.categoryName,
    departmentName: l.departmentName,
    hireStart: l.hireStart,
    hireEnd: l.hireEnd,
    pricingPeriod: l.pricingPeriod,
    hireBillableUnits: l.hireBillableUnits,
  }));
}

async function phase2OrdersAndReceipts(
  serviceMap: Map<string, ServiceHireMeta>,
): Promise<{
  ordersScanned: number;
  ordersUpdated: number;
  linesAdjusted: number;
  linesSkipped: number;
  receiptsUpdated: number;
}> {
  let ordersScanned = 0;
  let ordersUpdated = 0;
  let linesAdjusted = 0;
  let linesSkipped = 0;
  let receiptsUpdated = 0;

  const cursor = Order.find({
    "lines.lineKind": "hire",
    "lines.hireEnd": { $exists: true },
  })
    .select("_id lines subtotalNgn")
    .cursor();

  for await (const order of cursor) {
    ordersScanned += 1;
    const orderId = order._id as mongoose.Types.ObjectId;
    const lines = (order.lines ?? []) as OrderLineDoc[];
    let orderChanged = false;
    let subtotalNgn = 0;

    const newLines: OrderLineDoc[] = [];

    for (const line of lines) {
      const isHire =
        line.lineKind === "hire" ||
        (line.hireStart != null && line.hireEnd != null);

      if (!isHire || line.hireEnd == null) {
        subtotalNgn += line.lineTotalNgn;
        newLines.push(line);
        continue;
      }

      if (line.hireStart == null) {
        console.warn(
          `Order ${orderId.toHexString()} line "${line.title}": missing hireStart, skip`,
        );
        linesSkipped += 1;
        subtotalNgn += line.lineTotalNgn;
        newLines.push(line);
        continue;
      }

      const svcId = line.serviceId.toHexString();
      const svc = serviceMap.get(svcId);
      if (!svc) {
        console.warn(
          `Order ${orderId.toHexString()} line "${line.title}": service ${svcId} not found, skip`,
        );
        linesSkipped += 1;
        subtotalNgn += line.lineTotalNgn;
        newLines.push(line);
        continue;
      }

      const pricingPeriod = resolvePricingPeriod(
        line.pricingPeriod,
        svc.pricingPeriod ?? undefined,
      );
      if (!pricingPeriod) {
        console.warn(
          `Order ${orderId.toHexString()} line "${line.title}": no pricingPeriod, skip`,
        );
        linesSkipped += 1;
        subtotalNgn += line.lineTotalNgn;
        newLines.push(line);
        continue;
      }

      const hireStart = new Date(line.hireStart);
      const oldEnd = new Date(line.hireEnd);
      const window = svc.hireReturnWindow;

      let newEnd: Date;
      try {
        newEnd = snapHireEndToReturnWindow(oldEnd, window, pricingPeriod);
        if (newEnd.getTime() <= hireStart.getTime()) {
          newEnd = snapHireEndToReturnWindow(
            new Date(hireStart.getTime() + 1),
            window,
            pricingPeriod,
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(
          `Order ${orderId.toHexString()} line "${line.title}": snap failed (${msg}), skip`,
        );
        linesSkipped += 1;
        subtotalNgn += line.lineTotalNgn;
        newLines.push(line);
        continue;
      }

      let hireBillableUnits: number;
      try {
        hireBillableUnits = computeHireBillableUnits(
          pricingPeriod,
          hireStart,
          newEnd,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(
          `Order ${orderId.toHexString()} line "${line.title}": billable units failed (${msg}), skip`,
        );
        linesSkipped += 1;
        subtotalNgn += line.lineTotalNgn;
        newLines.push(line);
        continue;
      }

      const unitPriceNgn =
        typeof line.unitPriceNgn === "number" && line.unitPriceNgn >= 0
          ? line.unitPriceNgn
          : svc.price;
      const quantity = line.quantity >= 1 ? line.quantity : 1;
      const lineTotalNgn = Math.round(
        unitPriceNgn * quantity * hireBillableUnits,
      );

      const endChanged = newEnd.getTime() !== oldEnd.getTime();
      const unitsChanged = line.hireBillableUnits !== hireBillableUnits;
      const totalChanged = line.lineTotalNgn !== lineTotalNgn;

      if (endChanged || unitsChanged || totalChanged) {
        orderChanged = true;
        linesAdjusted += 1;
      }

      const updatedLine: OrderLineDoc = {
        ...line,
        hireEnd: newEnd,
        pricingPeriod,
        hireBillableUnits,
        unitPriceNgn,
        lineTotalNgn,
      };
      subtotalNgn += lineTotalNgn;
      newLines.push(updatedLine);
    }

    const subtotalChanged = order.subtotalNgn !== subtotalNgn;
    if (!orderChanged && !subtotalChanged) {
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `[DRY_RUN] order ${orderId.toHexString()}: subtotalNgn ${order.subtotalNgn} → ${subtotalNgn}, hire lines adjusted ${linesAdjusted}`,
      );
    } else {
      await Order.updateOne(
        { _id: orderId },
        { $set: { lines: newLines, subtotalNgn } },
      );
    }
    ordersUpdated += 1;

    const receipt = await Receipt.findOne({ orderId })
      .select("_id")
      .lean();
    if (receipt) {
      if (DRY_RUN) {
        console.log(
          `[DRY_RUN] receipt for order ${orderId.toHexString()}: update lines + subtotalNgn`,
        );
      } else {
        await Receipt.updateOne(
          { orderId },
          {
            $set: {
              lines: receiptLinesFromOrder(newLines),
              subtotalNgn,
            },
          },
        );
      }
      receiptsUpdated += 1;
    }
  }

  return {
    ordersScanned,
    ordersUpdated,
    linesAdjusted,
    linesSkipped,
    receiptsUpdated,
  };
}

async function migrate(): Promise<void> {
  if (DRY_RUN) {
    console.log("DRY_RUN enabled — no database writes will be performed.");
  }

  await connectDatabase();

  const ngStates = listStatesForCountry("NG");
  console.log(`Phase 1: ${ngStates.length} Nigerian states available`);

  const p1 = await phase1Services(ngStates);
  console.log(
    `Phase 1 complete: ${p1.updated} hire services ${DRY_RUN ? "would be " : ""}updated`,
  );

  const serviceMap = await loadServiceHireMetaMap();
  console.log(`Loaded ${serviceMap.size} hire services for order recalculation`);

  const p2 = await phase2OrdersAndReceipts(serviceMap);
  console.log("Phase 2 summary:");
  console.log(`  orders scanned: ${p2.ordersScanned}`);
  console.log(`  orders ${DRY_RUN ? "would be " : ""}updated: ${p2.ordersUpdated}`);
  console.log(`  hire lines adjusted: ${p2.linesAdjusted}`);
  console.log(`  hire lines skipped: ${p2.linesSkipped}`);
  console.log(`  receipts ${DRY_RUN ? "would be " : ""}updated: ${p2.receiptsUpdated}`);

  console.log("Done.");
}

migrate()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
