"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const universityRoutes_1 = __importDefault(require("./routes/universityRoutes"));
const menuRoutes_1 = __importDefault(require("./routes/menuRoutes"));
const orderRoutes_1 = __importDefault(require("./routes/orderRoutes"));
const lobbyRoutes_1 = __importDefault(require("./routes/lobbyRoutes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/university', universityRoutes_1.default);
app.use('/api/menu', menuRoutes_1.default);
app.use('/api/orders', orderRoutes_1.default);
app.use('/api/lobby', lobbyRoutes_1.default);
app.get('/', (req, res) => {
    res.send('University Canteen API is running');
});
exports.default = app;
