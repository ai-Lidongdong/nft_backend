import './env.js';
import express from 'express';
import cors from 'cors';
// 引入 MySQL 数据库连接（替换原 mongoose 连接）
import { sequelize } from './config/db.js';
// 引入事件监听服务（已适配 MySQL）
import { syncHistoricalEvents, listenToEvents } from './services/eventListener.js';
// 引入订单路由（已适配 MySQL）
import orderRoutes from './routes/orderRoutes.js';
import walletStorageRoutes from './walletStorage/routes.js';
// 初始化 Express 应用
const app = express();
// 中间件配置
app.use(cors()); // 允许跨域请求（前端调用 API 需开启）
const jsonDefault = express.json();
const jsonWallet = express.json({ limit: '1mb' });
app.use((req, res, next) => {
    if (req.path.startsWith('/api/wallet')) {
        return jsonWallet(req, res, next);
    }
    return jsonDefault(req, res, next);
});
// 路由配置：订单相关接口
app.use('/api/orders', orderRoutes);
// 钱包加密元数据（独立目录，MySQL；见 wallet.md）
app.use('/api/wallet', walletStorageRoutes);
// 启动服务器并初始化服务
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('MySQL 连接成功');
        const PORT = Number(process.env.PORT) || 5000;
        const HOST = process.env.HOST ?? '0.0.0.0';
        // 必须先监听 HTTP：历史事件同步可能很慢或受 RPC 限流，若在其后再 listen 会导致长时间 ERR_CONNECTION_REFUSED
        const server = app.listen(PORT, HOST, () => {
            const addr = server.address();
            console.log(`HTTP 已监听 ${HOST}:${PORT}（链上历史同步在后台进行） address=${JSON.stringify(addr)}`);
            console.log(`本机可访问: http://127.0.0.1:${PORT}  或  http://localhost:${PORT}`);
        });
        server.on('error', (err) => {
            console.error('HTTP 端口绑定失败（端口被占用或未授权）:', err.code, err.message);
            process.exit(1);
        });
        listenToEvents();
        void syncHistoricalEvents();
    }
    catch (err) {
        console.error('启动失败（请检查 MySQL 是否已启动、.env 中 DB_* 是否正确）:', err.message);
        process.exit(1); // 启动失败时退出进程
    }
};
// 启动应用
startServer();
//# sourceMappingURL=app.js.map