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
exports.searchUniversities = exports.getUniversities = exports.createUniversity = void 0;
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
const searchUniversities = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const q = (req.query.q || '').trim();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const lat = parseFloat(req.query.lat) || null;
    const lng = parseFloat(req.query.lng) || null;
    try {
        let query;
        let params;
        if (q) {
            // Search by name with paging
            query = 'SELECT * FROM universities WHERE LOWER(name) LIKE LOWER($1) ORDER BY name LIMIT $2 OFFSET $3';
            params = [`%${q}%`, limit, offset];
        }
        else if (lat && lng) {
            // Sort by distance using Haversine formula (accurate for GPS coordinates)
            query = `SELECT *, 
                ( 6371 * acos( 
                    cos( radians($1) ) * cos( radians(latitude) ) * 
                    cos( radians(longitude) - radians($2) ) + 
                    sin( radians($1) ) * sin( radians(latitude) ) 
                )) as distance 
                FROM universities 
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL 
                ORDER BY distance 
                LIMIT $3 OFFSET $4`;
            params = [lat, lng, limit, offset];
        }
        else {
            query = 'SELECT * FROM universities ORDER BY name LIMIT $1 OFFSET $2';
            params = [limit, offset];
        }
        const result = yield db_1.default.query(query, params);
        // Get total count for paging metadata
        let countQuery;
        let countParams;
        if (q) {
            countQuery = 'SELECT COUNT(*) FROM universities WHERE LOWER(name) LIKE LOWER($1)';
            countParams = [`%${q}%`];
        }
        else {
            countQuery = 'SELECT COUNT(*) FROM universities';
            countParams = [];
        }
        const countResult = yield db_1.default.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);
        res.json({
            universities: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.searchUniversities = searchUniversities;
