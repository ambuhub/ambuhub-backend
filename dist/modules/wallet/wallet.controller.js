"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyWalletHandler = getMyWalletHandler;
const wallet_service_1 = require("./wallet.service");
async function getMyWalletHandler(req, res) {
    if (!req.auth) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const wallet = await (0, wallet_service_1.getWalletForUser)(req.auth.userId);
    res.status(200).json({ wallet });
}
