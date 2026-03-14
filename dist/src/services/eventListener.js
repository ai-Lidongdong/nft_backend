import { ethers, JsonRpcProvider } from 'ethers'; // 从 ethers 库导入 Provider 和合约工具
import Order from '../models/Order.js'; // 导入 MySQL 订单模型（Sequelize）
import * as dotEnvConfig from "dotenv";
dotEnvConfig.config();
// 从环境变量获取 RPC 节点地址（如 Infura/Alchemy 的测试网/主网地址）、平台合约地址
const { RPC_URL, MARKETPLACE_ADDRESS } = process.env;
if (!RPC_URL) {
    throw new Error('请在 .env 文件中配置 RPC_URL（区块链节点地址）');
}
if (!MARKETPLACE_ADDRESS) {
    throw new Error('请在 .env 文件中配置 MARKETPLACE_ADDRESS（平台合约地址）');
}
const marketplaceABI = [
    // 订单创建事件
    `event OrderCreated(
        uint256 indexed orderId,
        address indexed seller,
        address nftContract,
        uint256 indexed tokenId,
        string cid,
        uint256 price,
        address paymentToken,
        uint256 timestamp,
        bool isActive,
        bool isEscrowed,
    )`,
    // 订单取消事件
    `event OrderCancelled(
        uint256 indexed orderId,
        uint256 indexed timestamp,
    )`,
    // 订单成交事件
    `event OrderExecuted(
        uint256 indexed orderId,
        address indexed buyer,
        uint256 timestamp,
    )`
];
// 创建 provider 实例（连接区块链节点）
const provider = new JsonRpcProvider(RPC_URL);
// 平台合约 ABI（仅包含需要监听的事件定义）
// 创建平台合约实例（用于监听事件）
const marketplaceContract = new ethers.Contract(MARKETPLACE_ADDRESS, // 合约地址
marketplaceABI, // 合约 ABI（仅事件部分）
provider // 已连接的区块链 provider
);
// 3. 同步历史事件（首次启动时执行，补全数据库中缺失的历史订单）
export const syncHistoricalEvents = async () => {
    console.log('开始同步历史事件...');
    try {
        // 获取当前最新区块号（用于确定历史事件的查询范围）
        const latestBlock = await provider.getBlockNumber();
        console.log(`当前最新区块: ${latestBlock}，开始扫描历史事件...`);
        // 3.1 同步 OrderCreated 事件（所有历史订单创建记录）
        const createdEvents = await marketplaceContract.queryFilter('OrderCreated', // 事件名
        0, // 从区块 0 开始
        latestBlock // 到最新区块结束
        );
        console.log(`发现 ${createdEvents.length} 条历史 OrderCreated 事件`);
        for (const event of createdEvents) {
            // 解析事件参数（ethers.js 中 event.args 包含事件的所有返回值）
            const { orderId, // 订单 ID（BigInt 类型，需转换为 Number）
            seller, // 卖家地址
            nftContract, // NFT 合约地址
            tokenId, // NFT 的 tokenId（BigInt 类型）
            cid, // nft 在 pinata 的元数据 cid
            price, // 价格（BigInt 类型，需转换为字符串避免精度丢失）
            paymentToken, // 支付代币地址
            isActive, isEscrowed, // 是否托管（布尔值）
             } = event.args;
            // 转换类型（适配 MySQL 表结构）
            const orderIdNum = orderId.toString();
            const tokenIdNum = tokenId.toString();
            const nftCid = cid.toString();
            const priceStr = price.toString();
            const isEscrowedTinyInt = isEscrowed ? 1 : 0; // MySQL 用 1/0 表示 true/false
            // 查找订单，不存在则创建（避免重复同步）
            await Order.findOrCreate({
                where: { orderId: orderIdNum }, // 条件：按 orderId 匹配
                defaults: {
                    seller,
                    nftContract,
                    tokenId: tokenIdNum,
                    cid: nftCid,
                    price: priceStr,
                    paymentToken,
                    isEscrowed: isEscrowedTinyInt,
                    isActive,
                    createdAt: Date.now(),
                    status: 'created'
                }
            });
        }
        // 3.2 同步 OrderExecuted 事件（历史订单成交记录）
        const executedEvents = await marketplaceContract.queryFilter('OrderExecuted', 0, latestBlock);
        console.log(`发现 ${executedEvents.length} 条历史 OrderExecuted 事件`);
        for (const event of executedEvents) {
            const { orderId, // 订单 ID
            buyer, // 买家地址
            timestamp // 成交时间戳
             } = event.args;
            const orderIdNum = Number(orderId);
            const timestampNum = Number(timestamp);
            // 更新订单状态为“已成交”
            await Order.update({
                buyer,
                isActive: 0, // 标记为无效订单
                status: 'executed',
                updatedAt: timestampNum
            }, { where: { orderId: orderIdNum } } // 按 orderId 匹配
            );
        }
        // 3.3 同步 OrderCancelled 事件（历史订单取消记录）
        const cancelledEvents = await marketplaceContract.queryFilter('OrderCancelled', 0, latestBlock);
        console.log(`发现 ${cancelledEvents.length} 条历史 OrderCancelled 事件`);
        for (const event of cancelledEvents) {
            const { orderId, // 订单 ID
            timestamp // 取消时间戳
             } = event.args;
            const orderIdNum = Number(orderId);
            const timestampNum = Number(timestamp);
            // 更新订单状态为“已取消”
            await Order.update({
                isActive: 0,
                status: 'cancelled',
                updatedAt: timestampNum
            }, { where: { orderId: orderIdNum } });
        }
        console.log('历史事件同步完成');
    }
    catch (err) {
        console.error('历史事件同步失败:', err.message);
    }
};
// 4. 监听实时事件（新事件发生时实时同步到数据库）
export const listenToEvents = () => {
    console.log('启动实时事件监听...');
    // 4.1 监听新订单创建（OrderCreated）
    marketplaceContract.on('OrderCreated', async (orderId, seller, nftContract, tokenId, cid, price, paymentToken, isEscrowed, timestamp) => {
        try {
            console.log(`监听到新订单创建，orderId: ${orderId}`);
            console.log('------订单信息------》', orderId, seller, nftContract, tokenId, cid, price, paymentToken, isEscrowed, timestamp);
            // 类型转换
            const orderIdNum = Number(orderId);
            const tokenIdNum = Number(tokenId);
            const nftCid = cid.toString();
            const priceStr = price.toString();
            const timestampNum = Number(timestamp);
            const isEscrowedTinyInt = isEscrowed ? 1 : 0;
            // 写入数据库
            await Order.create({
                orderId: orderIdNum,
                seller,
                nftContract,
                tokenId: tokenIdNum,
                cid: nftCid,
                price: priceStr,
                paymentToken,
                isEscrowed: isEscrowedTinyInt,
                createdAt: timestampNum,
                status: 'created'
            });
            console.log(`订单 ${orderIdNum} 已写入数据库`);
        }
        catch (err) {
            console.error(`处理 OrderCreated 事件失败:`, err.message);
        }
    });
    // 4.2 监听订单成交（OrderExecuted）
    marketplaceContract.on('OrderExecuted', async (orderId, buyer, timestamp) => {
        try {
            console.log(`监听到订单成交，orderId: ${orderId}`);
            console.log('----------订单信息----->', orderId, buyer, timestamp);
            const orderIdNum = Number(orderId);
            const timestampNum = Number(timestamp);
            // 更新订单状态
            await Order.update({
                buyer,
                isActive: 0,
                status: 'executed',
                updatedAt: timestampNum
            }, { where: { orderId: orderIdNum } });
            console.log(`订单 ${orderIdNum} 已更新为“已成交”`);
        }
        catch (err) {
            console.error(`处理 OrderExecuted 事件失败:`, err.message);
        }
    });
    // 4.3 监听订单取消（OrderCancelled）
    marketplaceContract.on('OrderCancelled', async (orderId, timestamp, event) => {
        try {
            console.log(`监听到订单取消，orderId: ${orderId}`);
            console.log('--------->OrderCancelled', orderId, timestamp);
            const orderIdNum = Number(orderId);
            const timestampNum = Number(timestamp);
            // 更新订单状态
            await Order.update({
                isActive: 0,
                status: 'cancelled',
                updatedAt: timestampNum
            }, { where: { orderId: orderIdNum } });
            console.log(`订单 ${orderIdNum} 已更新为“已取消”`);
        }
        catch (err) {
            console.error(`处理 OrderCancelled 事件失败:`, err.message);
        }
    });
    console.log('实时事件监听已启动（持续监听新事件）');
};
// 处理OrderCreated事件时
const handleOrderCreated = async (eventArgs) => {
    const { orderId, seller, nftContract, // NFT合约地址
    tokenId, // NFT的tokenId
    cid, // NFT在pinata的 cid
    price, paymentToken, isEscrowed, timestamp } = eventArgs;
    // 1. 类型转换（原有逻辑）
    const orderIdNum = orderId.toString();
    const tokenIdNum = tokenId.toString();
    const tokenUri = cid.toString();
    const priceStr = price.toString();
    const timestampNum = timestamp;
    const isEscrowedTinyInt = isEscrowed ? 1 : 0;
    // 2. 获取NFT元数据
    // let nftName = '未知名称';
    // let nftImage = '';
    // let nftDescription = '';
    // let nftMetadataRaw = '{}';
    try {
        // 2.1 实例化NFT合约（通过provider调用view方法）
        // const nftContractInstance = new ethers.Contract(nftContract, nftABI, provider);
        // 2.2 调用tokenURI获取元数据URI（如ipfs://QmZ...）
        // const tokenUri = await nftContractInstance.tokenURI(tokenIdNum);
        // console.log(`NFT元数据URI: ${tokenUri}`);
        // 2.3 解析URI（处理IPFS地址，转换为可访问的网关地址）
        // let metadataUrl = tokenUri;
        // if (tokenUri.startsWith('ipfs://')) {
        //   // 替换为IPFS网关（如使用pinata或官方网关）
        //   metadataUrl = tokenUri.replace('ipfs://', 'https://ipfs.io/ipfs/');
        // }
        // 2.4 发送HTTP请求获取元数据JSON
        // const response = await axios.get(metadataUrl);
        // const metadata = response.data;
        // 2.5 提取元数据字段（不同NFT标准可能字段名不同，需兼容）
        // nftName = metadata.name || metadata.title || '未知名称';
        // nftImage = metadata.image || metadata.img || '';
        // 处理图片地址（若为IPFS，同样转换为网关地址）
        // if (nftImage.startsWith('ipfs://')) {
        //   nftImage = nftImage.replace('ipfs://', 'https://ipfs.io/ipfs/');
        // }
        // nftDescription = metadata.description || '';
        // nftMetadataRaw = JSON.stringify(metadata); // 存储原始JSON
    }
    catch (err) {
        console.error(`获取NFT元数据失败（合约: ${nftContract}, tokenId: ${tokenIdNum}）:`, err?.message);
        // 失败时使用默认值，不阻断订单创建
    }
    // 3. 存入数据库（包含元数据）
    await Order.create({
        orderId: orderIdNum,
        seller,
        nftContract,
        tokenId: tokenIdNum,
        cid: tokenUri,
        price: priceStr,
        paymentToken,
        isEscrowed: isEscrowedTinyInt,
        createdAt: timestampNum,
        status: 'created',
    });
};
//# sourceMappingURL=eventListener.js.map