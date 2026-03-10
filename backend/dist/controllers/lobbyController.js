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
exports.verifyShare = exports.payShare = exports.lockLobby = exports.addItemToLobby = exports.joinLobby = exports.createLobby = void 0;
const db_1 = __importDefault(require("../config/db"));
const uuid_1 = require("uuid");
const socketService_1 = require("../services/socketService");
const razorpay_1 = __importDefault(require("../config/razorpay"));
const crypto_1 = __importDefault(require("crypto"));
// Helper to generate 6-char code
const generateCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};
const createLobby = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    try {
        const code = generateCode();
        const result = yield db_1.default.query("INSERT INTO group_orders (code, creator_id, status) VALUES ($1, $2, 'open') RETURNING *", [code, userId]);
        const groupOrder = result.rows[0];
        // Add creator as member
        yield db_1.default.query("INSERT INTO group_order_members (group_order_id, user_id, share_amount, payment_status) VALUES ($1, $2, 0, 'pending')", [groupOrder.id, userId]);
        res.status(201).json(groupOrder);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.createLobby = createLobby;
const joinLobby = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { code } = req.body;
    const userId = req.user.id;
    try {
        const groupRes = yield db_1.default.query("SELECT * FROM group_orders WHERE code = $1 AND status = 'open'", [code]);
        if (groupRes.rows.length === 0)
            return res.status(404).json({ message: 'Lobby not found or locked' });
        const groupOrder = groupRes.rows[0];
        // Check if already joined
        const memberCheck = yield db_1.default.query('SELECT * FROM group_order_members WHERE group_order_id = $1 AND user_id = $2', [groupOrder.id, userId]);
        if (memberCheck.rows.length === 0) {
            yield db_1.default.query("INSERT INTO group_order_members (group_order_id, user_id, share_amount, payment_status) VALUES ($1, $2, 0, 'pending')", [groupOrder.id, userId]);
            (0, socketService_1.emitGroupUpdate)(code, 'member_joined', { userId });
        }
        res.json({ message: 'Joined lobby', groupOrder });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
exports.joinLobby = joinLobby;
const addItemToLobby = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { code, menu_item_id, quantity, is_shared } = req.body;
    const userId = req.user.id;
    // Logic:
    // Find Group Order.
    // Find or Create valid "Temp" Order record in `orders` table.
    // IF is_shared: user_id = NULL
    // ELSE: user_id = userId
    // Add item to `order_items`.
    try {
        const groupRes = yield db_1.default.query('SELECT * FROM group_orders WHERE code = $1', [code]);
        if (groupRes.rows.length === 0)
            return res.status(404).json({ message: 'Lobby not found' });
        const groupOrder = groupRes.rows[0];
        if (groupOrder.status !== 'open')
            return res.status(400).json({ message: 'Lobby is locked' });
        // Get Price
        const itemRes = yield db_1.default.query('SELECT price FROM menu_items WHERE id = $1', [menu_item_id]);
        if (itemRes.rows.length === 0)
            return res.status(404).json({ message: 'Item not found' });
        const price = itemRes.rows[0].price;
        // Find existing Cart Order
        let orderQuery = 'SELECT id, total_amount FROM orders WHERE group_order_id = $1 AND status = \'pending\' AND ';
        let orderParams = [groupOrder.id];
        if (is_shared) {
            orderQuery += 'user_id IS NULL';
        }
        else {
            orderQuery += 'user_id = $2';
            orderParams.push(userId);
        }
        let orderRes = yield db_1.default.query(orderQuery, orderParams);
        let orderId;
        if (orderRes.rows.length === 0) {
            // Create New Temp Order
            const paymentId = `TEMP_${(0, uuid_1.v4)()}`;
            // Need University ID via user or group creator.
            // Let's get it from any available source or passed in. 
            // For now, assume passed or fetch from menu_item's university (safest).
            const uniRes = yield db_1.default.query('SELECT university_id FROM menu_items WHERE id = $1', [menu_item_id]);
            const universityId = uniRes.rows[0].university_id;
            const insertQ = `INSERT INTO orders (user_id, university_id, group_order_id, status, total_amount, payment_id) 
                             VALUES ($1, $2, $3, 'pending', 0, $4) RETURNING id`;
            const insertParams = [is_shared ? null : userId, universityId, groupOrder.id, paymentId];
            const insertRes = yield db_1.default.query(insertQ, insertParams);
            orderId = insertRes.rows[0].id;
        }
        else {
            orderId = orderRes.rows[0].id;
        }
        // Add Item
        yield db_1.default.query('INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)', [orderId, menu_item_id, quantity, price]);
        // Update Total
        yield db_1.default.query('UPDATE orders SET total_amount = total_amount + $1 WHERE id = $2', [price * quantity, orderId]);
        (0, socketService_1.emitGroupUpdate)(code, 'item_added', { userId, menu_item_id, quantity, is_shared });
        res.json({ message: 'Item added' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.addItemToLobby = addItemToLobby;
const lockLobby = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { code } = req.body;
    const userId = req.user.id;
    try {
        const client = yield db_1.default.connect();
        try {
            yield client.query('BEGIN');
            const groupRes = yield client.query('SELECT * FROM group_orders WHERE code = $1', [code]);
            if (groupRes.rows.length === 0)
                throw new Error('Lobby not found');
            const groupOrder = groupRes.rows[0];
            if (groupOrder.creator_id !== userId && req.user.role !== 'admin') {
                throw new Error('Only creator can lock lobby');
            }
            // Calculate Splits
            // 1. Get Shared Total
            const sharedRes = yield client.query("SELECT SUM(total_amount) as total FROM orders WHERE group_order_id = $1 AND user_id IS NULL", [groupOrder.id]);
            const sharedTotal = parseFloat(sharedRes.rows[0].total || '0');
            // 2. Get Members
            const membersRes = yield client.query('SELECT user_id FROM group_order_members WHERE group_order_id = $1', [groupOrder.id]);
            const members = membersRes.rows;
            const n_members = members.length;
            if (n_members === 0)
                throw new Error('No members');
            const sharedSplit = sharedTotal / n_members;
            // 3. Update each member
            let totalGroupBill = 0;
            for (const member of members) {
                // Get Personal Total
                const personalRes = yield client.query("SELECT SUM(total_amount) as total FROM orders WHERE group_order_id = $1 AND user_id = $2", [groupOrder.id, member.user_id]);
                const personalTotal = parseFloat(personalRes.rows[0].total || '0');
                const finalShare = sharedSplit + personalTotal;
                totalGroupBill += finalShare;
                yield client.query('UPDATE group_order_members SET share_amount = $1 WHERE group_order_id = $2 AND user_id = $3', [finalShare, groupOrder.id, member.user_id]);
            }
            // Update Group Order
            yield client.query("UPDATE group_orders SET status = 'locked', total_amount = $1 WHERE id = $2", [totalGroupBill, groupOrder.id]);
            yield client.query('COMMIT');
            (0, socketService_1.emitGroupUpdate)(code, 'lobby_locked', { total: totalGroupBill });
            res.json({ message: 'Lobby locked', total: totalGroupBill });
        }
        catch (err) {
            yield client.query('ROLLBACK');
            res.status(400).json({ message: err.message });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
exports.lockLobby = lockLobby;
const payShare = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { code } = req.body;
    const userId = req.user.id;
    try {
        const groupRes = yield db_1.default.query('SELECT * FROM group_orders WHERE code = $1', [code]);
        if (groupRes.rows.length === 0)
            return res.status(404).json({ message: 'Lobby not found' });
        const groupOrder = groupRes.rows[0];
        const memberRes = yield db_1.default.query('SELECT * FROM group_order_members WHERE group_order_id = $1 AND user_id = $2', [groupOrder.id, userId]);
        const member = memberRes.rows[0];
        if (!member)
            return res.status(403).json({ message: 'Not a member' });
        if (member.share_amount <= 0)
            return res.status(400).json({ message: 'Nothing to pay' });
        if (member.payment_status === 'paid')
            return res.status(400).json({ message: 'Already paid' });
        // Create Razorpay Order
        const rzpOrder = yield razorpay_1.default.orders.create({
            amount: Math.round(Number(member.share_amount) * 100),
            currency: 'INR',
            receipt: `share_${member.id}`,
        });
        res.json({
            key_id: process.env.RAZORPAY_KEY_ID,
            order_id: rzpOrder.id,
            amount: member.share_amount
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.payShare = payShare;
const verifyShare = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { code, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user.id;
    try {
        // Verify Signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto_1.default
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');
        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ status: 'failure', message: 'Invalid signature' });
        }
        const groupRes = yield db_1.default.query('SELECT * FROM group_orders WHERE code = $1', [code]);
        const groupOrder = groupRes.rows[0];
        // Update Member Status
        yield db_1.default.query("UPDATE group_order_members SET payment_status = 'paid', payment_id = $1 WHERE group_order_id = $2 AND user_id = $3", [razorpay_payment_id, groupOrder.id, userId]);
        // Check if ALL paid
        const pendingRes = yield db_1.default.query("SELECT COUNT(*) FROM group_order_members WHERE group_order_id = $1 AND payment_status != 'paid'", [groupOrder.id]);
        const pendingCount = parseInt(pendingRes.rows[0].count);
        if (pendingCount === 0) {
            // ALL PAID -> Finalize
            yield db_1.default.query("UPDATE group_orders SET status = 'paid' WHERE id = $1", [groupOrder.id]);
            // Update all linked orders to 'preparing'
            yield db_1.default.query("UPDATE orders SET status = 'preparing', updated_at = NOW() WHERE group_order_id = $1", [groupOrder.id]);
            // Notify Kitchen (find one order to get uni id)
            // Just get uni id from group order -> Creator -> Uni? No user -> uni.
            // Or from temp orders.
            const orderRes = yield db_1.default.query('SELECT university_id FROM orders WHERE group_order_id = $1 LIMIT 1', [groupOrder.id]);
            if (orderRes.rows.length > 0) {
                (0, socketService_1.emitNewOrder)(orderRes.rows[0].university_id, {
                    type: 'group_order',
                    group_order_id: groupOrder.id,
                    total_amount: groupOrder.total_amount
                });
            }
            (0, socketService_1.emitGroupUpdate)(code, 'order_completed', { message: 'All paid! Order sent to kitchen.' });
        }
        else {
            (0, socketService_1.emitGroupUpdate)(code, 'member_paid', { userId });
        }
        res.json({ status: 'success' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.verifyShare = verifyShare;
