"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureWallet = ensureWallet;
exports.getWalletForUser = getWalletForUser;
exports.creditSellersForCheckoutLines = creditSellersForCheckoutLines;
exports.rollbackSellerCredits = rollbackSellerCredits;
const mongoose_1 = __importDefault(require("mongoose"));
const wallet_model_1 = require("../../models/wallet.model");
const service_model_1 = require("../../models/service.model");
async function ensureWallet(userId) {
    const trimmed = userId?.trim() ?? "";
    if (!trimmed || !mongoose_1.default.Types.ObjectId.isValid(trimmed)) {
        return;
    }
    const uid = new mongoose_1.default.Types.ObjectId(trimmed);
    await wallet_model_1.Wallet.findOneAndUpdate({ userId: uid }, { $setOnInsert: { userId: uid, balanceNgn: 0, currency: "NGN" } }, { upsert: true });
}
async function getWalletForUser(userId) {
    await ensureWallet(userId);
    const w = await wallet_model_1.Wallet.findOne({
        userId: new mongoose_1.default.Types.ObjectId(userId),
    }).lean();
    return {
        balanceNgn: typeof w?.balanceNgn === "number" ? w.balanceNgn : 0,
        currency: typeof w?.currency === "string" ? w.currency : "NGN",
    };
}
/**
 * Credits each listing owner's wallet by summed line totals for that seller.
 * Returns credits applied for rollback on failure.
 */
async function creditSellersForCheckoutLines(lines) {
    const totals = new Map();
    for (const line of lines) {
        const svc = await service_model_1.Service.findById(line.serviceId).select("userId").lean();
        if (!svc?.userId) {
            throw new Error("Could not resolve seller for a checkout line");
        }
        const sid = svc.userId.toString();
        totals.set(sid, (totals.get(sid) ?? 0) + line.lineTotalNgn);
    }
    const applied = [];
    try {
        for (const [sid, amountNgn] of totals) {
            if (!Number.isFinite(amountNgn) || amountNgn <= 0) {
                continue;
            }
            const uid = new mongoose_1.default.Types.ObjectId(sid);
            await wallet_model_1.Wallet.updateOne({ userId: uid }, {
                $inc: { balanceNgn: amountNgn },
                $setOnInsert: { userId: uid, currency: "NGN" },
            }, { upsert: true });
            applied.push({ userId: uid, amountNgn });
        }
        return applied;
    }
    catch (err) {
        await rollbackSellerCredits(applied);
        throw err;
    }
}
async function rollbackSellerCredits(applied) {
    for (const c of [...applied].reverse()) {
        await wallet_model_1.Wallet.updateOne({ userId: c.userId }, { $inc: { balanceNgn: -c.amountNgn } });
    }
}
