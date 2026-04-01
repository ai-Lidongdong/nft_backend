import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

/** 仅存前端 AES 加密后的元数据（明文解密在客户端完成，见 wallet.md） */
const WalletMetadataRecord = sequelize.define(
  'WalletMetadataRecord',
  {
    address: {
      type: DataTypes.STRING(42),
      primaryKey: true,
      allowNull: false,
    },
    encryptedMetadata: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
    },
    serverUpdatedAt: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
  },
  {
    tableName: 'wallet_metadata',
    timestamps: false,
  }
);

WalletMetadataRecord.sync();

export default WalletMetadataRecord;
