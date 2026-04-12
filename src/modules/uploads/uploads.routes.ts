import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import {
  authenticate,
  requireServiceProvider,
} from "../../shared/middlewares/authenticate";
import { MAX_BYTES, MAX_FILES } from "./uploads.service";
import { postServiceImages } from "./uploads.controller";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_FILES,
    fileSize: MAX_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

function handleServiceImagesUpload(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  upload.array("images", MAX_FILES)(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ message: "Each image must be 5MB or smaller" });
        return;
      }
      if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
        res.status(400).json({ message: err.message });
        return;
      }
      res.status(400).json({ message: err.message });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ message: err.message });
      return;
    }
    next();
  });
}

router.post(
  "/service-images",
  authenticate,
  requireServiceProvider,
  handleServiceImagesUpload,
  postServiceImages
);

export default router;
