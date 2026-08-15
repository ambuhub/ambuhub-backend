import type { Request, Response } from "express";
import { logger } from "../../shared/lib/logger";
import {
  ProviderDispatchAccountsHttpError,
  createDispatchAccount,
  listDispatchAccounts,
  listUnlinkedGroundAmbulances,
  setDispatchAccountDisabled,
} from "./dispatch-accounts.service";

export async function createDispatchAccountHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const account = await createDispatchAccount(req.auth.userId, {
      firstName: typeof body.firstName === "string" ? body.firstName : "",
      lastName: typeof body.lastName === "string" ? body.lastName : "",
      email: typeof body.email === "string" ? body.email : "",
      phone: typeof body.phone === "string" ? body.phone : "",
      countryCode: typeof body.countryCode === "string" ? body.countryCode : "",
      password: typeof body.password === "string" ? body.password : "",
      serviceId: typeof body.serviceId === "string" ? body.serviceId : "",
    });
    res.status(201).json({ account });
  } catch (err) {
    if (err instanceof ProviderDispatchAccountsHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("createDispatchAccount failed", { error: err });
    res.status(500).json({ message: "Could not create dispatch account" });
  }
}

export async function listDispatchAccountsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const accounts = await listDispatchAccounts(req.auth.userId);
    res.status(200).json({ accounts });
  } catch (err) {
    logger.error("listDispatchAccounts failed", { error: err });
    res.status(500).json({ message: "Could not load dispatch accounts" });
  }
}

export async function listUnlinkedGroundAmbulancesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const services = await listUnlinkedGroundAmbulances(req.auth.userId);
    res.status(200).json({ services });
  } catch (err) {
    logger.error("listUnlinkedGroundAmbulances failed", { error: err });
    res.status(500).json({ message: "Could not load listings" });
  }
}

export async function patchDispatchAccountHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const body = req.body as Record<string, unknown>;
    if (typeof body.isDisabled !== "boolean") {
      res.status(400).json({ message: "isDisabled must be a boolean" });
      return;
    }
    const account = await setDispatchAccountDisabled(
      req.auth.userId,
      id,
      body.isDisabled,
    );
    res.status(200).json({ account });
  } catch (err) {
    if (err instanceof ProviderDispatchAccountsHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("patchDispatchAccount failed", { error: err });
    res.status(500).json({ message: "Could not update dispatch account" });
  }
}
