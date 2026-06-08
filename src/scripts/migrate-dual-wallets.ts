/**
 * One-off: migrate wallets to dual NGN/GHS rows per provider.
 * Drops legacy userId-only unique index, syncs compound index, ensures both wallets exist.
 *
 * Usage: npm run migrate:dual-wallets
 *
 * Recommended full run order (once):
 *   npm run migrate:dual-wallets
 *   npm run migrate:native-amount-fields
 *   npm run migrate:order-line-seller-user-id
 *   npm run backfill:provider-wallets-from-orders
 */

import dotenv from "dotenv";
import { connectDatabase } from "../config/database";
import { migrateDualCurrencyWallets } from "../modules/wallet/migrateDualWallets";
import { logger } from "../shared/lib/logger";

dotenv.config();

async function main(): Promise<void> {
  await connectDatabase();
  await migrateDualCurrencyWallets();
  logger.info("migrate:dual-wallets finished");
  process.exit(0);
}

main().catch((error) => {
  logger.error("migrate:dual-wallets failed", { error });
  process.exit(1);
});
