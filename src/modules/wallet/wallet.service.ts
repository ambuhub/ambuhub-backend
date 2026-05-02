import mongoose from "mongoose";
import { Wallet } from "../../models/wallet.model";
import { Service } from "../../models/service.model";
import type { CartCheckoutLine } from "../cart/cart.service";

export type WalletDto = {
  balanceNgn: number;
  currency: string;
};

export type AppliedWalletCredit = {
  userId: mongoose.Types.ObjectId;
  amountNgn: number;
};

export async function ensureWallet(userId: string): Promise<void> {
  const trimmed = userId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    return;
  }
  const uid = new mongoose.Types.ObjectId(trimmed);
  await Wallet.findOneAndUpdate(
    { userId: uid },
    { $setOnInsert: { userId: uid, balanceNgn: 0, currency: "NGN" } },
    { upsert: true },
  );
}

export async function getWalletForUser(userId: string): Promise<WalletDto> {
  await ensureWallet(userId);
  const w = await Wallet.findOne({
    userId: new mongoose.Types.ObjectId(userId),
  }).lean();
  return {
    balanceNgn: typeof w?.balanceNgn === "number" ? w.balanceNgn : 0,
    currency: typeof w?.currency === "string" ? w.currency : "NGN",
  };
}

/**
 * Credits each listing owner's wallet by summed line totals for that seller.
 * Returns credits applied for rollback on failure.
 */
export async function creditSellersForCheckoutLines(
  lines: CartCheckoutLine[],
): Promise<AppliedWalletCredit[]> {
  const totals = new Map<string, number>();

  for (const line of lines) {
    const svc = await Service.findById(line.serviceId).select("userId").lean();
    if (!svc?.userId) {
      throw new Error("Could not resolve seller for a checkout line");
    }
    const sid = svc.userId.toString();
    totals.set(sid, (totals.get(sid) ?? 0) + line.lineTotalNgn);
  }

  const applied: AppliedWalletCredit[] = [];

  try {
    for (const [sid, amountNgn] of totals) {
      if (!Number.isFinite(amountNgn) || amountNgn <= 0) {
        continue;
      }
      const uid = new mongoose.Types.ObjectId(sid);
      await Wallet.updateOne(
        { userId: uid },
        {
          $inc: { balanceNgn: amountNgn },
          $setOnInsert: { userId: uid, currency: "NGN" },
        },
        { upsert: true },
      );
      applied.push({ userId: uid, amountNgn });
    }
    return applied;
  } catch (err) {
    await rollbackSellerCredits(applied);
    throw err;
  }
}

export async function rollbackSellerCredits(
  applied: AppliedWalletCredit[],
): Promise<void> {
  for (const c of [...applied].reverse()) {
    await Wallet.updateOne({ userId: c.userId }, { $inc: { balanceNgn: -c.amountNgn } });
  }
}
