"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRestaurant = exports.getRestaurantsByUniversity = void 0;
const db_1 = __importDefault(require("../config/db"));
const getRestaurantsByUniversity = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { university_id } = req.params;
    if (!university_id) {
        return res.status(400).json({ message: 'University ID is required' });
    }
    try {
        const query = 'SELECT * FROM restaurants WHERE university_id = $1 AND is_open = TRUE ORDER BY rating DESC, name';
        const result = yield db_1.default.query(query, [university_id]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching restaurants:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.getRestaurantsByUniversity = getRestaurantsByUniversity;
const createRestaurant = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { university_id, name, logo_url, cover_url, rating, tags, is_open } = req.body;
    if (!university_id || !name) {
        return res.status(400).json({ message: 'University ID and name are required' });
    }
    try {
        const result = yield db_1.default.query(`INSERT INTO restaurants (university_id, name, logo_url, cover_url, rating, tags, is_open) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [university_id, name, logo_url, cover_url, rating || 0.0, tags || [], is_open !== null && is_open !== void 0 ? is_open : true]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Error creating restaurant:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.createRestaurant = createRestaurant;
