"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const restaurantController_1 = require("../controllers/restaurantController");
const router = (0, express_1.Router)();
// Public route to get restaurants for a specific university
router.get('/university/:university_id', restaurantController_1.getRestaurantsByUniversity);
// Admin route to create a new restaurant (simplified, missing auth middleware for now)
router.post('/', restaurantController_1.createRestaurant);
exports.default = router;
