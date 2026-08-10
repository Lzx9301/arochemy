/** Arochemy 站內搜尋：搜尋商品 + 常見問題(FAQ) */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, getDocs, doc, getDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ── Firebase ──────────────────────────────────────────────── */
const firebaseConfig = {
  apiKey:            'AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI',
  authDomain:        'trying-89dc6.firebaseapp.com',
  projectId:         'trying-89dc6',
  storageBucket:     'trying-89dc6.firebasestorage.app',
  messagingSenderId: '115559148124',
  appId:             '1:115559148124:web:ac37b9c249183a919b5499',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getFirestore(app);

/* ── 分類中文對照(用於卡片顯示) ────────────────────────────── */
const CAT_LABEL = {
  single:    '單方精油',
  compound:  '複方精油',
  spray:     '噴霧',
  massage:   '按摩油',
  'eye-mask':'眼罩',
  diffuser:  '擴香瓶',
};
const SPEC_SIZES = ['5ml', '10ml', '30ml', '50ml', '100ml'];

/* ── DOM ───────────────────────────────────────────────────── */
const titleEl        = document.getElementById('searchQueryTitle');
const countEl         = document.getElementById('searchResultCount');
const emptyEl          = document.getElementById('searchEmpty');
const productsSection  = document.getElementById('searchProductsSection');
const productGrid       = document.getElementById('searchProductGrid');
const faqSection        = document.getElementById('searchFaqSection');
const faqList            = document.getElementById('searchFaqList');
const searchInputEl      = document.getElementById('searchInput');

/* ── 工具 ──────────────────────────────────────────────────── */
function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function normalize(str) {
  return String(str || '').toLowerCase().trim();
}

/* ── 主流程 ────────────────────────────────────────────────── */
async function runSearch() {
  const params = new URLSearchParams(window.location.search);
  const q = (params.get('q') || '').trim();

  if (titleEl) titleEl.textContent = q ? `搜尋：「${q}」` : '搜尋結果';
  if (searchInputEl) searchInputEl.value = q;

  if (!q) {
    if (countEl) countEl.textContent = '請輸入關鍵字搜尋商品或常見問題';
    showEmpty();
    return;
  }

  const nq = normalize(q);

  const [products, faqs] = await Promise.all([
    fetchProducts(),
    fetchFaqs(),
  ]);

  const matchedProducts = products.filter(p => {
    const haystack = [
      p.name, p.description, p.family, p.latinName,
      p.scentNote, p.origin, CAT_LABEL[p.category],
    ].map(normalize).join(' ');
    return haystack.includes(nq);
  });

  const matchedFaqs = faqs.filter(f => {
    const haystack = normalize(f.q) + ' ' + normalize(f.a);
    return haystack.includes(nq);
  });

  const total = matchedProducts.length + matchedFaqs.length;
  if (countEl) countEl.textContent = total
    ? `共找到 ${total} 筆結果（商品 ${matchedProducts.length} ・ 常見問題 ${matchedFaqs.length}）`
    : '';

  if (!total) {
    showEmpty();
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  if (matchedProducts.length) {
    productsSection.style.display = '';
    productGrid.innerHTML = matchedProducts.map(productCard).join('');
  } else {
    productsSection.style.display = 'none';
  }

  if (matchedFaqs.length) {
    faqSection.style.display = '';
    faqList.innerHTML = matchedFaqs.map((f, i) => `
      <details ${i === 0 ? 'open' : ''}>
        <summary>${esc(f.q)}</summary>
        <p>${esc(f.a)}</p>
      </details>
    `).join('');
  } else {
    faqSection.style.display = 'none';
  }
}

function showEmpty() {
  if (productsSection) productsSection.style.display = 'none';
  if (faqSection) faqSection.style.display = 'none';
  if (emptyEl) emptyEl.style.display = '';
}

/* ── 讀取商品(只搜上架中的) ────────────────────────────────── */
async function fetchProducts() {
  try {
    const snap = await getDocs(collection(db, 'products'));
    const list = [];
    snap.forEach(d => {
      const p = { id: d.id, ...d.data() };
      if (p.status === 'active') list.push(p);
    });
    return list;
  } catch (e) {
    console.error('[search] 讀取商品失敗：', e.message);
    return [];
  }
}

/* ── 讀取 FAQ ──────────────────────────────────────────────── */
async function fetchFaqs() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'homepage'));
    if (!snap.exists()) return [];
    return snap.data().faqs || [];
  } catch (e) {
    console.error('[search] 讀取 FAQ 失敗：', e.message);
    return [];
  }
}

/* ── 商品卡片 HTML(精簡版，點擊直接連到商品頁選規格) ─────────── */
function productCard(p) {
  const specs   = p.specs || {};
  const enabled = SPEC_SIZES.filter(s => specs[s]?.enabled && specs[s]?.stock > 0);
  const price   = enabled[0] ? specs[enabled[0]].price : 0;
  const img     = p.images?.[0] || '';
  const catName = CAT_LABEL[p.category] || '';

  return `
    <div class="product-card">
      <a class="product-img-wrap" href="product.html?id=${p.id}" aria-label="${esc(p.name)}">
        ${img
          ? `<img src="${esc(img)}" alt="${esc(p.name)}" class="product-img" loading="lazy">`
          : `<div class="product-img-placeholder">🌿</div>`}
      </a>
      <div class="product-info">
        ${catName ? `<div class="product-cat muted">${catName}</div>` : ''}
        <h3 class="product-name">
          <a href="product.html?id=${p.id}">${esc(p.name)}</a>
        </h3>
        ${price ? `<div class="product-price">NT$ ${Number(price).toLocaleString()}</div>` : ''}
      </div>
    </div>
  `;
}

/* ── 注入商品卡片樣式（跟商品列表頁一致，確保不依賴外部 CSS）── */
(function injectProductStyles() {
  if (document.getElementById('arochemy-product-styles')) return;
  const style = document.createElement('style');
  style.id = 'arochemy-product-styles';
  style.textContent = `
    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 24px;
      padding: 24px 0;
    }
    .product-card {
      background: #fff;
      border: 1px solid #eee;
      border-radius: 16px;
      overflow: hidden;
      transition: box-shadow 0.2s, transform 0.2s;
      display: flex;
      flex-direction: column;
    }
    .product-card:hover {
      box-shadow: 0 8px 32px rgba(0,0,0,0.10);
      transform: translateY(-2px);
    }
    .product-img-wrap {
      display: block;
      position: relative;
      aspect-ratio: 1 / 1;
      overflow: hidden;
      background: #f7f5f0;
      text-decoration: none;
    }
    .product-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s;
    }
    .product-img-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
    }
    .product-info {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .product-cat {
      font-size: 12px;
    }
    .product-name a {
      color: #111;
      text-decoration: none;
      font-size: 16px;
      font-weight: 700;
    }
    .product-price {
      font-size: 15px;
      font-weight: 800;
      color: #111;
      margin-top: 4px;
    }
  `;
  document.head.appendChild(style);
})();

runSearch();
