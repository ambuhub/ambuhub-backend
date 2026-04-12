import { getCloudinary } from "../../config/cloudinary";

export class UploadHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "UploadHttpError";
  }
}

const MAX_FILES = 10;
const MAX_BYTES = 5 * 1024 * 1024;

export { MAX_BYTES, MAX_FILES };

export async function uploadServiceImagesToCloudinary(
  files: Express.Multer.File[]
): Promise<string[]> {
  const cloudinary = getCloudinary();
  const urls: string[] = [];

  for (const file of files) {
    if (!file.mimetype.startsWith("image/")) {
      throw new UploadHttpError(400, "Only image files are allowed");
    }
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "services-images",
      resource_type: "image",
    });
    if (result.secure_url) {
      urls.push(result.secure_url);
    }
  }

  return urls;
}
