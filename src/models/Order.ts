// const { DataTypes } = require('sequelize');
// const sequelize = require('../config/db');
import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js'

// 定义 Order 模型（对应 MySQL 中的 orders 表）
const Order = sequelize.define('Order', {
  // 订单ID（主键，自增）
  orderId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    unique: true // 确保订单ID唯一
  },
  // 卖家地址
  seller: {
    type: DataTypes.STRING(42), // 以太坊地址固定42位
    allowNull: false
  },
  // 买家地址（初始为null）
  buyer: {
    type: DataTypes.STRING(42),
    defaultValue: null
  },
  // NFT合约地址
  nftContract: {
    type: DataTypes.STRING(42),
    allowNull: false
  },
  // NFT的tokenId
  tokenId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  // NFT的tokenId
  cid: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // 价格（用字符串存储BigInt，避免精度丢失）
  price: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // 支付代币地址
  paymentToken: {
    type: DataTypes.STRING(42),
    allowNull: false
  },
  // 订单是否有效（1=有效，0=无效）
  isActive: {
    type: DataTypes.TINYINT, // MySQL 中 TINYINT 对应布尔值
    defaultValue: 1
  },
  // 是否托管
  isEscrowed: {
    type: DataTypes.TINYINT,
    allowNull: false
  },
  // 订单状态（created/executed/cancelled）
  status: {
    type: DataTypes.ENUM('created', 'executed', 'cancelled'),
    defaultValue: 'created'
  },
  // 创建时间（时间戳）
  createdAt: {
    type: DataTypes.BIGINT, // 存储 Unix 时间戳（秒级）
    allowNull: false
  },
  // 更新时间（成交/取消时间）
  updatedAt: {
    type: DataTypes.BIGINT,
    defaultValue: null
  }
}, {
  tableName: 'orders', // 表名
  timestamps: false    // 禁用 Sequelize 自动添加的 createdAt/updatedAt（使用自定义时间戳）
});

// 同步模型到数据库（若表不存在则创建，已存在则不修改结构）
// 生产环境建议使用迁移工具（migrations），而非 sync
Order.sync();

export default Order;