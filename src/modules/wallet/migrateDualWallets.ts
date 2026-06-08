import { ServiceProvider } from "../../models/serviceProvider.model";
import { Wallet } from "../../models/wallet.model";
import { logger } from "../../shared/lib/logger";
import { ensureWallet } from "./wallet.service";

/**
 * One-time migration: drop legacy userId-only unique index, sync compound index,
 * and ensure every provider has both NGN and GHS wallet rows.
 */
export async function migrateDualCurrencyWallets(): Promise<void> {
  const collection = Wallet.collection;
  const indexes = await collection.indexes();

  for (const idx of indexes) {
    const key = idx.key as Record<string, unknown> | undefined;
    if (
      idx.unique &&
      key &&
      key.userId === 1 &&
      key.currency === undefined &&
      idx.name
    ) {
      await collection.dropIndex(idx.name);
      logger.info("Dropped legacy wallet userId unique index", { name: idx.name });
    }
  }

  await Wallet.syncIndexes();

  const providers = await ServiceProvider.find().select("userId").lean();
  for (const provider of providers) {
    if (provider.userId) {
      await ensureWallet(provider.userId.toString());
    }
  }

  logger.info("Dual currency wallet migration complete", {
    providers: providers.length,
  });
}
