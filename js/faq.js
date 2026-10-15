/**
 * Arochemy — js/faq.js
 * 常見問題頁：
 *   1. 依分類分成四個區塊（關於產品／使用與保存／客製與合作／購物與配送）
 *   2. 每題可展開（＋）與收合（×）—— 使用原生 <details>，鍵盤與螢幕閱讀器都能操作
 *   3. 上方搜尋框即時篩選問題與回答內容
 *   4. 題目來源：後台「首頁設定 → FAQ」有資料就以後台為準，沒有資料時顯示下方預設題目
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const cfg = {
  apiKey: 'AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI',
  authDomain: 'trying-89dc6.firebaseapp.com',
  projectId: 'trying-89dc6',
  storageBucket: 'trying-89dc6.firebasestorage.app',
  messagingSenderId: '115559148124',
  appId: '1:115559148124:web:ac37b9c249183a919b5499',
};
const app = getApps().find(a => a.name === '[DEFAULT]') || initializeApp(cfg);
const db  = getFirestore(app);

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* 分類：代碼要跟後台 admin.js 的 FAQ_CATS 一致 */
const FAQ_CATS = [
  { key: 'products', no: '01', en: 'ABOUT PRODUCTS', title: '關於產品', bg: 'cream',
    desc: '從一株植物到一瓶精油，中間包含產地、部位、蒸餾與成分等許多細節。<br>先理解差異，再選擇真正適合自己的氣味。' },
  { key: 'care', no: '02', en: 'USE & CARE', title: '使用<br>與保存', bg: 'sand',
    desc: '精油是高度濃縮的芳香物質。依照產品標示、使用情境與個人狀況調整，才能讓香氣安心地走進日常。' },
  { key: 'custom', no: '03', en: 'CUSTOM & COLLABORATION', title: '客製<br>與合作', bg: 'cream',
    desc: '一份禮盒、一個空間或一次活動，都能從氣味延伸出不同形式。先告訴我們需求，再一起找到合適的合作方式。' },
  { key: 'shopping', no: '04', en: 'SHOPPING & DELIVERY', title: '購物<br>與配送', bg: 'sand',
    desc: '從完成下單到收到商品，整理付款、出貨與退換貨的常見問題。<br>若訂單有特殊需求，請在商品出貨前與我們聯絡。' },
];

/* 後台尚未設定 FAQ 時顯示的預設題目 */
const DEFAULT_FAQS = [
  { cat: 'products', q: '單方精油和複方精油有什麼不同？',
    a: '單方精油來自一種植物的特定部位，適合認識植物原本的氣味，也能依需求自行搭配；複方精油則由多款精油依主題與香氣結構調和，讓整體氣味更完整。實際使用方式請依各產品頁與包裝標示為準。' },
  { cat: 'products', q: 'AROCHEMY 的精油都來自臺灣嗎？',
    a: '我們以臺灣原生植物精油為主，同時也精選世界各地的天然精油。每款精油的產地與相關資訊，請參考各產品頁的說明。' },
  { cat: 'care', q: '精油可以直接塗在皮膚上嗎？',
    a: '除非產品明確標示可直接使用，否則不建議將純精油直接塗抹於肌膚。若要用於肌膚，請依產品說明以適合的基底油稀釋，並先進行小範圍測試；若出現不適，應停止使用。' },
  { cat: 'care', q: '精油有哪些日常使用方式？',
    a: '常見的方式包括擴香、噴霧，以及稀釋後用於按摩。不同產品適合的方式不同，請依各產品頁與包裝上的使用建議操作。' },
  { cat: 'custom', q: '「精選香氣客製」和「專屬香氣設計」有什麼不同？',
    a: '精選香氣客製是從 AROCHEMY 現有複方中選香，再調整標籤、包裝或禮盒；專屬香氣設計則會從品牌個性、場域氛圍或故事出發，重新設計專屬配方。兩者所需的開發內容與時間不同。' },
  { cat: 'custom', q: '有提供商品經銷或選品合作嗎？',
    a: '有。歡迎認同 AROCHEMY 理念的通路與選品夥伴與我們聯絡，我們會依通路定位與客群需求，討論合適的商品組合與合作方式。詳細內容可參考服務頁的「商品經銷合作」。' },
  { cat: 'shopping', q: '如何在官網訂購？有哪些付款方式？',
    a: '選擇想購買的商品與規格後，加入購物車並前往結帳。確認商品數量、訂購人與收件資料，再選擇付款方式，即可完成訂購。\n\n目前提供信用卡與 WebATM 付款，實際選項以結帳頁面顯示為準。如需開立統一編號與公司抬頭，請於結帳時在備註欄填寫相關資訊。' },
  { cat: 'shopping', q: '完成訂購後，多久會出貨？運費如何計算？',
    a: '出貨時間與運費說明，請參考購物指南中的「出貨與配送」頁面。若有指定到貨日期等特殊需求，請於下單前與我們聯絡。' },
];

const sectionsEl = document.getElementById('faqSections');
const noResultEl = document.getElementById('faqNoResult');
const searchEl   = document.getElementById('faqSearch');

/* ══ 產生四個區塊 ══ */
function render(faqs) {
  if (!sectionsEl) return;
  const validKeys = new Set(FAQ_CATS.map(c => c.key));
  let n = 0;

  sectionsEl.innerHTML = FAQ_CATS.map(cat => {
    // 後台舊資料沒有分類時，放在「關於產品」
    const items = faqs.filter(f => (validKeys.has(f.cat) ? f.cat : 'products') === cat.key);
    const list = items.map((f, i) => {
      n += 1;
      const no = String(n).padStart(2, '0');
      return `
        <details class="fq-item"${i === 0 ? ' open' : ''}>
          <summary>
            <span class="pg-mono fq-no">${no}</span>
            <span class="fq-q">${esc(f.q)}</span>
            <span class="fq-icon" aria-hidden="true"></span>
          </summary>
          <div class="fq-a">${esc(f.a).replace(/\n/g, '<br>')}</div>
        </details>`;
    }).join('');

    return `
      <section class="fq-section fq-${cat.bg}" id="faq-${cat.key}" data-cat="${cat.key}">
        <div class="pg-wrap">
          <div class="fq-head">
            <div>
              <p class="pg-mono pg-kicker">${cat.no} / ${cat.en}</p>
              <h2>${cat.title}</h2>
            </div>
            <p class="fq-desc">${cat.desc}</p>
          </div>
          <div class="fq-list">${list || '<p class="fq-empty">此分類的問題整理中。</p>'}</div>
        </div>
      </section>`;
  }).join('');
}

/* ══ 搜尋 ══ */
function applySearch() {
  const kw = (searchEl?.value || '').trim().toLowerCase();
  let total = 0;

  sectionsEl?.querySelectorAll('.fq-section').forEach(sec => {
    let shown = 0;
    sec.querySelectorAll('.fq-item').forEach(item => {
      const hit = !kw || item.textContent.toLowerCase().includes(kw);
      item.hidden = !hit;
      if (hit) shown += 1;
      // 有搜尋時把符合的題目展開，方便直接看到答案
      if (kw && hit) item.open = true;
    });
    // 有搜尋字時，沒有符合題目的區塊整個隱藏
    sec.hidden = !!kw && shown === 0;
    total += shown;
  });

  if (noResultEl) noResultEl.hidden = !kw || total > 0;
}

/* ══ 啟動 ══ */
render(DEFAULT_FAQS);
searchEl?.addEventListener('input', applySearch);

getDoc(doc(db, 'settings', 'homepage')).then(snap => {
  const faqs = snap.exists() ? (snap.data().faqs || []).filter(f => f && f.q) : [];
  if (!faqs.length) return;          // 後台沒有資料 → 保留預設題目
  render(faqs);
  applySearch();
}).catch(() => {});                  // 讀取失敗 → 保留預設題目
