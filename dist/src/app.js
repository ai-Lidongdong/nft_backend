import express from 'express';
import cors from 'cors';
// 引入 MySQL 数据库连接（替换原 mongoose 连接）
import { sequelize } from './config/db.js';
// 引入事件监听服务（已适配 MySQL）
import { syncHistoricalEvents, listenToEvents } from './services/eventListener.js';
// 引入订单路由（已适配 MySQL）
import orderRoutes from './routes/orderRoutes.js';
import * as dotEnvConfig from "dotenv";
dotEnvConfig.config();
// 初始化 Express 应用
const app = express();
// 中间件配置
app.use(cors()); // 允许跨域请求（前端调用 API 需开启）
app.use(express.json()); // 解析 JSON 请求体
// 路由配置：订单相关接口
app.use('/api/orders', orderRoutes);
// 启动服务器并初始化服务
const startServer = async () => {
    try {
        // 等待 MySQL 连接成功（依赖 config/db.js 中的 authenticate）
        await sequelize.authenticate();
        console.log('MySQL 连接成功，启动服务器...');
        // // 同步历史事件（首次启动时补全数据）
        await syncHistoricalEvents();
        // 启动实时事件监听
        listenToEvents();
        // 启动 HTTP 服务器
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`服务器已启动，运行在 http://localhost:${PORT}`);
        });
    }
    catch (err) {
        console.error('启动失败:', err.message);
        process.exit(1); // 启动失败时退出进程
    }
};
// 启动应用
startServer();
//# sourceMappingURL=app.js.map