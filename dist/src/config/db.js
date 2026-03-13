import { Sequelize } from 'sequelize';
import * as dotEnvConfig from "dotenv";
dotEnvConfig.config();
// 初始化 Sequelize 实例
const { DB_NAME, DB_USER, DB_PASS, DB_HOST, DB_PORT } = process.env;
export const sequelize = new Sequelize(DB_NAME, // 数据库名
DB_USER, // 用户名
DB_PASS, // 密码
{
    host: DB_HOST, // 主机
    port: DB_PORT, // 端口
    dialect: 'mysql', // 指定数据库类型
    logging: false // 关闭 SQL 日志（生产环境建议关闭）
});
// 测试连接
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('MySQL 连接成功');
    }
    catch (err) {
        console.error('MySQL 连接失败:', err);
    }
};
testConnection();
//# sourceMappingURL=db.js.map