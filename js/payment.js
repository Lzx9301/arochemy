const express = require('express');
const crypto  = require('crypto');
const { db }  = require('../services/firebase');

const router = express.Router();

/* ── 藍新金流（NewebPay MPG）設定 ─────────────────────────
   MerchantID / HashKey / HashIV 一律從環境變數讀取，不寫死在程式碼裡。
   請在 Railway 專案的 Variables 設定：
     NEWEBPAY_MERCHANT_ID
     NEWEBPAY_HASH_KEY
     NEWEBPAY_HASH_IV
     NEWEBPAY_MODE        = stage（測試）或 production（正式）
────────────────────────────────────────────────────────── */
const NEWEBPAY = {
  merchantId: process.env.NEWEBPAY_MERCHANT_ID,
  hashKey:    process.env.NEWEBPAY_HASH_KEY,
  hashIV:     process.env.NEWEBPAY_HASH_IV,
  mode:       process.env.NEWEBPAY_MODE || 'stage', // stage | production
};

const NEWEBPAY_URL = {
  stage:      'https://ccore.newebpay.com/MPG/mpg_gateway',
  production: 'https://core.newebpay.com/MPG/mpg_gateway',
};

const BACKEND_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : `http://localhost:${process.env.PORT || 3000}`;

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://lzx9301.github.io/arochemy';

/* 啟動時檢查金鑰是否都有設定，沒設定就直接在 log 上警告，
   避免上線後才發現漏設環境變數 */
if (!NEWEBPAY.merchantId || !NEWEBPAY.hashKey || !NEWEBPAY.hashIV) {
  console.warn('[NewebPay] 尚未設定 NEWEBPAY_MERCHANT_ID / NEWEBPAY_HASH_KEY / NEWEBPAY_HASH_IV 環境變數，付款功能無法使用');
}

/* ── AES-256-CBC 加密 TradeInfo ────────────────────────────
   藍新規定：key 用 HashKey（32 bytes）、iv 用 HashIV（16 bytes），
   PKCS7 padding，輸出轉成小寫 hex 字串 */
function aesEncrypt(plainText, hashKey, hashIV) {
  const cipher = crypto.createCipheriv('aes-256-cbc', hashKey, hashIV);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

/* ── AES-256-CBC 解密 TradeInfo（收到 Notify/Return 時用）── */
function aesDecrypt(encryptedHex, hashKey, hashIV) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', hashKey, hashIV);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/* ── 計算 TradeSha（驗證用簽章）───────────────────────────
   規則：SHA256("HashKey=xxx&{TradeInfo 加密後的 hex}&HashIV=xxx")，輸出大寫 */
function genTradeSha(tradeInfoHex, hashKey, hashIV) {
  const str = `HashKey=${hashKey}&${tradeInfoHex}&HashIV=${hashIV}`;
  return crypto.createHash('sha256').update(str).digest('hex').toUpperCase();
}

/* 把物件轉成 a=1&b=2 這種 query string（藍新加密前的原始格式） */
function toQueryString(params) {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

/* ══════════════════════════════════════════════════════════
   POST /api/payment/create
   建立藍新付款訂單，回傳 HTML form（自動 submit 導去藍新收銀台）
   Body: { orderId, total, items, customerEmail, customerName }
══════════════════════════════════════════════════════════ */
router.post('/create', async (req, res) => {
  try {
    if (!NEWEBPAY.merchantId || !NEWEBPAY.hashKey || !NEWEBPAY.hashIV) {
      return res.status(500).json({ error: '金流尚未設定完成，請聯絡管理員' });
    }

    const { orderId, total, customerEmail } = req.body;
    let items = req.body.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch { items = []; }
    }

    if (!orderId || !total) {
      return res.status(400).json({ error: '缺少訂單資訊' });
    }

    // 商品名稱（藍新 ItemDesc 建議 50 字元內，用「,」分隔多項商品）
    const itemDesc = (items || [])
      .map(i => `${i.name}${(i.size || i.spec) ? `(${i.size || i.spec})` : ''} x${i.qty}`)
      .join(',')
      .slice(0, 50) || 'Arochemy 商品';

    // 商店訂單編號：藍新規定僅限英數字，同一商店代號下需唯一
    const merchantOrderNo = `ARO${Date.now()}`.slice(0, 30);

    const tradeParams = {
      MerchantID:      NEWEBPAY.merchantId,
      RespondType:     'JSON',
      TimeStamp:       String(Math.round(Date.now() / 1000)),
      Version:         '2.0',
      MerchantOrderNo: merchantOrderNo,
      Amt:             Math.round(Number(total)),
      ItemDesc:        itemDesc,
      Email:           customerEmail || '',
      LoginType:       '0',
      NotifyURL:       `${BACKEND_URL}/api/payment/notify`,
      ReturnURL:       `${FRONTEND_URL}/order-success.html?orderId=${orderId}`,
      ClientBackURL:   `${FRONTEND_URL}/cart.html`,
      // 付款方式開關：1 = 開啟。目前先開信用卡 / ATM 轉帳 / 超商代碼 / WebATM。
      // LINE Pay 需要另外申請子商店資格，申請下來後把 LINEPAY: '1' 加進來即可。
      CREDIT:          '1',
      VACC:            '1', // ATM 轉帳
      CVS:             '1', // 超商代碼
      WEBATM:          '1',
    };

    const tradeInfoStr = toQueryString(tradeParams);
    const tradeInfoHex = aesEncrypt(tradeInfoStr, NEWEBPAY.hashKey, NEWEBPAY.hashIV);
    const tradeSha     = genTradeSha(tradeInfoHex, NEWEBPAY.hashKey, NEWEBPAY.hashIV);

    // 儲存 merchantOrderNo → orderId 對應關係
    await db.collection('payment_records').add({
      merchantOrderNo,
      orderId,
      total: Number(total),
      status: 'pending',
      provider: 'newebpay',
      createdAt: new Date(),
    });

    // 產生自動送出的 HTML form，導向藍新收銀台
    const formHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body>
        <form id="newebpay" method="POST" action="${NEWEBPAY_URL[NEWEBPAY.mode]}">
          <input type="hidden" name="MerchantID" value="${NEWEBPAY.merchantId}">
          <input type="hidden" name="TradeInfo" value="${tradeInfoHex}">
          <input type="hidden" name="TradeSha" value="${tradeSha}">
          <input type="hidden" name="Version" value="2.0">
        </form>
        <script>document.getElementById('newebpay').submit();</script>
      </body>
      </html>
    `;

    res.send(formHtml);

  } catch (e) {
    console.error('[NewebPay] 建立付款失敗：', e.message);
    res.status(500).json({ error: '付款建立失敗：' + e.message });
  }
});

/* ══════════════════════════════════════════════════════════
   POST /api/payment/notify
   藍新付款結果背景通知（Server to Server，非前台跳轉）
   收到後一定要回傳字串 "1|OK"，否則藍新會判定通知失敗並重送
══════════════════════════════════════════════════════════ */
router.post('/notify', async (req, res) => {
  try {
    const { TradeInfo, TradeSha } = req.body;

    if (!TradeInfo || !TradeSha) {
      console.warn('[NewebPay] Notify 缺少 TradeInfo/TradeSha');
      return res.send('0|ErrorMessage');
    }

    // 先驗證簽章，確認這筆通知真的是藍新送來的、內容沒被竄改
    const expectedSha = genTradeSha(TradeInfo, NEWEBPAY.hashKey, NEWEBPAY.hashIV);
    if (TradeSha !== expectedSha) {
      console.warn('[NewebPay] TradeSha 驗證失敗');
      return res.send('0|ErrorMessage');
    }

    const decrypted = aesDecrypt(TradeInfo, NEWEBPAY.hashKey, NEWEBPAY.hashIV);
    const payload    = JSON.parse(decrypted);
    const isPaid      = payload.Status === 'SUCCESS';
    const result      = payload.Result || {};
    const merchantOrderNo = result.MerchantOrderNo;

    console.log(`[NewebPay] 付款結果 ${merchantOrderNo}: ${payload.Status} ${payload.Message}`);

    // 找到對應的訂單
    const recordSnap = await db.collection('payment_records')
      .where('merchantOrderNo', '==', merchantOrderNo)
      .limit(1)
      .get();

    if (!recordSnap.empty) {
      const record  = recordSnap.docs[0];
      const orderId = record.data().orderId;

      await record.ref.update({
        status:       isPaid ? 'paid' : 'failed',
        tradeNo:      result.TradeNo || '',
        paymentType:  result.PaymentType || '',
        respondCode:  result.RespondCode || '',
        rawMessage:   payload.Message || '',
        updatedAt:    new Date(),
      });

      if (isPaid && orderId) {
        await db.collection('orders').doc(orderId).update({
          status:    'paid',
          updatedAt: new Date(),
        });
      }
    } else {
      console.warn(`[NewebPay] 找不到對應的付款記錄：${merchantOrderNo}`);
    }

    // 必須回傳這個字串讓藍新知道有收到通知，不然它會重送
    res.send('1|OK');

  } catch (e) {
    console.error('[NewebPay] Notify 處理失敗：', e.message);
    res.send('0|ErrorMessage');
  }
});

module.exports = router;
