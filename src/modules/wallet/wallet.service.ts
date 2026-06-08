import mongoose from "mongoose";
import { Wallet } from "../../models/wallet.model";
import { Service } from "../../models/service.model";
import {
  SUPPORTED_CURRENCIES,
  parseSupportedCurrency,
  type SupportedCurrency,
} from "../../shared/currency/types";
import type { CartCheckoutLine } from "../cart/cart.service";

export type WalletBalanceDto = {
  currency: SupportedCurrency;
  balance: number;
};

export type WalletsDto = {
  wallets: WalletBalanceDto[];
};

export type AppliedWalletCredit = {
  userId: mongoose.Types.ObjectId;
  amount: number;
  currency: SupportedCurrency;
};

export async function ensureWallet(userId: string): Promise<void> {
  const trimmed = userId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    return;
  }
  const uid = new mongoose.Types.ObjectId(trimmed);
  for (const currency of SUPPORTED_CURRENCIES) {
    await Wallet.findOneAndUpdate(
      { userId: uid, currency },
      { $setOnInsert: { userId: uid, balance: 0, currency } },
      { upsert: true },
    );
  }
}

export async function getWalletsForUser(userId: string): Promise<WalletsDto> {
  await ensureWallet(userId);
  const uid = new mongoose.Types.ObjectId(userId);
  const docs = await Wallet.find({ userId: uid }).lean();
  const byCurrency = new Map<string, number>();
  for (const doc of docs) {
    const raw = doc as {
      currency?: string;
      balance?: number;
      balanceNgn?: number;
    };
    const currency = parseSupportedCurrency(raw.currency, "NGN");
    const balance =
      typeof raw.balance === "number"
        ? raw.balance
        : typeof raw.balanceNgn === "number"
          ? raw.balanceNgn
          : null;
    if (balance !== null) {
      byCurrency.set(currency, balance);
    }
  }
  const wallets: WalletBalanceDto[] = SUPPORTED_CURRENCIES.map((currency) => ({
    currency,
    balance: byCurrency.get(currency) ?? 0,
  }));
  return { wallets };
}

/**
 * Credits each listing owner's wallet by summed line totals for that seller,
 * in the currency the checkout line was priced in.
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
    const key = `${sid}:${line.currency}`;
    totals.set(key, (totals.get(key) ?? 0) + line.lineTotal);
  }

  const applied: AppliedWalletCredit[] = [];

  try {
    for (const [key, amount] of totals) {
      if (!Number.isFinite(amount) || amount <= 0) {
        continue;
      }
      const separator = key.lastIndexOf(":");
      const sid = key.slice(0, separator);
      const currency = key.slice(separator + 1) as SupportedCurrency;
      const uid = new mongoose.Types.ObjectId(sid);
      await ensureWallet(sid);
      await Wallet.updateOne({ userId: uid, currency }, { $inc: { balance: amount } });
      applied.push({ userId: uid, amount, currency });
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
    await Wallet.updateOne(
      { userId: c.userId, currency: c.currency },
      { $inc: { balance: -c.amount } },
    );
  }
}
