
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

const DEFAULT_FAQS = [];

const sectionsEl = document.getElementById('faqSections');
const noResultEl = document.getElementById('faqNoResult');
const searchEl   = document.getElementById('faqSearch');

function render(faqs) {
  if (!sectionsEl) return;
  const validKeys = new Set(FAQ_CATS.map(c => c.key));
  let n = 0;

  sectionsEl.innerHTML = FAQ_CATS.map(cat => {
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

function applySearch() {
  const kw = (searchEl?.value || '').trim().toLowerCase();
  let total = 0;

  sectionsEl?.querySelectorAll('.fq-section').forEach(sec => {
    let shown = 0;
    sec.querySelectorAll('.fq-item').forEach(item => {
      const hit = !kw || item.textContent.toLowerCase().includes(kw);
      item.hidden = !hit;
      if (hit) shown += 1;
      if (kw && hit) item.open = true;
    });
    sec.hidden = !!kw && shown === 0;
    total += shown;
  });

  if (noResultEl) noResultEl.hidden = !kw || total > 0;
}

searchEl?.addEventListener('input', applySearch);

getDoc(doc(db, 'settings', 'homepage')).then(snap => {
  const faqs = snap.exists() ? (snap.data().faqs || []).filter(f => f && f.q) : [];
  render(faqs.length ? faqs : DEFAULT_FAQS);
  applySearch();
}).catch(() => {
  if (sectionsEl) sectionsEl.innerHTML = '<p class="fq-empty" style="text-align:center;padding:60px 0">資料載入失敗，請稍後再試</p>';
});
