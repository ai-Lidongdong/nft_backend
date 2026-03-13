import express from 'express';
import Order from '../models/Order.js';
const router = express.Router();
import { fetchNFTMetadata } from '../utils/index.js';
// 1. 获取所有有效订单（分页）
router.get('/active', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit; // MySQL 分页用 offset 而非 skip
        // 查询有效订单（isActive=1），按创建时间降序
        const { count, rows: orders } = await Order.findAndCountAll({
            where: { isActive: 1 }, // 筛选条件
            order: [['createdAt', 'DESC']], // 排序（降序）
            limit, // 每页数量
            offset // 跳过的数量（分页偏移量）
        });
        const data = await Promise.all(orders.map(async (item) => {
            const metadata = await fetchNFTMetadata(item.cid);
            return {
                ...item.dataValues,
                nftInfo: metadata
            };
        }));
        res.json({
            resultObj: data,
            pagination: {
                total: count, // 总数量
                page,
                pages: Math.ceil(count / limit)
            }
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 2. 获取用户的所有订单（卖家视角）
router.get('/seller/:address', async (req, res) => {
    try {
        const { address } = req.params;
        // 按卖家地址查询，按创建时间降序
        const orders = await Order.findAll({
            where: { seller: address, isActive: 1 },
            order: [['createdAt', 'DESC']]
        });
        const data = await Promise.all(orders.map(async (item) => {
            const metadata = await fetchNFTMetadata(item.cid);
            return {
                ...item.dataValues,
                nftInfo: metadata
            };
        }));
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 3. 获取订单详情
router.get('/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        // 按 orderId 查询
        const order = await Order.findOne({
            where: { orderId: parseInt(orderId) }
        });
        if (!order)
            return res.status(404).json({ error: '订单不存在' });
        res.json(order);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
export default router;
//# sourceMappingURL=orderRoutes.js.map