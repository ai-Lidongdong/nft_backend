import express from 'express';
import rateLimit from 'express-rate-limit';
import WalletMetadataRecord from './model.js';
import { isValidEthAddress, normalizeAddress } from './validation.js';

const router = express.Router();

const walletMetadataLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

router.use(walletMetadataLimiter);
router.get('/site', async (req: any, res: any) => {
  try {
    res.json({
      resultObj: {c: 1}
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
/** POST /api/wallet/metadata */
router.post('/metadata', async (req, res) => {
  try {
    const { address, encryptedMetadata } = req.body ?? {};

    if (typeof address !== 'string' || !isValidEthAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }
    if (typeof encryptedMetadata !== 'string' || encryptedMetadata.length === 0) {
      return res.status(400).json({ error: 'encryptedMetadata is required' });
    }
    if (encryptedMetadata.length > 4 * 1024 * 1024) {
      return res.status(413).json({ error: 'encryptedMetadata too large' });
    }

    const key = normalizeAddress(address);
    const now = Date.now();

    await WalletMetadataRecord.upsert({
      address: key,
      encryptedMetadata,
      serverUpdatedAt: now,
    });

    return res.json({ success: true, serverUpdatedAt: now });
  } catch (err: any) {
    console.error('[walletStorage] POST /metadata', err);
    return res.status(500).json({ error: err.message ?? 'Internal error' });
  }
});

/** PUT /api/wallet/metadata/:address — 仅更新已存在记录；无记录时 404（与 POST upsert 区分） */
router.put('/metadata/:address', async (req, res) => {
  try {
    const raw = req.params.address;
    if (!isValidEthAddress(raw)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const { encryptedMetadata } = req.body ?? {};
    if (typeof encryptedMetadata !== 'string' || encryptedMetadata.length === 0) {
      return res.status(400).json({ error: 'encryptedMetadata is required' });
    }
    if (encryptedMetadata.length > 4 * 1024 * 1024) {
      return res.status(413).json({ error: 'encryptedMetadata too large' });
    }

    const key = normalizeAddress(raw);
    const row = await WalletMetadataRecord.findByPk(key);
    if (!row) {
      return res.status(404).json({ error: 'No metadata found' });
    }

    const now = Date.now();
    await row.update({
      encryptedMetadata,
      serverUpdatedAt: now,
    });

    return res.json({ success: true, serverUpdatedAt: now });
  } catch (err: any) {
    console.error('[walletStorage] PUT /metadata/:address', err);
    return res.status(500).json({ error: err.message ?? 'Internal error' });
  }
});

/** GET /api/wallet/metadata/:address */
router.get('/metadata/:address', async (req, res) => {
  try {
    const raw = req.params.address;
    if (!isValidEthAddress(raw)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const row = await WalletMetadataRecord.findByPk(normalizeAddress(raw));
    if (!row) {
      return res.status(404).json({ error: 'No metadata found' });
    }

    const data = row.get({ plain: true }) as {
      encryptedMetadata: string;
      serverUpdatedAt: number;
    };

    return res.json({
      encryptedMetadata: data.encryptedMetadata,
      serverUpdatedAt: data.serverUpdatedAt,
    });
  } catch (err: any) {
    console.error('[walletStorage] GET /metadata/:address', err);
    return res.status(500).json({ error: err.message ?? 'Internal error' });
  }
});

/** DELETE /api/wallet/metadata/:address */
router.delete('/metadata/:address', async (req, res) => {
  try {
    const raw = req.params.address;
    if (!isValidEthAddress(raw)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    await WalletMetadataRecord.destroy({
      where: { address: normalizeAddress(raw) },
    });

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[walletStorage] DELETE /metadata/:address', err);
    return res.status(500).json({ error: err.message ?? 'Internal error' });
  }
});

export default router;
