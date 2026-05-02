"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCartHandler = getCartHandler;
exports.postCartItemHandler = postCartItemHandler;
exports.patchCartItemHandler = patchCartItemHandler;
exports.deleteCartItemHandler = deleteCartItemHandler;
const cart_service_1 = require("./cart.service");
async function getCartHandler(req, res) {
    try {
        if (!req.auth) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const cart = await (0, cart_service_1.getCart)(req.auth.userId);
        res.status(200).json({ cart });
    }
    catch (err) {
        if (err instanceof cart_service_1.CartHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        throw err;
    }
}
async function postCartItemHandler(req, res) {
    try {
        if (!req.auth) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const body = req.body;
        const serviceId = String(body.serviceId ?? "");
        const quantity = body.quantity;
        const cart = await (0, cart_service_1.addCartItem)(req.auth.userId, serviceId, quantity);
        res.status(200).json({ cart });
    }
    catch (err) {
        if (err instanceof cart_service_1.CartHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        throw err;
    }
}
async function patchCartItemHandler(req, res) {
    try {
        if (!req.auth) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const serviceId = typeof req.params.serviceId === "string" ? req.params.serviceId : "";
        const body = req.body;
        const cart = await (0, cart_service_1.setCartItemQuantity)(req.auth.userId, serviceId, body.quantity);
        res.status(200).json({ cart });
    }
    catch (err) {
        if (err instanceof cart_service_1.CartHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        throw err;
    }
}
async function deleteCartItemHandler(req, res) {
    try {
        if (!req.auth) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const serviceId = typeof req.params.serviceId === "string" ? req.params.serviceId : "";
        const cart = await (0, cart_service_1.removeCartItem)(req.auth.userId, serviceId);
        res.status(200).json({ cart });
    }
    catch (err) {
        if (err instanceof cart_service_1.CartHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        throw err;
    }
}
