import type { Request, Response } from "express";
import { isCloudinaryEnabled } from "../../config/cloudinary";
import {
  uploadServiceImagesToCloudinary,
  UploadHttpError,
} from "./uploads.service";

export async function postServiceImages(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    if (files.length === 0) {
      res.status(200).json({ urls: [] });
      return;
    }

    if (!isCloudinaryEnabled()) {
      res.status(503).json({
        message:
          "Image uploads are unavailable: Cloudinary is not configured on the server.",
      });
      return;
    }

    const urls = await uploadServiceImagesToCloudinary(files);
    res.status(200).json({ urls });
  } catch (err: unknown) {
    if (err instanceof UploadHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}
