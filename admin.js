/* ===================================
   Arochemy Admin Panel — admin.js v3
   修正：Firestore 索引問題、collection 不存在時的 graceful handling
   =================================== */

// ── Firebase 初始化 ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI",
  authDomain: "trying-89dc6.firebaseapp.com",
  projectId: "trying-89dc6",
  storageBucket: "trying-89dc6.firebasestorage.app",
  messagingSenderId: "115559148124",
  appId: "1:115559148124:web:ac37b9c249183a919b5499",
  measurementId: "G-KHR4PVKJCK"
};

firebase.initializeApp(firebaseConfig);
const auth    = firebase.auth();
const db      = firebase.firestore();
const storage = firebase.storage();

// ── EmailJS 設定 ─────────────────────────────────────────────
const EMAILJS_CONFIG = {
  publicKey:  '6ErXVriFfrV0WgH1C',
  serviceId:  'service_cq6g91d',
  templateId: 'template_p34lyxz',
};

// ── 全域狀態 ──────────────────────────────────────────────────
let currentUser        = null;
let editingProductId   = null;
let editingArticleId   = null;
let productImages      = [];
let coverImageFile     = null;
let allOrders          = [];
let currentOrderFilter = 'all';

// ── DOM 工具 ──────────────────────────────────────────────────
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ── 安全取得 collection（不存在時回傳空陣列，不報錯）───────────
async function safeGet(ref) {
  try {
    const snap = await ref.get();
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    return items;
  } catch (e) {
    // Firestore collection 不存在或權限問題，回傳空陣列
    console.warn('safeGet warning:', e.message);
    return [];
  }
}

async function safeGetDoc(ref) {
  try {
    const doc = await ref.get();
    return doc.exists ? doc.data() : {};
  } catch (e) {
    console.warn('safeGetDoc warning:', e.message);
    return {};
  }
}

/* ═══════════════════════════════════════════════════════════════
   認證
════════════════════════════════════════════════════════════ */
function initAuth() {
  const loginScreen = $('#login-screen');
  const appLayout   = $('#app-layout');
  const loginBtn    = $('#login-btn');
  const loginErr    = $('#login-error');
  const emailInput  = $('#login-email');
  const passInput   = $('#login-password');

  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      loginScreen.style.display = 'none';
      appLayout.style.display   = 'flex';
      $('#user-email-display').textContent   = user.email;
      $('#user-avatar-initials').textContent = user.email[0].toUpperCase();
      initDashboard();
    } else {
      loginScreen.style.display = 'flex';
      appLayout.style.display   = 'none';
    }
  });

  loginBtn.addEventListener('click', doLogin);
  [emailInput, passInput].forEach(el =>
    el.addEventListener('keydown', e => e.key === 'Enter' && doLogin())
  );

  async function doLogin() {
    const email = emailInput.value.trim();
    const pass  = passInput.value;
    loginErr.textContent = '';
    loginBtn.disabled    = true;
    loginBtn.textContent = '登入中…';
    try {
      await auth.signInWithEmailAndPassword(email, pass);
    } catch (err) {
      const msgs = {
        'auth/user-not-found':    '找不到此帳號',
        'auth/wrong-password':    '密碼錯誤',
        'auth/invalid-email':     '電子郵件格式不正確',
        'auth/invalid-credential':'帳號或密碼錯誤',
        'auth/too-many-requests': '嘗試次數過多，請稍後再試',
      };
      loginErr.textContent = msgs[err.code] || err.message;
    } finally {
      loginBtn.disabled    = false;
      loginBtn.textContent = '登入';
    }
  }

  $('#logout-btn').addEventListener('click', () => {
    auth.signOut();
    toast('已登出', 'info');
  });
}

/* ═══════════════════════════════════════════════════════════════
   導航
════════════════════════════════════════════════════════════ */
function initNav() {
  const navItems    = $$('.nav-item');
  const pages       = $$('.page');
  const topbarTitle = $('#topbar-title');
  const sidebar     = $('.sidebar');
  const overlay     = $('#sidebar-overlay');
  const hamburger   = $('#hamburger-btn');

  const titles = {
    'page-dashboard': '儀表板',
    'page-hero':      '首頁設定',
    'page-products':  '產品管理',
    'page-articles':  '文章管理',
    'page-orders':    '訂單管理',
    'page-members':   '會員管理',
    'page-settings':  '網站設定',
  };

  const loaders = {
    'page-products': () => loadProducts(),
    'page-articles': () => loadArticles(),
    'page-hero':     loadHomepageSettings,
    'page-settings': loadSiteSettings,
    'page-orders':   () => loadOrders(),
    'page-members':  () => loadMembers(),
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.page;
      navItems.forEach(n => n.classList.remove('active'));
      pages.forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(target)?.classList.add('active');
      topbarTitle.textContent = titles[target] || '';
      loaders[target]?.();
      closeSidebar();
    });
  });

  hamburger?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  });
  overlay?.addEventListener('click', closeSidebar);

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay?.classList.remove('show');
  }
}

/* ═══════════════════════════════════════════════════════════════
   儀表板
════════════════════════════════════════════════════════════ */
async function initDashboard() {
  // 各 collection 可能尚未建立，用 safeGet 避免報錯
  const [products, articles, orders, members] = await Promise.all([
    safeGet(db.collection('products')),
    safeGet(db.collection('articles')),
    safeGet(db.collection('orders')),
    safeGet(db.collection('members')),
  ]);

  const now   = new Date();
  const month = now.getMonth();
  const year  = now.getFullYear();

  let monthlyRevenue = 0, completedCount = 0, pendingCount = 0;

  orders.forEach(o => {
    const ts = toDate(o.createdAt);
    if (ts.getMonth() === month && ts.getFullYear() === year && o.status !== 'cancel')
      monthlyRevenue += Number(o.total || 0);
    if (o.status === 'done') completedCount++;
    else if (o.status !== 'cancel') pendingCount++;
  });

  setText('#stat-products', products.length);
  setText('#stat-articles', articles.length);
  setText('#stat-orders',   orders.length);
  setText('#stat-members',  members.length);
  setText('#stat-revenue',  monthlyRevenue.toLocaleString());
  setText('#stat-pending',  pendingCount);
  setText('#stat-done',     completedCount);

  // 最新訂單（最近 5 筆，不用 orderBy 避免索引問題）
  const sorted = [...orders].sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));
  const tbody  = $('#recent-orders-list');
  if (tbody) {
    tbody.innerHTML = '';
    if (!sorted.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">尚無訂單資料</td></tr>`;
    } else {
      sorted.slice(0, 5).forEach(o => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="td-name">${escHtml(o.customerName || '—')}</td>
          <td>NT$ ${Number(o.total || 0).toLocaleString()}</td>
          <td><span class="badge badge-${o.status || 'pending'}">${statusLabel(o.status)}</span></td>
          <td>${formatDate(o.createdAt)}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  await renderSalesRank('#dashboard-sales-rank', 5, orders);
}

/* ═══════════════════════════════════════════════════════════════
   首頁設定
════════════════════════════════════════════════════════════ */
async function loadHomepageSettings() {
  // 用 safeGetDoc，settings doc 不存在時回傳 {}
  const data = await safeGetDoc(db.collection('settings').doc('homepage'));

  setValue('#hero-title',    data.heroTitle    || '');
  setValue('#hero-subtitle', data.heroSubtitle || '');
  setValue('#hero-btn-text', data.heroBtnText  || '');
  setValue('#hero-btn-link', data.heroBtnLink  || '');
  setValue('#brand-title',   data.brandTitle   || '');
  setValue('#brand-body',    data.brandBody    || '');
  renderFaqEditor(data.faqs || []);
}

function initHomepageSettings() {
  $$('.section-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.section-tab').forEach(t => t.classList.remove('active'));
      $$('.section-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.panel)?.classList.add('active');
    });
  });

  $('#save-hero-btn')?.addEventListener('click', () => saveHomepageSection({
    heroTitle:    getValue('#hero-title'),
    heroSubtitle: getValue('#hero-subtitle'),
    heroBtnText:  getValue('#hero-btn-text'),
    heroBtnLink:  getValue('#hero-btn-link'),
  }));

  $('#save-brand-btn')?.addEventListener('click', () => saveHomepageSection({
    brandTitle: getValue('#brand-title'),
    brandBody:  getValue('#brand-body'),
  }));

  $('#add-faq-btn')?.addEventListener('click', () => addFaqItem('', ''));

  $('#save-faq-btn')?.addEventListener('click', () => {
    saveHomepageSection({ faqs: collectFaqs() });
  });

  $('#update-featured-btn')?.addEventListener('click', updateFeaturedProducts);
}

async function saveHomepageSection(data) {
  try {
    await db.collection('settings').doc('homepage').set(data, { merge: true });
    toast('已儲存', 'success');
  } catch (e) {
    toast('儲存失敗：' + e.message, 'error');
  }
}

function renderFaqEditor(faqs) {
  const container = $('#faq-editor-list');
  if (!container) return;
  container.innerHTML = '';
  faqs.forEach(f => addFaqItem(f.q, f.a));
}

function addFaqItem(q = '', a = '') {
  const container = $('#faq-editor-list');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'faq-item';
  div.innerHTML = `
    <div class="faq-drag-handle">
      <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
        <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
        <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
      </svg>
    </div>
    <div class="faq-fields">
      <input type="text" placeholder="問題" value="${escHtml(q)}" class="faq-q">
      <textarea placeholder="回答" rows="2" class="faq-a">${escHtml(a)}</textarea>
    </div>
    <button class="faq-remove" title="刪除">×</button>
  `;
  div.querySelector('.faq-remove').addEventListener('click', () => div.remove());
  container.appendChild(div);
}

function collectFaqs() {
  return $$('.faq-item').map(item => ({
    q: item.querySelector('.faq-q').value.trim(),
    a: item.querySelector('.faq-a').value.trim(),
  })).filter(f => f.q);
}

/* ── 更新精選產品 ── */
async function updateFeaturedProducts() {
  const btn       = $('#update-featured-btn');
  const strongEl  = btn?.querySelector('.text strong');
  if (strongEl) strongEl.textContent = '計算中…';
  if (btn) btn.disabled = true;

  try {
    const orders   = await safeGet(db.collection('orders'));
    const salesMap = {};

    orders.forEach(o => {
      if (o.status === 'cancel') return;
      (o.items || []).forEach(item => {
        const key = item.productId || item.name;
        if (!key) return;
        if (!salesMap[key]) salesMap[key] = { name: item.name || key, qty: 0, productId: item.productId };
        salesMap[key].qty += Number(item.qty || item.quantity || 1);
      });
    });

    const top3 = Object.values(salesMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3)
      .map(p => p.productId)
      .filter(Boolean);

    if (!top3.length) {
      toast('目前沒有訂單銷售紀錄，無法計算熱銷', 'info');
      return;
    }

    const allProducts = await safeGet(db.collection('products'));
    const batch = db.batch();
    allProducts.forEach(p => {
      batch.update(db.collection('products').doc(p.id), { featured: top3.includes(p.id) });
    });
    await batch.commit();
    await saveHomepageSection({ featuredProductIds: top3, featuredUpdatedAt: new Date().toISOString() });
    toast(`精選產品已更新（熱銷前 ${top3.length} 名）`, 'success');
  } catch (e) {
    toast('更新失敗：' + e.message, 'error');
  } finally {
    if (strongEl) strongEl.textContent = '一鍵更新本月熱銷精選';
    if (btn) btn.disabled = false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   產品管理
════════════════════════════════════════════════════════════ */
const SPEC_SIZES = ['5ml', '10ml', '30ml'];

async function loadProducts(filter = '', catFilter = '') {
  const tbody = $('#products-table-body');
  if (!tbody) return;
  tbody.innerHTML = skeletonRow(7);

  // 不用 orderBy，抓回來後在前端排序，避免索引建立需求
  const products = await safeGet(db.collection('products'));
  products.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));

  let filtered = products;
  if (filter) filtered = filtered.filter(p => p.name?.toLowerCase().includes(filter.toLowerCase()));
  if (catFilter && catFilter !== 'all') filtered = filtered.filter(p => p.category === catFilter);

  setText('#stat-products', products.length);
  tbody.innerHTML = '';

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">目前沒有符合的產品</td></tr>`;
    return;
  }

  filtered.forEach(p => {
    const imgHtml = p.images?.[0]
      ? `<div class="thumb"><img src="${escHtml(p.images[0])}" alt=""></div>`
      : `<div class="thumb">🌿</div>`;

    const specs      = p.specs || {};
    const totalStock = SPEC_SIZES.reduce((s, sz) => s + Number(specs[sz]?.stock || 0), 0);
    const maxStock   = Math.max(...SPEC_SIZES.map(sz => Number(specs[sz]?.stock || 0)), 1);
    const stockClass = totalStock === 0 ? 'stock-out' : totalStock < 10 ? 'stock-low' : 'stock-ok';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${imgHtml}</td>
      <td class="td-name">
        ${escHtml(p.name || '—')}
        ${p.featured ? '<span class="badge badge-success" style="margin-left:6px">⭐ 精選</span>' : ''}
      </td>
      <td>${catLabel(p.category)}</td>
      <td style="font-size:11px;color:var(--text-muted);line-height:1.8">
        ${SPEC_SIZES.filter(s => specs[s]?.enabled).map(s =>
          `${s}：NT$${Number(specs[s]?.price||0).toLocaleString()}`).join('<br>') || '—'}
      </td>
      <td>
        <div class="stock-bar-wrap">
          <div class="stock-bar-bg" style="width:60px">
            <div class="stock-bar-fill ${stockClass}" style="width:${Math.min(100,(totalStock/(maxStock*3))*100)}%"></div>
          </div>
          <span style="font-size:11px;color:var(--text-secondary)">${totalStock}</span>
        </div>
      </td>
      <td><span class="badge badge-${p.status === 'active' ? 'success' : 'hidden'}">${p.status === 'active' ? '上架中' : '下架'}</span></td>
      <td>
        <div class="flex-row gap-2">
          <button class="btn btn-sm btn-secondary edit-product-btn" data-id="${p.id}">編輯</button>
          <button class="btn btn-sm btn-danger delete-product-btn" data-id="${p.id}" data-name="${escHtml(p.name||'')}">刪除</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  $$('.edit-product-btn').forEach(b  => b.addEventListener('click', () => openProductModal(b.dataset.id)));
  $$('.delete-product-btn').forEach(b => b.addEventListener('click', () => confirmDelete('product', b.dataset.id, b.dataset.name)));
}

function initProductsPage() {
  $('#add-product-btn')?.addEventListener('click', () => openProductModal());

  $$('#products-cat-filter .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('#products-cat-filter .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      loadProducts($('#product-search')?.value || '', chip.dataset.cat);
    });
  });

  $('#product-search')?.addEventListener('input', e => {
    const activeCat = $('#products-cat-filter .filter-chip.active')?.dataset.cat || '';
    loadProducts(e.target.value, activeCat);
  });

  $('#save-product-btn')?.addEventListener('click', saveProduct);

  const uploadZone = $('#product-image-upload');
  const fileInput  = $('#product-image-input');
  uploadZone?.addEventListener('click', () => fileInput?.click());
  uploadZone?.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
  uploadZone?.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  uploadZone?.addEventListener('drop', e => {
    e.preventDefault(); uploadZone.classList.remove('dragover');
    handleProductImages(e.dataTransfer.files);
  });
  fileInput?.addEventListener('change', e => handleProductImages(e.target.files));
}

async function openProductModal(id = null) {
  editingProductId = id;
  productImages    = [];

  $$('#product-modal input, #product-modal textarea, #product-modal select').forEach(el => {
    if (el.type === 'checkbox') el.checked = false;
    else el.value = '';
  });
  $('#product-image-previews').innerHTML = '';
  setValue('#product-status', 'active');
  $('#product-modal-title').textContent = id ? '編輯產品' : '新增產品';

  if (id) {
    try {
      const data = await safeGetDoc(db.collection('products').doc(id));
      setValue('#product-name',        data.name        || '');
      setValue('#product-category',    data.category    || '');
      setValue('#product-description', data.description || '');
      setValue('#product-status',      data.status      || 'active');
      setValue('#product-origin',      data.origin      || '');

      const specs = data.specs || {};
      SPEC_SIZES.forEach(size => {
        const row = $(`.spec-row[data-size="${size}"]`);
        if (!row) return;
        const sp = specs[size] || {};
        row.querySelector('.spec-enabled').checked = sp.enabled !== false && !!sp.price;
        row.querySelector('.spec-price').value     = sp.price || '';
        row.querySelector('.spec-stock').value     = sp.stock !== undefined ? sp.stock : '';
      });

      productImages = (data.images || []).map(url => ({ dataUrl: url }));
      renderProductImagePreviews();
    } catch (e) { toast('載入產品資料失敗：' + e.message, 'error'); return; }
  }

  openModal('product-modal');
}

function handleProductImages(files) {
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => { productImages.push({ dataUrl: e.target.result, file }); renderProductImagePreviews(); };
    reader.readAsDataURL(file);
  });
}

function renderProductImagePreviews() {
  const container = $('#product-image-previews');
  if (!container) return;
  container.innerHTML = '';
  productImages.forEach((img, i) => {
    const div = document.createElement('div');
    div.className = 'image-preview-item';
    div.innerHTML = `<img src="${img.dataUrl}" alt=""><button class="image-preview-remove">×</button>`;
    div.querySelector('button').addEventListener('click', () => { productImages.splice(i, 1); renderProductImagePreviews(); });
    container.appendChild(div);
  });
}

async function saveProduct() {
  const btn = $('#save-product-btn');
  btn.disabled = true; btn.textContent = '儲存中…';
  try {
    const uploadedUrls = [];
    for (const img of productImages) {
      if (img.file) {
        const ref = storage.ref(`products/${Date.now()}_${img.file.name}`);
        await ref.put(img.file);
        uploadedUrls.push(await ref.getDownloadURL());
      } else {
        uploadedUrls.push(img.dataUrl);
      }
    }

    const specs = {};
    SPEC_SIZES.forEach(size => {
      const row = $(`.spec-row[data-size="${size}"]`);
      if (!row) return;
      specs[size] = {
        enabled: row.querySelector('.spec-enabled').checked,
        price:   Number(row.querySelector('.spec-price').value) || 0,
        stock:   Number(row.querySelector('.spec-stock').value) || 0,
      };
    });

    const totalStock = SPEC_SIZES.reduce((s, sz) => s + (specs[sz]?.enabled ? (specs[sz]?.stock || 0) : 0), 0);
    let status = getValue('#product-status');
    if (totalStock === 0 && status === 'active') {
      status = 'hidden';
      toast('啟用規格庫存為 0，已自動下架', 'info');
    }

    const data = {
      name:        getValue('#product-name'),
      category:    getValue('#product-category'),
      description: getValue('#product-description'),
      status,
      origin:      getValue('#product-origin'),
      specs,
      images:      uploadedUrls,
      updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (!data.name) { toast('請填寫產品名稱', 'error'); return; }

    if (editingProductId) {
      await db.collection('products').doc(editingProductId).update(data);
      toast('產品已更新', 'success');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      data.featured  = false;
      await db.collection('products').add(data);
      toast('產品已新增', 'success');
    }

    closeModal('product-modal');
    loadProducts();
  } catch (e) {
    toast('儲存失敗：' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '儲存產品';
  }
}

/* ═══════════════════════════════════════════════════════════════
   文章管理
════════════════════════════════════════════════════════════ */
async function loadArticles(filter = '') {
  const tbody = $('#articles-table-body');
  if (!tbody) return;
  tbody.innerHTML = skeletonRow(5);

  const articles = await safeGet(db.collection('articles'));
  articles.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));

  const filtered = filter
    ? articles.filter(a => a.title?.toLowerCase().includes(filter.toLowerCase()) || a.category?.toLowerCase().includes(filter.toLowerCase()))
    : articles;

  setText('#stat-articles', articles.length);
  tbody.innerHTML = '';

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">目前沒有文章</td></tr>`;
    return;
  }

  filtered.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-name">${escHtml(a.title || '（無標題）')}</td>
      <td>${escHtml(a.category || '—')}</td>
      <td style="font-size:11px;color:var(--text-muted)">${escHtml((a.tags||[]).slice(0,3).join(', ') || '—')}</td>
      <td><span class="badge badge-${a.status === 'published' ? 'success' : 'draft'}">${a.status === 'published' ? '已發布' : '草稿'}</span></td>
      <td>
        <div class="flex-row gap-2">
          <button class="btn btn-sm btn-secondary edit-article-btn" data-id="${a.id}">編輯</button>
          <button class="btn btn-sm btn-ghost newsletter-btn" data-id="${a.id}" data-title="${escHtml(a.title||'')}" title="發送電子報">📧</button>
          <button class="btn btn-sm btn-danger delete-article-btn" data-id="${a.id}" data-name="${escHtml(a.title||'')}">刪除</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  $$('.edit-article-btn').forEach(b    => b.addEventListener('click', () => openArticleModal(b.dataset.id)));
  $$('.delete-article-btn').forEach(b  => b.addEventListener('click', () => confirmDelete('article', b.dataset.id, b.dataset.name)));
  $$('.newsletter-btn').forEach(b      => b.addEventListener('click', () => openNewsletterModal(b.dataset.id, b.dataset.title)));
}

function initArticlesPage() {
  $('#add-article-btn')?.addEventListener('click', () => openArticleModal());
  $('#article-search')?.addEventListener('input', e => loadArticles(e.target.value));
  $('#save-article-btn')?.addEventListener('click', saveArticle);

  $('#article-cover-upload')?.addEventListener('click', () => $('#article-cover-input')?.click());
  $('#article-cover-input')?.addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    coverImageFile = file;
    const reader = new FileReader();
    reader.onload = ev => { $('#cover-preview').innerHTML = `<img src="${ev.target.result}" alt="">`; };
    reader.readAsDataURL(file);
  });

  initTagInput();
  initEditor();
}

function initEditor() {
  $$('.editor-toolbar button[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
      updateToolbarState();
    });
  });
  const ec = $('#article-editor-content');
  ['keyup','mouseup','focus'].forEach(ev => ec?.addEventListener(ev, updateToolbarState));
}

function updateToolbarState() {
  ['bold','italic','underline','insertUnorderedList','insertOrderedList'].forEach(cmd => {
    const btn = $(`.editor-toolbar button[data-cmd="${cmd}"]`);
    if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
  });
}

function initTagInput() {
  const area  = $('#tags-input-area');
  const input = $('#tag-text-input');
  if (!area || !input) return;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = input.value.trim().replace(/,/g,'');
      if (val) addTag(val);
    }
    if (e.key === 'Backspace' && !input.value) {
      const chips = $$('.tag-chip', area);
      if (chips.length) chips[chips.length-1].remove();
    }
  });
}

function addTag(value) {
  const area  = $('#tags-input-area');
  const input = $('#tag-text-input');
  const chip  = document.createElement('div');
  chip.className   = 'tag-chip';
  chip.dataset.value = value;
  chip.innerHTML   = `${escHtml(value)} <button type="button">×</button>`;
  chip.querySelector('button').addEventListener('click', () => chip.remove());
  area.insertBefore(chip, input);
  input.value = '';
}

function getTags()     { return $$('.tag-chip').map(c => c.dataset.value); }
function setTags(tags) { $$('.tag-chip').forEach(c => c.remove()); (tags||[]).forEach(t => addTag(t)); }

async function openArticleModal(id = null) {
  editingArticleId = id;
  coverImageFile   = null;

  setValue('#article-title', ''); setValue('#article-category', '');
  setValue('#article-status', 'draft'); setValue('#article-excerpt', '');
  setTags([]);
  const editor = $('#article-editor-content');
  if (editor) editor.innerHTML = '';
  $('#cover-preview').innerHTML = `
    <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
    <span style="font-size:12px">點擊上傳封面圖片</span>`;

  if (id) {
    $('#article-modal-title').textContent = '編輯文章';
    const d = await safeGetDoc(db.collection('articles').doc(id));
    setValue('#article-title',    d.title    || '');
    setValue('#article-category', d.category || '');
    setValue('#article-status',   d.status   || 'draft');
    setValue('#article-excerpt',  d.excerpt  || '');
    setTags(d.tags || []);
    if (editor) editor.innerHTML = d.content || '';
    if (d.coverImage) $('#cover-preview').innerHTML = `<img src="${escHtml(d.coverImage)}" alt="">`;
  } else {
    $('#article-modal-title').textContent = '發布新文章';
  }
  openModal('article-modal');
}

async function saveArticle() {
  const btn = $('#save-article-btn');
  btn.disabled = true; btn.textContent = '儲存中…';
  try {
    let coverUrl = '';
    if (editingArticleId) {
      const ex = await safeGetDoc(db.collection('articles').doc(editingArticleId));
      coverUrl = ex.coverImage || '';
    }
    if (coverImageFile) {
      const ref = storage.ref(`articles/${Date.now()}_${coverImageFile.name}`);
      await ref.put(coverImageFile);
      coverUrl = await ref.getDownloadURL();
    }
    const editor = $('#article-editor-content');
    const data   = {
      title:      getValue('#article-title'),
      category:   getValue('#article-category'),
      status:     getValue('#article-status'),
      excerpt:    getValue('#article-excerpt'),
      content:    editor?.innerHTML || '',
      tags:       getTags(),
      coverImage: coverUrl,
      updatedAt:  firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (!data.title) { toast('請填寫文章標題', 'error'); return; }

    if (editingArticleId) {
      await db.collection('articles').doc(editingArticleId).update(data);
      toast('文章已更新', 'success');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('articles').add(data);
      toast('文章已發布', 'success');
    }
    closeModal('article-modal');
    loadArticles();
  } catch (e) {
    toast('儲存失敗：' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '儲存文章';
  }
}

/* ═══════════════════════════════════════════════════════════════
   電子報
════════════════════════════════════════════════════════════ */
async function openNewsletterModal(articleId, articleTitle) {
  let article = { title: articleTitle, excerpt: '', coverImage: '' };
  try {
    const d = await safeGetDoc(db.collection('articles').doc(articleId));
    if (d.title) article = { id: articleId, ...d };
  } catch(e) {}

  // 訂閱者：不用 where，在前端篩選避免索引問題
  const members     = await safeGet(db.collection('members'));
  const subscribers = members.filter(m => m.subscribed === true);

  setValue('#newsletter-article-id', articleId);
  setValue('#newsletter-subject',    `【Arochemy】${article.title}`);
  setText('#nl-subscriber-count',   subscribers.length);

  $('#newsletter-email-preview').innerHTML = `
    <div class="newsletter-preview">
      <h2>${escHtml(article.title)}</h2>
      <div class="nl-meta">Arochemy Newsletter</div>
      ${article.coverImage ? `<img src="${escHtml(article.coverImage)}" style="width:100%;border-radius:6px;margin-bottom:12px" alt="">` : ''}
      <div class="nl-excerpt">${escHtml(article.excerpt || '閱讀最新文章…')}</div>
      <a href="#" class="nl-cta">閱讀完整文章</a>
    </div>`;

  openModal('newsletter-modal');

  $('#send-newsletter-btn').onclick = async () => {
    if (!subscribers.length) { toast('目前沒有訂閱會員', 'info'); return; }

    const btn = $('#send-newsletter-btn');
    btn.disabled = true; btn.textContent = `發送中 (0/${subscribers.length})…`;

    // 初始化 EmailJS
    if (typeof emailjs !== 'undefined') {
      emailjs.init(EMAILJS_CONFIG.publicKey);
    }

    let sent = 0, failed = 0;
    for (const member of subscribers) {
      try {
        await emailjs.send(
          EMAILJS_CONFIG.serviceId,
          EMAILJS_CONFIG.templateId,
          {
            to_email:       member.email,
            to_name:        member.name || member.email,
            subject:        getValue('#newsletter-subject'),
            article_title:  article.title,
            article_excerpt:article.excerpt || '',
            article_link:   `https://lzx9301.github.io/arochemy/article.html?id=${articleId}`,
            cover_image:    article.coverImage || '',
          }
        );
        sent++;
      } catch (e) { failed++; console.warn('Email failed:', member.email, e); }
      btn.textContent = `發送中 (${sent + failed}/${subscribers.length})…`;
    }

    toast(`電子報發送完成：${sent} 成功 / ${failed} 失敗`, sent > 0 ? 'success' : 'error');
    btn.disabled = false; btn.textContent = '確認發送';
    closeModal('newsletter-modal');
  };
}

/* ═══════════════════════════════════════════════════════════════
   訂單管理
════════════════════════════════════════════════════════════ */
async function loadOrders(statusFilter = null) {
  const tbody = $('#orders-table-body');
  if (!tbody) return;
  if (statusFilter !== null) currentOrderFilter = statusFilter;
  tbody.innerHTML = skeletonRow(7);

  // 全部抓回，前端排序篩選（避免 Firestore 索引問題）
  allOrders = await safeGet(db.collection('orders'));
  allOrders.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));

  // 月份篩選
  const selMonth = $('#order-month-filter')?.value;
  let filtered = allOrders;
  if (selMonth) {
    const [fy, fm] = selMonth.split('-').map(Number);
    filtered = filtered.filter(o => {
      const ts = toDate(o.createdAt);
      return ts.getFullYear() === fy && (ts.getMonth() + 1) === fm;
    });
  }

  // 狀態篩選
  if (currentOrderFilter && currentOrderFilter !== 'all') {
    filtered = filtered.filter(o => o.status === currentOrderFilter);
  }

  // 統計（以全部訂單為基準）
  const now   = new Date();
  const month = now.getMonth(), year = now.getFullYear();
  let monthRevenue = 0, pendingCnt = 0, doneCnt = 0;

  allOrders.forEach(o => {
    const ts = toDate(o.createdAt);
    if (ts.getMonth() === month && ts.getFullYear() === year && o.status !== 'cancel')
      monthRevenue += Number(o.total || 0);
    if (o.status === 'done') doneCnt++;
    else if (o.status !== 'cancel') pendingCnt++;
  });

  setText('#orders-month-revenue', 'NT$ ' + monthRevenue.toLocaleString());
  setText('#orders-pending-count', pendingCnt);
  setText('#orders-done-count',    doneCnt);
  setText('#orders-total-count',   allOrders.length);
  tbody.innerHTML = '';

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">目前沒有符合的訂單</td></tr>`;
  } else {
    filtered.forEach(o => {
      const shortId = o.id.slice(-6).toUpperCase();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family:monospace;font-size:11px;color:var(--text-muted)">#${shortId}</td>
        <td class="td-name">${escHtml(o.customerName || '—')}</td>
        <td style="font-size:12px;color:var(--text-secondary)">${escHtml(o.customerEmail || '—')}</td>
        <td style="font-size:12px">${escHtml(o.shippingMethod || '—')}</td>
        <td style="color:var(--accent);font-weight:500">NT$ ${Number(o.total||0).toLocaleString()}</td>
        <td>
          <select class="status-select-inline" data-id="${o.id}">
            ${['pending','paid','shipped','done','cancel'].map(s =>
              `<option value="${s}" ${o.status===s?'selected':''}>${statusLabel(s)}</option>`
            ).join('')}
          </select>
        </td>
        <td>
          <button class="btn btn-sm btn-secondary view-order-btn" data-id="${o.id}">查看</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    $$('.status-select-inline').forEach(sel => {
      sel.addEventListener('change', async () => {
        try {
          await db.collection('orders').doc(sel.dataset.id).update({
            status: sel.value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
          toast('訂單狀態已更新', 'success');
          loadOrders();
        } catch (e) { toast('更新失敗：' + e.message, 'error'); }
      });
    });

    $$('.view-order-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const o = allOrders.find(x => x.id === btn.dataset.id);
        if (o) openOrderDetail(o);
      });
    });
  }

  await renderSalesRank('#orders-sales-rank', 10, allOrders);
}

function initOrdersPage() {
  const now        = new Date();
  const monthInput = $('#order-month-filter');
  if (monthInput) {
    monthInput.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    monthInput.addEventListener('change', () => loadOrders());
  }

  $$('#orders-status-filter .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('#orders-status-filter .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      loadOrders(chip.dataset.status);
    });
  });
}

function openOrderDetail(o) {
  const shortId = o.id.slice(-6).toUpperCase();
  setText('#order-detail-id',    '#' + shortId);
  setText('#order-detail-date',  formatDate(o.createdAt));
  setText('#order-detail-name',  o.customerName   || '—');
  setText('#order-detail-email', o.customerEmail  || '—');
  setText('#order-detail-phone', o.customerPhone  || '—');
  setText('#order-detail-ship',  o.shippingMethod || '—');
  setText('#order-detail-addr',  o.address || o.storeInfo || '—');
  setText('#order-detail-note',  o.note || '（無備註）');
  setText('#order-detail-status', statusLabel(o.status));

  const itemsEl = $('#order-detail-items');
  itemsEl.innerHTML = '';
  let total = 0;
  (o.items || []).forEach(item => {
    const sub = Number(item.price || 0) * Number(item.qty || item.quantity || 1);
    total += sub;
    const div = document.createElement('div');
    div.className = 'order-item-row';
    div.innerHTML = `
      <div class="order-item-thumb">${item.image ? `<img src="${escHtml(item.image)}" alt="">` : '🌿'}</div>
      <div class="order-item-info">
        <div class="order-item-name">${escHtml(item.name || '—')}</div>
        <div class="order-item-spec">${escHtml(item.spec || item.size || '')}</div>
      </div>
      <div class="order-item-qty">× ${item.qty || item.quantity || 1}</div>
      <div class="order-item-price">NT$ ${sub.toLocaleString()}</div>
    `;
    itemsEl.appendChild(div);
  });

  setText('#order-detail-total', 'NT$ ' + Number(o.total || total).toLocaleString());
  openModal('order-detail-modal');
}

/* ═══════════════════════════════════════════════════════════════
   商品銷量排行（共用，傳入 orders 陣列避免重複請求）
════════════════════════════════════════════════════════════ */
async function renderSalesRank(containerSel, limit = 5, ordersData = null) {
  const container = $(containerSel);
  if (!container) return;

  const orders    = ordersData || await safeGet(db.collection('orders'));
  const salesMap  = {};

  orders.forEach(o => {
    if (o.status === 'cancel') return;
    (o.items || []).forEach(item => {
      const key = item.productId || item.name || '未知';
      if (!salesMap[key]) salesMap[key] = { name: item.name || key, qty: 0, category: item.category || '' };
      salesMap[key].qty += Number(item.qty || item.quantity || 1);
    });
  });

  const top    = Object.values(salesMap).sort((a, b) => b.qty - a.qty).slice(0, limit);
  const maxQty = top[0]?.qty || 1;
  const rankSyms = ['gold','silver','bronze'];

  container.innerHTML = '';
  if (!top.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><p>尚無銷售紀錄</p></div>`;
    return;
  }

  top.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'sales-rank-item';
    div.innerHTML = `
      <div class="rank-num ${rankSyms[i] || ''}">${i+1}</div>
      <div class="rank-info">
        <div class="rank-name">${escHtml(item.name)}</div>
        <div class="rank-cat">${escHtml(item.category || '—')}</div>
      </div>
      <div class="rank-bar-wrap">
        <div class="rank-bar-bg"><div class="rank-bar-fill" style="width:${Math.round((item.qty/maxQty)*100)}%"></div></div>
      </div>
      <div class="rank-qty">售出 ${item.qty}</div>
    `;
    container.appendChild(div);
  });
}

/* ═══════════════════════════════════════════════════════════════
   會員管理
════════════════════════════════════════════════════════════ */
async function loadMembers(filter = '') {
  const tbody = $('#members-table-body');
  if (!tbody) return;
  tbody.innerHTML = skeletonRow(5);

  // 直接 get 全部，前端篩選
  const members = await safeGet(db.collection('members'));
  members.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));

  const filtered  = filter
    ? members.filter(m => m.name?.toLowerCase().includes(filter.toLowerCase()) || m.email?.toLowerCase().includes(filter.toLowerCase()))
    : members;

  const subCount = members.filter(m => m.subscribed === true).length;
  setText('#stat-members',       members.length);
  setText('#members-sub-count',  subCount);

  tbody.innerHTML = '';
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">目前沒有會員資料</td></tr>`;
    return;
  }

  filtered.forEach(m => {
    const initials = (m.name || m.email || '?')[0].toUpperCase();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="member-name-cell">
          <div class="member-avatar">${initials}</div>
          <span class="td-name">${escHtml(m.name || '（未填寫）')}</span>
        </div>
      </td>
      <td style="color:var(--text-secondary);font-size:12px">${escHtml(m.email || '—')}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${escHtml(m.phone || '—')}</td>
      <td><span class="badge badge-${m.subscribed ? 'success' : 'hidden'}">${m.subscribed ? '✓ 已訂閱' : '未訂閱'}</span></td>
      <td style="font-size:12px;color:var(--text-muted)">${formatDate(m.createdAt)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function initMembersPage() {
  $('#member-search')?.addEventListener('input', e => loadMembers(e.target.value));

  $('#export-subscribers-btn')?.addEventListener('click', async () => {
    const members     = await safeGet(db.collection('members'));
    const subscribers = members.filter(m => m.subscribed === true);
    if (!subscribers.length) { toast('目前沒有訂閱者', 'info'); return; }

    const rows = [['姓名','Email','電話','加入日期']];
    subscribers.forEach(m => rows.push([m.name||'', m.email||'', m.phone||'', formatDate(m.createdAt)]));
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `arochemy_subscribers_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast(`已匯出 ${subscribers.length} 位訂閱者`, 'success');
  });
}

/* ═══════════════════════════════════════════════════════════════
   網站設定
════════════════════════════════════════════════════════════ */
async function loadSiteSettings() {
  const d = await safeGetDoc(db.collection('settings').doc('site'));
  setValue('#site-name',        d.siteName        || '');
  setValue('#site-description', d.siteDescription || '');
  setValue('#contact-email',    d.contactEmail    || '');
  setValue('#contact-phone',    d.contactPhone    || '');
  setValue('#contact-address',  d.contactAddress  || '');
  setValue('#social-ig',        d.socialIG        || '');
  setValue('#social-fb',        d.socialFB        || '');
  setValue('#social-line',      d.socialLine      || '');
}

function initSettingsPage() {
  $('#save-site-settings-btn')?.addEventListener('click', async () => {
    try {
      await db.collection('settings').doc('site').set({
        siteName:        getValue('#site-name'),
        siteDescription: getValue('#site-description'),
        contactEmail:    getValue('#contact-email'),
        contactPhone:    getValue('#contact-phone'),
        contactAddress:  getValue('#contact-address'),
        socialIG:        getValue('#social-ig'),
        socialFB:        getValue('#social-fb'),
        socialLine:      getValue('#social-line'),
        updatedAt:       firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      toast('設定已儲存', 'success');
    } catch (e) {
      toast('儲存失敗：' + e.message, 'error');
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   Modal 系統
════════════════════════════════════════════════════════════ */
function openModal(id)  { document.getElementById(id)?.classList.add('open');    document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); document.body.style.overflow = ''; }

function initModals() {
  $$('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = btn.closest('.modal-overlay');
      if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
    });
  });
  $$('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   刪除確認
════════════════════════════════════════════════════════════ */
function confirmDelete(type, id, name) {
  $('#confirm-message').textContent =
    type === 'product'
      ? `確定要刪除產品「${name}」嗎？此操作無法復原。`
      : `確定要刪除文章「${name}」嗎？此操作無法復原。`;

  const doBtn = $('#confirm-do-btn');
  doBtn.onclick = async () => {
    doBtn.disabled = true;
    try {
      await db.collection(type === 'product' ? 'products' : 'articles').doc(id).delete();
      toast(type === 'product' ? '產品已刪除' : '文章已刪除', 'success');
      closeModal('confirm-modal');
      type === 'product' ? loadProducts() : loadArticles();
    } catch (e) {
      toast('刪除失敗：' + e.message, 'error');
    } finally {
      doBtn.disabled = false;
    }
  };
  openModal('confirm-modal');
}

/* ═══════════════════════════════════════════════════════════════
   Toast
════════════════════════════════════════════════════════════ */
function toast(msg, type = 'info') {
  const icons     = { success: '✓', error: '✕', info: 'ℹ' };
  const container = $('#toast-container');
  const div       = document.createElement('div');
  div.className   = `toast ${type}`;
  div.innerHTML   = `<span class="toast-icon">${icons[type]}</span><span>${escHtml(msg)}</span>`;
  container.appendChild(div);
  setTimeout(() => {
    div.style.cssText += 'opacity:0;transform:translateX(20px);transition:0.3s';
    setTimeout(() => div.remove(), 300);
  }, 3500);
}

/* ═══════════════════════════════════════════════════════════════
   工具函式
════════════════════════════════════════════════════════════ */
const getValue   = sel => document.querySelector(sel)?.value || '';
const setValue   = (sel, val)  => { const el = document.querySelector(sel); if (el) el.value = val; };
const setText    = (sel, val)  => { const el = document.querySelector(sel); if (el) el.textContent = val; };
const escHtml    = str => String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const catLabel   = v => ({ single:'單方精油', compound:'複方精油', spray:'噴霧', massage:'按摩油', 'eye-mask':'眼罩' }[v] || v || '—');
const statusLabel= s => ({ pending:'待處理', paid:'已付款', shipped:'已出貨', done:'已完成', cancel:'已取消' }[s] || '待處理');

// Firestore Timestamp / Date / 字串 都能轉成 Date
function toDate(ts) {
  if (!ts) return new Date(0);
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
}

function formatDate(ts) {
  const d = toDate(ts);
  return d.getTime() === 0 ? '—' : d.toLocaleDateString('zh-TW');
}

function skeletonRow(cols) {
  return `<tr><td colspan="${cols}"><div class="skeleton" style="height:14px;margin:8px 0"></div></td></tr>`;
}

/* ═══════════════════════════════════════════════════════════════
   啟動
════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // EmailJS 初始化
  if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_CONFIG.publicKey);
  }

  initAuth();
  initNav();
  initModals();
  initHomepageSettings();
  initProductsPage();
  initArticlesPage();
  initOrdersPage();
  initMembersPage();
  initSettingsPage();

  // 插入連結
  $('#insert-link-btn')?.addEventListener('mousedown', e => {
    e.preventDefault();
    const url = prompt('請輸入連結網址：');
    if (url) document.execCommand('createLink', false, url);
  });
});
