import type { Request, Response } from "express";
import { getWalletForUser } from "./wallet.service";

export async function getMyWalletHandler(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const wallet = await getWalletForUser(req.auth.userId);
  res.status(200).json({ wallet });
}
