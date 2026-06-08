import type { Request, Response } from "express";
import { getWalletsForUser } from "./wallet.service";

export async function getMyWalletHandler(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const { wallets } = await getWalletsForUser(req.auth.userId);
  res.status(200).json({ wallets });
}
