### 钱包插件数据中心化存储
## 储的数据包括：
● 账户名称
● 账户数量
● 联系人名称、备注、地址
● 最后更新时间戳
MetaMask 的做法是：本地加密 → 上传中心化服务器 → 用助记词作为索引关联数据。以下是完整的技术方案。
整体架构
┌─────────────────────────────────────────────────────────────┐
│                        前端（浏览器）                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  助记词输入  │ -> │  派生钱包    │ -> │  获取地址    │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                              │              │
│                                              ▼              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  加密元数据  │ <- │  组装元数据  │ <- │  地址作为ID  │     │
│  │ (AES-256)   │    │ (账户名/数量)│    │             │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              存储到后端 / IPFS + Lit                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
## 方案：自建后端（推荐，与 MetaMask 一致）
这是最直接、最成熟的方案，MetaMask 采用的就是这种方式。
1. 数据加密（前端）
import * as CryptoJS from 'crypto-js';

// 钱包元数据结构
interface WalletMetadata {
  version: number;           // 版本号，便于未来升级
  accounts: {
    index: number;           // account 索引
    address: string;         // 地址
    name: string;            // 用户自定义名称
    createdAt: number;       // 创建时间戳
  }[];
  lastUpdated: number;       // 最后更新时间
  contacts?: {               // 可选：联系人
    address: string;
    name: string;
    memo?: string;
  }[];
}

/**
 * 加密钱包元数据
 * @param metadata - 元数据对象
 * @param address - 地址作为加密密钥的一部分（增加安全性）
 * @param userPassword - 用户密码（可选，额外保护层）
 */
function encryptMetadata(
  metadata: WalletMetadata, 
  address: string,
  userPassword?: string
): string {
  // 将元数据转为 JSON 字符串
  const plaintext = JSON.stringify(metadata);
  
  // 使用地址作为密钥基础（确保只有知道地址的人能解密，而地址是公开的）
  // 实际上这里是"地址+密码"的组合，地址作为盐值
  const baseKey = userPassword ? `${address}:${userPassword}` : address;
  const key = CryptoJS.SHA256(baseKey).toString();
  
  // AES-256-CBC 加密
  const encrypted = CryptoJS.AES.encrypt(plaintext, key).toString();
  
  return encrypted;
}

/**
 * 解密钱包元数据
 */
function decryptMetadata(
  encryptedData: string, 
  address: string,
  userPassword?: string
): WalletMetadata | null {
  try {
    const baseKey = userPassword ? `${address}:${userPassword}` : address;
    const key = CryptoJS.SHA256(baseKey).toString();
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!plaintext) return null;
    return JSON.parse(plaintext);
  } catch (error) {
    console.error('解密失败:', error);
    return null;
  }
}
2. 服务端设计（Node.js + Redis/PostgreSQL）
// ========== 服务端 API 设计 ==========

import express from 'express';
import Redis from 'ioredis';

const app = express();
const redis = new Redis(process.env.REDIS_URL);

// 存储结构：以地址作为 Key（因为地址是公开的，且从助记词确定性派生）
// Key 格式: wallet:metadata:{address}
// Value: 加密后的元数据字符串

// 保存元数据
app.post('/api/wallet/metadata', async (req, res) => {
  const { address, encryptedMetadata } = req.body;
  
  // 验证地址格式（基础校验）
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid address' });
  }
  
  // 存储到 Redis，设置过期时间（可选：30天无访问则清理）
  const key = `wallet:metadata:${address.toLowerCase()}`;
  await redis.setex(key, 2592000, encryptedMetadata); // 30天过期
  
  res.json({ success: true });
});

// 读取元数据
app.get('/api/wallet/metadata/:address', async (req, res) => {
  const { address } = req.params;
  const key = `wallet:metadata:${address.toLowerCase()}`;
  const encrypted = await redis.get(key);
  
  if (!encrypted) {
    return res.status(404).json({ error: 'No metadata found' });
  }
  
  res.json({ encryptedMetadata: encrypted });
});

// 删除元数据（用户注销时）
app.delete('/api/wallet/metadata/:address', async (req, res) => {
  const { address } = req.params;
  const key = `wallet:metadata:${address.toLowerCase()}`;
  await redis.del(key);
  res.json({ success: true });
});

## 完整代码仓库结构
backend/
├── server.js          # Express 服务器
├── redis.js           # Redis 客户端配置
├── routes/
└── metadata.js    # API 路由
│middleware/
│ └── rateLimit.js   # 速率限制（防滥用）
├docker-compose.yml     # 本地开发环境
└README.md