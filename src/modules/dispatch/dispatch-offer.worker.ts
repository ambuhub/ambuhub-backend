import { processExpiredDispatchOffers } from "./dispatch.service";
import { logger } from "../../shared/lib/logger";

export async function processDispatchOfferExpiry(): Promise<void> {
  const processed = await processExpiredDispatchOffers();
  if (processed > 0) {
    logger.info("Processed expired dispatch offers", { processed });
  }
}
