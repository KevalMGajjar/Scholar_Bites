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
exports.updateOrderStatus = exports.getPendingOrders = exports.getMyOrders = exports.verifyPayment = exports.createOrder = void 0;
const db_1 = __importDefault(require("../config/db"));
const razorpay_1 = __importDefault(require("../config/razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const socketService_1 = require("../services/socketService");
const createOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { items, university_id } = req.body; // items: [{ menu_item_id, quantity }]
    const user_id = req.user.id;
    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'No items provided' });
    }
    const client = yield db_1.default.connect();
    try {
        yield client.query('BEGIN');
        // 1. Calculate Total Amount
        let totalAmount = 0;
        const orderItemsData = [];
        for (const item of items) {
            const result = yield client.query('SELECT price, is_available FROM menu_items WHERE id = $1', [item.menu_item_id]);
            const menuItem = result.rows[0];
            if (!menuItem || !menuItem.is_available) {
                throw new Error(`Item ${item.menu_item_id} not available`);
            }
            const price = parseFloat(menuItem.price);
            totalAmount += price * item.quantity;
            orderItemsData.push(Object.assign(Object.assign({}, item), { price }));
        }
        // 2. Create Razorpay Order
        const razorpayOrder = yield razorpay_1.default.orders.create({
            amount: Math.round(totalAmount * 100), // amount in paisa
            currency: 'INR',
            receipt: `order_${Date.now()}`,
        });
        // 3. Create Database Order
        // Note: Using razorpay_order_id as payment_id initially
        const orderId = razorpayOrder.id;
        const insertOrderQuery = `
            INSERT INTO orders (user_id, university_id, status, total_amount, payment_id)
            VALUES ($1, $2, 'pending', $3, $4)
            RETURNING id
        `;
        const orderResult = yield client.query(insertOrderQuery, [user_id, university_id, totalAmount, orderId]);
        const dbOrderId = orderResult.rows[0].id;
        // 4. Create Order Items
        for (const item of orderItemsData) {
            yield client.query('INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)', [dbOrderId, item.menu_item_id, item.quantity, item.price]);
        }
        yield client.query('COMMIT');
        res.status(201).json({
            id: dbOrderId,
            payment_id: orderId, // Razorpay Order ID
            amount: totalAmount,
            currency: 'INR',
            items: orderItemsData
        });
    }
    catch (error) {
        yield client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
    finally {
        client.release();
    }
});
exports.createOrder = createOrder;
const verifyPayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    try {
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto_1.default
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');
        if (expectedSignature === razorpay_signature) {
            // Payment successful
            const result = yield db_1.default.query("UPDATE orders SET status = 'preparing', updated_at = NOW() WHERE payment_id = $1 RETURNING *", [razorpay_order_id]);
            const order = result.rows[0];
            // Emit to Staff
            if (order) {
                (0, socketService_1.emitNewOrder)(order.university_id, order);
            }
            res.json({ status: 'success', order });
        }
        else {
            res.status(400).json({ status: 'failure', message: 'Invalid signature' });
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.verifyPayment = verifyPayment;
const getMyOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield db_1.default.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
        res.json(result.rows);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
exports.getMyOrders = getMyOrders;
const getPendingOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Staff only. Ideally fetch by university_id (from staff's university)
    // We assume staff is from a specific university. 
    // Need to fetch staff's university_id first.
    try {
        const staffRes = yield db_1.default.query('SELECT university_id FROM staff WHERE id = $1', [req.user.id]);
        if (staffRes.rows.length === 0)
            return res.sendStatus(403);
        const uniId = staffRes.rows[0].university_id;
        const result = yield db_1.default.query("SELECT * FROM orders WHERE university_id = $1 AND status != 'completed' AND status != 'cancelled' ORDER BY created_at ASC", [uniId]);
        res.json(result.rows);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
exports.getPendingOrders = getPendingOrders;
const updateOrderStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const result = yield db_1.default.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, id]);
        const order = result.rows[0];
        if (!order)
            return res.status(404).json({ message: 'Order not found' });
        // Emit to user
        (0, socketService_1.emitStatusUpdate)(order.user_id, order);
        res.json(order);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
exports.updateOrderStatus = updateOrderStatus;
