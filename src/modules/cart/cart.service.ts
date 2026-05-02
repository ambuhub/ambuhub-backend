import mongoose from "mongoose";
import { Cart } from "../../models/cart.model";
import { Service } from "../../models/service.model";
import { ServiceCategory } from "../../models/serviceCategory.model";
import type { ListingType } from "../services/services.service";

export class CartHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "CartHttpError";
  }
}

type PopulatedCategory = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  departments: { name: string; slug: string }[];
};

type LeanServiceForCart = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  listingType?: ListingType | null;
  stock?: number | null;
  price?: number | null;
  departmentSlug: string;
  photoUrls: unknown;
  serviceCategoryId: PopulatedCategory | null;
};

export type CartLineDto = {
  serviceId: string;
  quantity: number;
  title: string;
  listingType: ListingType | null;
  stock: number | null;
  price: number | null;
  departmentSlug: string;
  departmentName: string;
  category: { slug: string; name: string };
  photoUrls: string[];
  lineTotalNgn: number | null;
};

export type CartDto = {
  items: CartLineDto[];
};

function mapServiceToLineMeta(doc: LeanServiceForCart): Omit<CartLineDto, "quantity" | "lineTotalNgn"> {
  const cat = doc.serviceCategoryId;
  const deptSlug = doc.departmentSlug;
  let departmentName = deptSlug;
  let category = { slug: "unknown", name: "Unknown" };
  if (cat && typeof cat === "object" && "_id" in cat) {
    category = { slug: cat.slug, name: cat.name };
    const dept = cat.departments.find((d) => d.slug === deptSlug);
    if (dept) {
      departmentName = dept.name;
    }
  }
  const listingType = doc.listingType ?? null;
  const price = typeof doc.price === "number" ? doc.price : null;
  const stock = typeof doc.stock === "number" ? doc.stock : null;
  return {
    serviceId: doc._id.toString(),
    title: doc.title,
    listingType,
    stock,
    price,
    departmentSlug: doc.departmentSlug,
    departmentName,
    category,
    photoUrls: Array.isArray(doc.photoUrls) ? doc.photoUrls : [],
  };
}

async function loadSaleServiceForCart(
  serviceId: string,
  buyerUserId: string,
): Promise<LeanServiceForCart> {
  const trimmed = serviceId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new CartHttpError(400, "serviceId must be a valid ObjectId");
  }

  const doc = await Service.findById(trimmed)
    .populate<{ serviceCategoryId: PopulatedCategory | null }>(
      "serviceCategoryId",
      "name slug departments",
    )
    .lean();

  if (!doc) {
    throw new CartHttpError(404, "Service not found");
  }

  const lean = doc as LeanServiceForCart;
  if (lean.userId.toString() === buyerUserId) {
    throw new CartHttpError(400, "You cannot add your own listing to the cart");
  }

  if (lean.listingType !== "sale") {
    throw new CartHttpError(400, "Only sale listings can be added to the cart");
  }

  const price = typeof lean.price === "number" ? lean.price : null;
  const stock = typeof lean.stock === "number" ? lean.stock : null;

  if (price === null || price < 0) {
    throw new CartHttpError(400, "This sale listing does not have a valid price");
  }

  if (stock === null || stock < 1) {
    throw new CartHttpError(400, "This listing is out of stock");
  }

  return lean;
}

export async function getCart(userId: string): Promise<CartDto> {
  const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean();
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return { items: [] };
  }

  const lines: CartLineDto[] = [];
  for (const row of cart.items) {
    const sid = row.serviceId?.toString?.() ?? String(row.serviceId);
    try {
      const svc = await loadSaleServiceForCart(sid, userId);
      const meta = mapServiceToLineMeta(svc);
      const qty = typeof row.quantity === "number" && row.quantity >= 1 ? row.quantity : 1;
      const maxQty = meta.stock ?? 0;
      const clamped = Math.min(qty, maxQty);
      const price = meta.price ?? 0;
      lines.push({
        ...meta,
        quantity: clamped,
        lineTotalNgn: price * clamped,
      });
    } catch {
      // Stale cart reference (deleted service): skip in response; caller can sync cart later
      continue;
    }
  }

  return { items: lines };
}

export async function addCartItem(
  userId: string,
  serviceId: string,
  quantityRaw: unknown,
): Promise<CartDto> {
  const svc = await loadSaleServiceForCart(serviceId, userId);
  const stock = typeof svc.stock === "number" ? svc.stock : 0;

  let quantity = 1;
  if (quantityRaw !== undefined && quantityRaw !== null) {
    const n = typeof quantityRaw === "number" ? quantityRaw : Number(quantityRaw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      throw new CartHttpError(400, "quantity must be a positive integer");
    }
    quantity = n;
  }
  quantity = Math.min(quantity, stock);

  const uid = new mongoose.Types.ObjectId(userId);
  const sid = svc._id;

  const cart = await Cart.findOne({ userId: uid }).lean();
  type PlainItem = { serviceId: mongoose.Types.ObjectId; quantity: number };
  const items: PlainItem[] = (cart?.items ?? []).map((i) => ({
    serviceId: new mongoose.Types.ObjectId(String(i.serviceId)),
    quantity: Number(i.quantity),
  }));

  const idx = items.findIndex((i) => i.serviceId.equals(sid));
  if (idx >= 0) {
    const nextQty = Math.min(items[idx].quantity + quantity, stock);
    items[idx] = { serviceId: sid, quantity: nextQty };
  } else {
    items.push({ serviceId: sid, quantity });
  }

  await Cart.findOneAndUpdate(
    { userId: uid },
    { $set: { items } },
    { upsert: true },
  );

  return getCart(userId);
}

export async function setCartItemQuantity(
  userId: string,
  serviceId: string,
  quantityRaw: unknown,
): Promise<CartDto> {
  const trimmed = serviceId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new CartHttpError(400, "serviceId must be a valid ObjectId");
  }

  const n = typeof quantityRaw === "number" ? quantityRaw : Number(quantityRaw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw new CartHttpError(400, "quantity must be a positive integer");
  }

  const svc = await loadSaleServiceForCart(trimmed, userId);
  const stock = typeof svc.stock === "number" ? svc.stock : 0;
  const quantity = Math.min(n, stock);

  const uid = new mongoose.Types.ObjectId(userId);
  const cart = await Cart.findOne({ userId: uid }).lean();
  if (!cart) {
    throw new CartHttpError(404, "Cart is empty");
  }

  type PlainItem = { serviceId: mongoose.Types.ObjectId; quantity: number };
  const items: PlainItem[] = (cart.items ?? []).map((i) => ({
    serviceId: new mongoose.Types.ObjectId(String(i.serviceId)),
    quantity: Number(i.quantity),
  }));

  const idx = items.findIndex((i) => i.serviceId.toString() === trimmed);
  if (idx < 0) {
    throw new CartHttpError(404, "Item not in cart");
  }

  items[idx] = { serviceId: items[idx].serviceId, quantity };
  await Cart.findOneAndUpdate({ userId: uid }, { $set: { items } });

  return getCart(userId);
}

export async function removeCartItem(userId: string, serviceId: string): Promise<CartDto> {
  const trimmed = serviceId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new CartHttpError(400, "serviceId must be a valid ObjectId");
  }

  const uid = new mongoose.Types.ObjectId(userId);
  const cart = await Cart.findOne({ userId: uid }).lean();
  if (!cart) {
    return { items: [] };
  }

  type PlainItem = { serviceId: mongoose.Types.ObjectId; quantity: number };
  const items: PlainItem[] = (cart.items ?? [])
    .map((i) => ({
      serviceId: new mongoose.Types.ObjectId(String(i.serviceId)),
      quantity: Number(i.quantity),
    }))
    .filter((i) => i.serviceId.toString() !== trimmed);

  await Cart.findOneAndUpdate({ userId: uid }, { $set: { items } });

  return getCart(userId);
}

export type CartCheckoutLine = {
  serviceId: mongoose.Types.ObjectId;
  quantity: number;
  title: string;
  unitPriceNgn: number;
  lineTotalNgn: number;
  categoryName: string;
  categorySlug: string;
  departmentName: string;
};

/**
 * Validates cart and returns resolved lines for checkout (does not mutate).
 */
export async function resolveCartForCheckout(
  userId: string,
): Promise<{ lines: CartCheckoutLine[]; subtotalNgn: number }> {
  const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean();
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    throw new CartHttpError(400, "Your cart is empty");
  }

  const lines: CartCheckoutLine[] = [];
  let subtotal = 0;

  for (const row of cart.items) {
    const sid = row.serviceId?.toString?.() ?? String(row.serviceId);
    const svc = await loadSaleServiceForCart(sid, userId);
    const meta = mapServiceToLineMeta(svc);
    const stock = meta.stock ?? 0;
    const qtyRaw = typeof row.quantity === "number" && row.quantity >= 1 ? row.quantity : 1;
    const qty = Math.min(qtyRaw, stock);
    const unit = meta.price ?? 0;
    const lineTotal = unit * qty;
    subtotal += lineTotal;

    lines.push({
      serviceId: svc._id,
      quantity: qty,
      title: meta.title,
      unitPriceNgn: unit,
      lineTotalNgn: lineTotal,
      categoryName: meta.category.name,
      categorySlug: meta.category.slug,
      departmentName: meta.departmentName,
    });
  }

  if (lines.length === 0) {
    throw new CartHttpError(400, "Your cart is empty");
  }

  return { lines, subtotalNgn: subtotal };
}

export async function clearCart(userId: string): Promise<void> {
  await Cart.deleteOne({ userId: new mongoose.Types.ObjectId(userId) });
}

function randomReceiptSuffix(): string {
  const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 6; i += 1) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

export async function generateUniqueReceiptNumber(): Promise<string> {
  const { Order } = await import("../../models/order.model");
  const year = new Date().getUTCFullYear();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = `AMB-${year}-${randomReceiptSuffix()}`;
    const exists = await Order.exists({ receiptNumber: candidate });
    if (!exists) {
      return candidate;
    }
  }
  return `AMB-${year}-${Date.now().toString(36).toUpperCase()}`;
}

export function generateSimulatedPaystackReference(): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AMB_SIM_${t}_${r}`;
}
