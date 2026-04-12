"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const router = (0, express_1.Router)();
router.post("/register", auth_controller_1.registerHandler);
router.post("/login", auth_controller_1.loginHandler);
router.post("/logout", auth_controller_1.logoutHandler);
exports.default = router;
