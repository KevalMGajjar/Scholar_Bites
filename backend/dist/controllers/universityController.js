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
exports.getUniversities = exports.createUniversity = void 0;
const db_1 = __importDefault(require("../config/db"));
const createUniversity = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, address, logo_url } = req.body;
    try {
        const result = yield db_1.default.query('INSERT INTO universities (name, address, logo_url) VALUES ($1, $2, $3) RETURNING *', [name, address, logo_url]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ message: 'University already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});
exports.createUniversity = createUniversity;
const getUniversities = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield db_1.default.query('SELECT * FROM universities ORDER BY name');
        res.json(result.rows);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
exports.getUniversities = getUniversities;
