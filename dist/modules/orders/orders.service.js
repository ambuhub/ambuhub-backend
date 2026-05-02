"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersHttpError = void 0;
exports.listMyOrders = listMyOrders;
exports.getMyOrderById = getMyOrderById;
exports.simulatePaystackCheckout = simulatePaystackCheckout;
exports.listMyReceipts = listMyReceipts;
exports.getMyReceiptByOrderId = getMyReceiptByOrderId;
exports.getProviderSalesByMonth = getProviderSalesByMonth;
const mongoose_1 = __importDefault(require("mongoose"));
const order_model_1 = require("../../models/order.model");
const receipt_model_1 = require("../../models/receipt.model");
const service_model_1 = require("../../models/service.model");
const cart_service_1 = require("../cart/cart.service");
const wallet_service_1 = require("../wallet/wallet.service");
class OrdersHttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "OrdersHttpError";
    }
}
exports.OrdersHttpError = OrdersHttpError;
function mapOrderSummary(doc) {
    return {
        id: doc._id.toString(),
        receiptNumber: doc.receiptNumber,
        subtotalNgn: doc.subtotalNgn,
        currency: doc.currency,
        paidAt: doc.paidAt.toISOString(),
        createdAt: doc.createdAt.toISOString(),
        lineCount: Array.isArray(doc.lines) ? doc.lines.length : 0,
    };
}
function mapOrderDetail(doc) {
    return {
        id: doc._id.toString(),
        receiptNumber: doc.receiptNumber,
        currency: doc.currency,
        subtotalNgn: doc.subtotalNgn,
        lines: doc.lines.map((l) => ({
            serviceId: l.serviceId.toString(),
            title: l.title,
            unitPriceNgn: l.unitPriceNgn,
            quantity: l.quantity,
            lineTotalNgn: l.lineTotalNgn,
            categoryName: l.categoryName,
            categorySlug: l.categorySlug,
            departmentName: l.departmentName,
        })),
        paymentProvider: doc.paymentProvider,
        paystackReference: doc.paystackReference,
        paystackSimulated: doc.paystackSimulated,
        paidAt: doc.paidAt.toISOString(),
        createdAt: doc.createdAt.toISOString(),
    };
}
async function listMyOrders(userId) {
    const rows = await order_model_1.Order.find({ userId: new mongoose_1.default.Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
    return rows.map((r) => mapOrderSummary(r));
}
async function getMyOrderById(userId, orderId) {
    const trimmed = orderId?.trim() ?? "";
    if (!trimmed || !mongoose_1.default.Types.ObjectId.isValid(trimmed)) {
        throw new OrdersHttpError(400, "orderId must be a valid ObjectId");
    }
    const doc = await order_model_1.Order.findOne({
        _id: new mongoose_1.default.Types.ObjectId(trimmed),
        userId: new mongoose_1.default.Types.ObjectId(userId),
    }).lean();
    if (!doc) {
        throw new OrdersHttpError(404, "Order not found");
    }
    return mapOrderDetail(doc);
}
async function simulatePaystackCheckout(userId) {
    const { lines, subtotalNgn } = await (0, cart_service_1.resolveCartForCheckout)(userId);
    const decremented = [];
    try {
        for (const line of lines) {
            const updated = await service_model_1.Service.findOneAndUpdate({
                _id: line.serviceId,
                listingType: "sale",
                stock: { $gte: line.quantity },
                userId: { $ne: new mongoose_1.default.Types.ObjectId(userId) },
            }, { $inc: { stock: -line.quantity } }, { new: true }).lean();
            if (!updated) {
                throw new OrdersHttpError(409, `Could not reserve stock for "${line.title}". It may have just sold out.`);
            }
            decremented.push({ serviceId: line.serviceId, qty: line.quantity });
        }
    }
    catch (err) {
        for (const d of decremented.reverse()) {
            await service_model_1.Service.updateOne({ _id: d.serviceId }, { $inc: { stock: d.qty } });
        }
        if (err instanceof OrdersHttpError) {
            throw err;
        }
        throw err;
    }
    const receiptNumber = await (0, cart_service_1.generateUniqueReceiptNumber)();
    const paystackReference = (0, cart_service_1.generateSimulatedPaystackReference)();
    const paidAt = new Date();
    const orderLines = lines.map((l) => ({
        serviceId: l.serviceId,
        title: l.title,
        unitPriceNgn: l.unitPriceNgn,
        quantity: l.quantity,
        lineTotalNgn: l.lineTotalNgn,
        categoryName: l.categoryName,
        categorySlug: l.categorySlug,
        departmentName: l.departmentName,
    }));
    let createdOrderId = null;
    let walletApplied = [];
    try {
        const orderDoc = await order_model_1.Order.create({
            userId: new mongoose_1.default.Types.ObjectId(userId),
            receiptNumber,
            currency: "NGN",
            subtotalNgn,
            lines: orderLines,
            paymentProvider: "paystack_simulated",
            paystackReference,
            paystackSimulated: true,
            paidAt,
        });
        createdOrderId = orderDoc._id;
        await receipt_model_1.Receipt.create({
            orderId: orderDoc._id,
            userId: new mongoose_1.default.Types.ObjectId(userId),
            receiptNumber,
            currency: "NGN",
            subtotalNgn,
            lines: orderLines.map((l) => ({
                serviceId: l.serviceId,
                title: l.title,
                unitPriceNgn: l.unitPriceNgn,
                quantity: l.quantity,
                lineTotalNgn: l.lineTotalNgn,
                categoryName: l.categoryName,
                departmentName: l.departmentName,
            })),
            paymentProvider: "paystack_simulated",
            paystackReference,
            issuedAt: paidAt,
        });
        walletApplied = await (0, wallet_service_1.creditSellersForCheckoutLines)(lines);
        await (0, cart_service_1.clearCart)(userId);
        const detail = mapOrderDetail(orderDoc.toObject());
        return {
            order: detail,
            message: "Payment simulated successfully. Paystack integration will replace this step later.",
        };
    }
    catch (err) {
        if (walletApplied.length > 0) {
            await (0, wallet_service_1.rollbackSellerCredits)(walletApplied);
        }
        for (const d of decremented.reverse()) {
            await service_model_1.Service.updateOne({ _id: d.serviceId }, { $inc: { stock: d.qty } });
        }
        if (createdOrderId) {
            await order_model_1.Order.deleteOne({ _id: createdOrderId });
            await receipt_model_1.Receipt.deleteOne({ orderId: createdOrderId });
        }
        if (err instanceof cart_service_1.CartHttpError) {
            throw new OrdersHttpError(err.statusCode, err.message);
        }
        throw err;
    }
}
async function listMyReceipts(userId) {
    const rows = await receipt_model_1.Receipt.find({ userId: new mongoose_1.default.Types.ObjectId(userId) })
        .sort({ issuedAt: -1 })
        .limit(100)
        .lean();
    return rows.map((r) => ({
        id: r._id.toString(),
        orderId: r.orderId.toString(),
        receiptNumber: r.receiptNumber,
        subtotalNgn: r.subtotalNgn,
        currency: r.currency,
        issuedAt: r.issuedAt.toISOString(),
    }));
}
async function getMyReceiptByOrderId(userId, orderId) {
    const trimmed = orderId?.trim() ?? "";
    if (!trimmed || !mongoose_1.default.Types.ObjectId.isValid(trimmed)) {
        throw new OrdersHttpError(400, "orderId must be a valid ObjectId");
    }
    const oid = new mongoose_1.default.Types.ObjectId(trimmed);
    const doc = await receipt_model_1.Receipt.findOne({
        orderId: oid,
        userId: new mongoose_1.default.Types.ObjectId(userId),
    }).lean();
    if (!doc) {
        throw new OrdersHttpError(404, "Receipt not found");
    }
    const lines = Array.isArray(doc.lines) ? doc.lines : [];
    return {
        id: doc._id.toString(),
        orderId: doc.orderId.toString(),
        receiptNumber: doc.receiptNumber,
        currency: doc.currency,
        subtotalNgn: doc.subtotalNgn,
        lines: lines.map((l) => ({
            serviceId: l.serviceId.toString(),
            title: l.title,
            unitPriceNgn: l.unitPriceNgn,
            quantity: l.quantity,
            lineTotalNgn: l.lineTotalNgn,
            categoryName: l.categoryName,
            departmentName: l.departmentName,
        })),
        paymentProvider: doc.paymentProvider,
        paystackReference: doc.paystackReference,
        issuedAt: doc.issuedAt.toISOString(),
    };
}
const PROVIDER_SALES_CHART_MONTHS = 8;
function utcYearMonth(d) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function rollingYearMonthsUtc(count) {
    const out = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        out.push(utcYearMonth(d));
    }
    return out;
}
function shortMonthLabelUtc(yearMonth) {
    const parts = yearMonth.split("-");
    const y = parseInt(parts[0] ?? "", 10);
    const m = parseInt(parts[1] ?? "", 10);
    if (!Number.isFinite(y) || !Number.isFinite(m)) {
        return yearMonth;
    }
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
        month: "short",
        timeZone: "UTC",
    });
}
/**
 * Sums order line totals (NGN) per calendar month (UTC) for lines whose service
 * is owned by the given provider.
 */
async function getProviderSalesByMonth(providerUserId) {
    const trimmed = providerUserId?.trim() ?? "";
    const buckets = rollingYearMonthsUtc(PROVIDER_SALES_CHART_MONTHS);
    const oldestYm = buckets[0];
    if (!oldestYm) {
        return [];
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(trimmed)) {
        return buckets.map((ym) => ({
            yearMonth: ym,
            label: shortMonthLabelUtc(ym),
            totalNgn: 0,
        }));
    }
    const providerOid = new mongoose_1.default.Types.ObjectId(trimmed);
    const serviceIds = await service_model_1.Service.find({ userId: providerOid }).distinct("_id");
    const [oy, om] = oldestYm.split("-").map((s) => parseInt(s, 10));
    const rangeStart = new Date(Date.UTC(oy, om - 1, 1, 0, 0, 0, 0));
    if (serviceIds.length === 0) {
        return buckets.map((ym) => ({
            yearMonth: ym,
            label: shortMonthLabelUtc(ym),
            totalNgn: 0,
        }));
    }
    const agg = await order_model_1.Order.aggregate([
        { $match: { paidAt: { $gte: rangeStart } } },
        { $unwind: "$lines" },
        { $match: { "lines.serviceId": { $in: serviceIds } } },
        {
            $group: {
                _id: {
                    $dateToString: { format: "%Y-%m", date: "$paidAt", timezone: "UTC" },
                },
                totalNgn: { $sum: "$lines.lineTotalNgn" },
            },
        },
    ]);
    const totals = new Map();
    for (const row of agg) {
        totals.set(row._id, typeof row.totalNgn === "number" ? row.totalNgn : 0);
    }
    return buckets.map((ym) => ({
        yearMonth: ym,
        label: shortMonthLabelUtc(ym),
        totalNgn: totals.get(ym) ?? 0,
    }));
}
