"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Fallback to hardcoded if env fails, but prefer env
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/canteen_db';
const pool = new pg_1.Pool({
    connectionString,
    // Provide SSL config if we are connecting to a remote/AWS database
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});
exports.default = pool;
