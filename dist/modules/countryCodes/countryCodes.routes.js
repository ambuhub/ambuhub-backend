"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const countryCodes_controller_1 = require("./countryCodes.controller");
const router = (0, express_1.Router)();
router.get("/:code", countryCodes_controller_1.getVerifyCountryCode);
exports.default = router;
