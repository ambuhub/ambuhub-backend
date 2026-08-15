import type { Request, Response } from "express";
import {
  DispatchHttpError,
  acceptDispatchRequest,
  cancelDispatchRequest,
  createDispatchRequest,
  getActiveClientDispatchRequest,
  getClientDispatchHistory,
  getDispatchRequestById,
  getDispatchRoute,
  getDispatchUserPendingOffer,
  getDispatchUserRequests,
  getProviderPendingOffer,
  getProviderDispatchRequests,
  listDispatchUserServices,
  listProviderDispatchServices,
  markDispatchArrived,
  rejectDispatchRequest,
  updateServiceDispatchStatus,
  updateServiceLiveLocation,
} from "./dispatch.service";

function handleDispatchError(err: unknown, res: Response): boolean {
  if (err instanceof DispatchHttpError) {
    res.status(err.statusCode).json({
      message: err.message,
      ...err.extra,
    });
    return true;
  }
  return false;
}

export async function postDispatchRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const locationSource =
      body.locationSource === "address" ? "address" : "current_location";

    const request = await createDispatchRequest(req.auth.userId, {
      locationSource,
      latitude:
        typeof body.latitude === "number" ? body.latitude : undefined,
      longitude:
        typeof body.longitude === "number" ? body.longitude : undefined,
      address: typeof body.address === "string" ? body.address : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      contactPhone:
        typeof body.contactPhone === "string" ? body.contactPhone : undefined,
    });

    res.status(201).json({ request });
  } catch (err) {
    if (handleDispatchError(err, res)) {
      return;
    }
    throw err;
  }
}

export async function getActiveDispatchRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const request = await getActiveClientDispatchRequest(req.auth.userId);
    res.status(200).json({ request });
  } catch (err) {
    if (handleDispatchError(err, res)) {
      return;
    }
    throw err;
  }
}

export async function getDispatchHistoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const requests = await getClientDispatchHistory(req.auth.userId);
    res.status(200).json({ requests });
  } catch (err) {
    if (handleDispatchError(err, res)) {
      return;
    }
    throw err;
  }
}

export async function getDispatchRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const requestId = String(req.params.id ?? "");
    const request = await getDispatchRequestById(
      req.auth.userId,
      req.auth.role,
      requestId,
    );
    res.status(200).json({ request });
  } catch (err) {
    if (handleDispatchError(err, res)) {
      return;
    }
    throw err;
  }
}

export async function cancelDispatchRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const requestId = String(req.params.id ?? "");
    const request = await cancelDispatchRequest(req.auth.userId, requestId);
    res.status(200).json({ request });
  } catch (err) {
    if (handleDispatchError(err, res)) {
      return;
    }
    throw err;
  }
}

export async function getProviderOfferHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const offer = await getProviderPendingOffer(req.auth.userId);
    res.status(200).json({ offer });
  } catch (err) {
    if (handleDispatchError(err, res)) {
      return;
    }
    throw err;
  }
}

export async function getProviderDispatchRequestsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const requests = await getProviderDispatchRequests(req.auth.userId);
    res.status(200).json({ requests });
  } catch (err) {
    if (handleDispatchError(err, res)) {
      return;
    }
    throw err;
  }
}

export async function acceptDispatchRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const requestId = String(req.params.id ?? "");
    const request = await acceptDispatchRequest(req.auth.userId, requestId);
    res.status(200).json({ request });
  } catch (err) {
    if (handleDispatchError(err, res)) {
      return;
    }
    throw err;
  }
}

export async function rejectDispatchRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const requestId = String(req.params.id ?? "");
    const request = await rejectDispatchRequest(req.auth.userId, requestId);
    res.status(200).json({ request });
  } catch (err) {
    if (handleDispatchError(err, res)) {
      return;
    }
    throw err;
  }
}

export async function markDispatchArrivedHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const requestId = String(req.params.id ?? "");
    const request = await markDispatchArrived(req.auth.userId, requestId);
    res.status(200).json({ request });
  } catch (err) {
    if (handleDispatchError(err, res)) {
      return;
    }
    throw err;
  }
}

export async function patchServiceDispatchHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const serviceId = String(req.params.serviceId ?? "");
    const body = req.body as Record<string, unknown>;
    const dispatchEnabled = body.dispatchEnabled === true;
    const latitude =
      typeof body.latitude === "number" ? body.latitude : Number.NaN;
    const longitude =
      typeof body.longitude === "number" ? body.longitude : Number.NaN;
    const location =
      dispatchEnabled && Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { latitude, longitude }
        : undefined;

    const result = await updateServiceDispatchStatus(
      req.auth.userId,
      serviceId,
      dispatchEnabled,
      location,
    );
    res.status(200).json(result);
  } catch (err) {
    if (handleDispatchError(err, res)) {
      return;
    }
    throw err;
  }
}

export async function patchServiceLocationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const serviceId = String(req.params.serviceId ?? "");
    const body = req.body as Record<string, unknown>;
    const latitude =
      typeof body.latitude === "number" ? body.latitude : Number.NaN;
    const longitude =
      typeof body.longitude === "number" ? body.longitude : Number.NaN;

    await updateServiceLiveLocation(
      req.auth.userId,
      serviceId,
      latitude,
      longitude,
    );
    res.status(204).send();
  } catch (err) {
    if (handleDispatchError(err, res)) {
      return;
    }
    throw err;
  }
}

export async function getProviderDispatchServicesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const services = await listProviderDispatchServices(req.auth.userId);
    res.status(200).json({ services });
  } catch (err) {
    if (handleDispatchError(err, res)) {
      return;
    }
    throw err;
  }
}

export async function getDispatchUserOfferHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const offer = await getDispatchUserPendingOffer(req.auth.userId);
    res.status(200).json({ offer });
  } catch (err) {
    if (handleDispatchError(err, res)) {
      return;
    }
    throw err;
  }
}

export async function getDispatchUserRequestsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const requests = await getDispatchUserRequests(req.auth.userId);
    res.status(200).json({ requests });
  } catch (err) {
    if (handleDispatchError(err, res)) {
      return;
    }
    throw err;
  }
}

export async function getDispatchUserServicesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const services = await listDispatchUserServices(req.auth.userId);
    res.status(200).json({ services });
  } catch (err) {
    if (handleDispatchError(err, res)) {
      return;
    }
    throw err;
  }
}

export async function getDispatchRouteHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const requestId = String(req.params.id ?? "");
    const route = await getDispatchRoute(
      req.auth.userId,
      req.auth.role,
      requestId,
    );
    res.status(200).json({ route });
  } catch (err) {
    if (handleDispatchError(err, res)) {
      return;
    }
    throw err;
  }
}
