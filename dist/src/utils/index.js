import * as dotEnvConfig from "dotenv";
dotEnvConfig.config();
// import { IPFS_GATEWAY } from '@/app/constants';
// 从 IPFS 或 HTTP 加载 NFT 元数据，根据tokenUri 查询。tokenUri一般是 ipfs:// + 元数据的cid
export const fetchNFTMetadata = async (tokenUri) => {
    const { IPFS_GATEWAY } = process.env;
    try {
        // 处理 IPFS 路径（如 ipfs://Qm... 转换为 http 链接）
        const url = tokenUri.startsWith('ipfs://')
            ? `${IPFS_GATEWAY}${tokenUri.slice(7)}`
            : tokenUri;
        const response = await fetch(url);
        // if (!response.ok) throw new Error('元数据加载失败');
        const metadata = await response.json();
        // 处理图片的 IPFS 路径
        if (metadata.image?.startsWith('ipfs://')) {
            metadata.image = `${IPFS_GATEWAY}${metadata.image.slice(7)}`;
        }
        return metadata;
    }
    catch (err) {
        console.error('加载元数据失败:', err);
        return null;
    }
};
//# sourceMappingURL=index.js.map