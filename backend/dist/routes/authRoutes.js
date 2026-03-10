"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const router = (0, express_1.Router)();
router.post('/login-otp', authController_1.loginOtp);
router.post('/register-otp', authController_1.registerOtp);
router.post('/update-university', authController_1.updateUniversity);
exports.default = router;
