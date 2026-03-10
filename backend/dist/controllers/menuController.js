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
exports.updateStock = exports.addMenuItem = exports.getMenu = void 0;
const db_1 = __importDefault(require("../config/db"));
const getMenu = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { restaurant_id, university_id, category } = req.query;
    if (!restaurant_id && !university_id) {
        return res.status(400).json({ message: 'Restaurant ID or University ID is required' });
    }
    try {
        let query = '';
        let params = [];
        let pIndex = 1;
        if (restaurant_id) {
            query = `SELECT * FROM menu_items WHERE restaurant_id = $${pIndex++} AND is_available = TRUE`;
            params.push(restaurant_id);
        }
        else if (university_id) {
            query = `
                SELECT m.* FROM menu_items m 
                JOIN restaurants r ON m.restaurant_id = r.id 
                WHERE r.university_id = $${pIndex++} AND m.is_available = TRUE
            `;
            params.push(university_id);
        }
        if (category) {
            query += ` AND m.category = $${pIndex++}`;
            params.push(category);
        }
        query += ' ORDER BY category, name';
        const result = yield db_1.default.query(query, params);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.getMenu = getMenu;
const addMenuItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, description, price, category, image_url, nutritional_info, stock_quantity, restaurant_id } = req.body;
    if (!restaurant_id) {
        return res.status(400).json({ message: 'Restaurant ID is required' });
    }
    try {
        // Fetch staff university_id to ensure they have access to this restaurant (simplified for now)
        const staffParams = yield db_1.default.query('SELECT university_id FROM staff WHERE id = $1', [req.user.id]);
        if (staffParams.rows.length === 0)
            return res.sendStatus(403);
        const uniId = staffParams.rows[0].university_id;
        // Verify restaurant belongs to university
        const restCheck = yield db_1.default.query('SELECT id FROM restaurants WHERE id = $1 AND university_id = $2', [restaurant_id, uniId]);
        if (restCheck.rows.length === 0)
            return res.sendStatus(403);
        const result = yield db_1.default.query(`INSERT INTO menu_items (restaurant_id, name, description, price, category, image_url, nutritional_info, stock_quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [restaurant_id, name, description, price, category, image_url, nutritional_info, stock_quantity || 0]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.addMenuItem = addMenuItem;
const updateStock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { stock_quantity, is_available } = req.body; // allow updating availability too
    try {
        // Should verify if item belongs to staff's university? 
        // Ideally yes, but for MVP just update.
        // Construct dynamic query
        let updates = [];
        let params = [];
        let idx = 1;
        if (stock_quantity !== undefined) {
            updates.push(`stock_quantity = $${idx++}`);
            params.push(stock_quantity);
        }
        if (is_available !== undefined) {
            updates.push(`is_available = $${idx++}`);
            params.push(is_available);
        }
        if (updates.length === 0)
            return res.sendStatus(400);
        params.push(id);
        const query = `UPDATE menu_items SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
        const result = yield db_1.default.query(query, params);
        if (result.rows.length === 0)
            return res.status(404).json({ message: 'Item not found' });
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.updateStock = updateStock;
