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
exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const db_1 = __importDefault(require("../config/db"));
const jwt_1 = require("../utils/jwt");
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, email, password, university_id, phone } = req.body;
    try {
        const hashedPassword = yield bcrypt_1.default.hash(password, 10);
        const result = yield db_1.default.query('INSERT INTO users (name, email, password_hash, university_id, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role', [name, email, hashedPassword, university_id, phone]);
        const user = result.rows[0];
        // Default role for students is null or we can infer it. 
        // Wait, role is in 'staff' table. Users table doesn't have role.
        // So token should probably indicate 'student' or check if user is staff.
        // For now, let's assume 'student' if not in staff table. 
        // But payload needs role for RBAC.
        // Let's standardise token payload: { id, email, role }
        // Users = 'student'
        const token = (0, jwt_1.generateToken)({ id: user.id, email: user.email, role: 'student' });
        res.status(201).json({ token, user: Object.assign(Object.assign({}, user), { role: 'student' }) });
    }
    catch (error) {
        console.error(error);
        if (error.code === '23505') { // unique violation
            return res.status(409).json({ message: 'Email already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});
exports.register = register;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    try {
        // Check Users table first
        let result = yield db_1.default.query('SELECT * FROM users WHERE email = $1', [email]);
        let user = result.rows[0];
        let role = 'student';
        if (!user) {
            // Check Staff table
            result = yield db_1.default.query('SELECT * FROM staff WHERE email = $1', [email]);
            user = result.rows[0];
            if (user) {
                role = user.role;
            }
        }
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const isValid = yield bcrypt_1.default.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = (0, jwt_1.generateToken)({ id: user.id, email: user.email, role });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role } });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.login = login;
