"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authenticate_1 = require("../../shared/middlewares/authenticate");
const wallet_controller_1 = require("./wallet.controller");
const router = (0, express_1.Router)();
router.use(authenticate_1.authenticate, authenticate_1.requireServiceProvider);
router.get("/me", wallet_controller_1.getMyWalletHandler);
exports.default = router;
