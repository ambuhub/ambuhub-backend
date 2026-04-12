"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTH_COOKIE_NAME = void 0;
exports.setAuthCookie = setAuthCookie;
exports.clearAuthCookie = clearAuthCookie;
exports.AUTH_COOKIE_NAME = "ambuhub_access_token";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const baseCookieOptions = {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
};
function setAuthCookie(res, token) {
    res.cookie(exports.AUTH_COOKIE_NAME, token, {
        ...baseCookieOptions,
        maxAge: SEVEN_DAYS_MS,
    });
}
function clearAuthCookie(res) {
    res.clearCookie(exports.AUTH_COOKIE_NAME, {
        ...baseCookieOptions,
    });
}
