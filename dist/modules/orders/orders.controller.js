"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postSimulateCheckoutHandler = postSimulateCheckoutHandler;
exports.getProviderSalesByMonthHandler = getProviderSalesByMonthHandler;
exports.listMyOrdersHandler = listMyOrdersHandler;
exports.getMyOrderHandler = getMyOrderHandler;
exports.listMyReceiptsHandler = listMyReceiptsHandler;
exports.getMyReceiptByOrderHandler = getMyReceiptByOrderHandler;
const cart_service_1 = require("../cart/cart.service");
const orders_service_1 = require("./orders.service");
async function postSimulateCheckoutHandler(req, res) {
    try {
        if (!req.auth) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const result = await (0, orders_service_1.simulatePaystackCheckout)(req.auth.userId);
        res.status(201).json(result);
    }
    catch (err) {
        if (err instanceof orders_service_1.OrdersHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        if (err instanceof cart_service_1.CartHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        throw err;
    }
}
async function getProviderSalesByMonthHandler(req, res) {
    try {
        if (!req.auth) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const defaultYear = new Date().getUTCFullYear();
        let year = defaultYear;
        const rawYear = req.query.year;
        if (typeof rawYear === "string" && /^\d{4}$/.test(rawYear)) {
            const y = parseInt(rawYear, 10);
            if (y >= 2000 && y <= 2100) {
                year = y;
            }
        }
        const months = await (0, orders_service_1.getProviderSalesByMonth)(req.auth.userId, year);
        res.status(200).json({ year, months });
    }
    catch (err) {
        if (err instanceof orders_service_1.OrdersHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        throw err;
    }
}
async function listMyOrdersHandler(req, res) {
    try {
        if (!req.auth) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const orders = await (0, orders_service_1.listMyOrders)(req.auth.userId);
        res.status(200).json({ orders });
    }
    catch (err) {
        if (err instanceof orders_service_1.OrdersHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        throw err;
    }
}
async function getMyOrderHandler(req, res) {
    try {
        if (!req.auth) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const orderId = typeof req.params.orderId === "string" ? req.params.orderId : "";
        const order = await (0, orders_service_1.getMyOrderById)(req.auth.userId, orderId);
        res.status(200).json({ order });
    }
    catch (err) {
        if (err instanceof orders_service_1.OrdersHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        throw err;
    }
}
async function listMyReceiptsHandler(req, res) {
    try {
        if (!req.auth) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const receipts = await (0, orders_service_1.listMyReceipts)(req.auth.userId);
        res.status(200).json({ receipts });
    }
    catch (err) {
        if (err instanceof orders_service_1.OrdersHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        throw err;
    }
}
async function getMyReceiptByOrderHandler(req, res) {
    try {
        if (!req.auth) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const orderId = typeof req.params.orderId === "string" ? req.params.orderId : "";
        const receipt = await (0, orders_service_1.getMyReceiptByOrderId)(req.auth.userId, orderId);
        res.status(200).json({ receipt });
    }
    catch (err) {
        if (err instanceof orders_service_1.OrdersHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        throw err;
    }
}
