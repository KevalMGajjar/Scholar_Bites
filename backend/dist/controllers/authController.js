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
exports.updateUniversity = exports.registerOtp = exports.loginOtp = void 0;
const db_1 = __importDefault(require("../config/db"));
const jwt_1 = require("../utils/jwt");
const loginOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { phone } = req.body;
    try {
        let result = yield db_1.default.query(`SELECT u.*, uni.name as university_name 
             FROM users u 
             LEFT JOIN universities uni ON u.university_id = uni.id 
             WHERE u.phone = $1`, [phone]);
        let user = result.rows[0];
        let role = 'student';
        // Check if staff
        if (!user) {
            result = yield db_1.default.query(`SELECT s.*, uni.name as university_name
                 FROM staff s
                 LEFT JOIN universities uni ON s.university_id = uni.id
                 WHERE s.phone = $1`, [phone]);
            user = result.rows[0];
            if (user)
                role = user.role;
        }
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const token = (0, jwt_1.generateToken)({ id: user.id, phone: user.phone, role });
        res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, university_id: user.university_id, university_name: user.university_name, role } });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.loginOtp = loginOtp;
const registerOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { phone, university_id } = req.body;
    try {
        const name = `Student ${phone}`;
        const result = yield db_1.default.query('INSERT INTO users (name, university_id, phone) VALUES ($1, $2, $3) RETURNING id, name, phone, university_id', [name, university_id, phone]);
        const user = result.rows[0];
        // Fetch university name
        const uniResult = yield db_1.default.query('SELECT name FROM universities WHERE id = $1', [university_id]);
        const universityName = ((_a = uniResult.rows[0]) === null || _a === void 0 ? void 0 : _a.name) || '';
        const token = (0, jwt_1.generateToken)({ id: user.id, phone: user.phone, role: 'student' });
        res.status(201).json({ token, user: Object.assign(Object.assign({}, user), { university_name: universityName, role: 'student' }) });
    }
    catch (error) {
        console.error(error);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Phone number already registered' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});
exports.registerOtp = registerOtp;
const updateUniversity = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { phone, university_id } = req.body;
    try {
        const result = yield db_1.default.query(`UPDATE users SET university_id = $1 WHERE phone = $2 RETURNING id, name, phone, university_id`, [university_id, phone]);
        const user = result.rows[0];
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const uniResult = yield db_1.default.query('SELECT name FROM universities WHERE id = $1', [university_id]);
        const universityName = ((_a = uniResult.rows[0]) === null || _a === void 0 ? void 0 : _a.name) || '';
        const token = (0, jwt_1.generateToken)({ id: user.id, phone: user.phone, role: 'student' });
        res.json({ token, user: Object.assign(Object.assign({}, user), { university_name: universityName, role: 'student' }) });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.updateUniversity = updateUniversity;
