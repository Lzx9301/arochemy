
const firebaseConfig = {
  apiKey: "AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI",
  authDomain: "trying-89dc6.firebaseapp.com",
  projectId: "trying-89dc6",
  storageBucket: "trying-89dc6.firebasestorage.app",
  messagingSenderId: "115559148124",
  appId: "1:115559148124:web:ac37b9c249183a919b5499",
  measurementId: "G-KHR4PVKJCK"
};

const adminApp = firebase.initializeApp(firebaseConfig, 'admin-app');
const auth     = adminApp.auth();
const db       = adminApp.firestore();
const storage  = adminApp.storage();

let currentUser        = null;
let editingProductId   = null;
let editingArticleId   = null;
let productImages      = [];
let productDescImages  = [];
let coverImageFile     = null;
let allOrders          = [];
let currentOrderFilter = 'all';
let currentEditingOrderId = null;

const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const LOADING_TEXT    = '載入中...';
const LOAD_ERROR_TEXT = '資料載入失敗，請稍後再試';

function markLoadError(value, e) {
  Object.defineProperty(value, '__loadError', { value: e || true, enumerable: false });
  return value;
}
function isLoadError(value) { return !!(value && value.__loadError); }

const loadSeq = {};
function nextSeq(key) { loadSeq[key] = (loadSeq[key] || 0) + 1; return loadSeq[key]; }
function isLatest(key, seq) { return loadSeq[key] === seq; }

async function withLoadingButton(btn, task) {
  if (!btn || btn.disabled) return;
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = LOADING_TEXT;
  try { await task(); }
  finally { btn.disabled = false; btn.textContent = orig; }
}

function setFormLoading(fieldSels, btnSels, state) {
  const ready = state === 'success';
  fieldSels.forEach(sel => {
    const el = document.querySelector(sel);
    if (!el) return;
    if (el.dataset.origPlaceholder === undefined) el.dataset.origPlaceholder = el.placeholder || '';
    el.disabled = !ready;
    if (state === 'loading') { el.value = ''; el.placeholder = LOADING_TEXT; }
    else if (state === 'error') { el.value = ''; el.placeholder = LOAD_ERROR_TEXT; }
    else el.placeholder = el.dataset.origPlaceholder;
  });
  btnSels.forEach(sel => { const b = document.querySelector(sel); if (b) b.disabled = !ready; });
}

async function safeGet(ref) {
  try {
    const snap = await ref.get();
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    return items;
  } catch (e) {
    console.warn('safeGet warning:', e.message);
    return markLoadError([], e);
  }
}

async function safeGetDoc(ref) {
  try {
    const doc = await ref.get();
    return doc.exists ? doc.data() : {};
  } catch (e) {
    console.warn('safeGetDoc warning:', e.message);
    return markLoadError({}, e);
  }
}


const ADMIN_EMAILS = ['nicoliu930226@gmail.com', 'info@arochemy.com'];

function checkIsAdmin(user) {
  if (!user || !user.email) return false;
  return ADMIN_EMAILS.includes(user.email.toLowerCase().trim());
}

function initAuth() {
  const loginScreen = $('#login-screen');
  const appLayout   = $('#app-layout');
  const loginBtn    = $('#login-btn');
  const loginErr    = $('#login-error');
  const emailInput  = $('#login-email');
  const passInput   = $('#login-password');

  auth.onAuthStateChanged(user => {
    if (user) {
      if (!checkIsAdmin(user)) {
        auth.signOut();
        loginErr.textContent = '此帳號沒有後台管理權限。';
        loginScreen.style.display = 'flex';
        appLayout.style.display   = 'none';
        return;
      }
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
    loginBtn.textContent = '驗證中…';
    try {
      await auth.signInWithEmailAndPassword(email, pass);
    } catch (err) {
      const msgs = {
        'auth/user-not-found':    '找不到此帳號',
        'auth/wrong-password':    '密碼錯誤',
        'auth/invalid-email':     'Email 格式不正確',
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
    'page-coupons':   '折價券管理',
    'page-messages':  '聯絡訊息',
    'page-settings':  '網站設定',
  };

  const loaders = {
    'page-products': () => loadProducts(),
    'page-articles': () => loadArticles(),
    'page-hero':     loadHomepageSettings,
    'page-settings': loadSiteSettings,
    'page-orders':   () => loadOrders(),
    'page-members':  () => loadMembers(),
    'page-coupons':  () => loadCoupons(),
    'page-messages': () => loadMessages(),
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

async function initDashboard() {
  loadMessages().catch(e => console.warn('[Dashboard] 載入聯絡訊息未讀數量失敗：', e.message));

  const seq = nextSeq('dashboard');
  ['#stat-products', '#stat-articles', '#stat-orders', '#stat-members', '#stat-revenue', '#stat-pending', '#stat-done']
    .forEach(sel => setText(sel, LOADING_TEXT));
  const recentBody = $('#recent-orders-list');
  if (recentBody) recentBody.innerHTML = skeletonRow(4);
  const rankBox = $('#dashboard-sales-rank');
  if (rankBox) rankBox.innerHTML = loadingBlock();

  const [products, articles, orders, members] = await Promise.all([
    safeGet(db.collection('products')),
    safeGet(db.collection('articles')),
    safeGet(db.collection('orders')),
    safeGet(db.collection('members')),
  ]);
  if (!isLatest('dashboard', seq)) return;

  const statOrError = (sel, list, value) => setText(sel, isLoadError(list) ? '載入失敗' : value);
  statOrError('#stat-products', products, products.length);
  statOrError('#stat-articles', articles, articles.length);
  statOrError('#stat-members',  members,  members.length);

  if (isLoadError(orders)) {
    ['#stat-orders', '#stat-revenue', '#stat-pending', '#stat-done'].forEach(sel => setText(sel, '載入失敗'));
    if (recentBody) recentBody.innerHTML = errorRow(4);
    if (rankBox) rankBox.innerHTML = errorBlock();
    return;
  }

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

  setText('#stat-orders',   orders.length);
  setText('#stat-revenue',  monthlyRevenue.toLocaleString());
  setText('#stat-pending',  pendingCount);
  setText('#stat-done',     completedCount);

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

const HOMEPAGE_FIELDS  = ['#hero-title', '#hero-subtitle', '#hero-media-url', '#brand-title', '#brand-body'];
const HOMEPAGE_BUTTONS = ['#save-hero-btn', '#save-brand-btn', '#save-faq-btn', '#add-faq-btn'];

async function loadHomepageSettings() {
  const seq = nextSeq('homepage');
  setFormLoading(HOMEPAGE_FIELDS, HOMEPAGE_BUTTONS, 'loading');
  const faqBox = $('#faq-editor-list');
  if (faqBox) faqBox.innerHTML = loadingBlock();

  const data = await safeGetDoc(db.collection('settings').doc('homepage'));
  if (!isLatest('homepage', seq)) return;
  if (isLoadError(data)) {
    setFormLoading(HOMEPAGE_FIELDS, HOMEPAGE_BUTTONS, 'error');
    if (faqBox) faqBox.innerHTML = errorBlock();
    toast(LOAD_ERROR_TEXT, 'error');
    return;
  }
  setFormLoading(HOMEPAGE_FIELDS, HOMEPAGE_BUTTONS, 'success');

  setValue('#hero-title',    data.heroTitle    || '');
  setValue('#hero-subtitle', data.heroSubtitle || '');

  if (data.heroMedia?.url) {
    setValue('#hero-media-url', data.heroMedia.url);
    setValue('#hero-media-type', data.heroMedia.type || 'image');
    const preview = document.getElementById('hero-media-preview');
    if (preview) {
      preview.style.display = '';
      preview.innerHTML = data.heroMedia.type === 'video'
        ? `<video src="${data.heroMedia.url}" style="width:100%;max-height:160px;object-fit:cover" muted loop autoplay></video>`
        : `<img src="${data.heroMedia.url}" style="width:100%;max-height:160px;object-fit:cover">`;
    }
  }

  document.getElementById('hero-media-input')?.addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const label = document.getElementById('hero-media-label');
    if (label) label.textContent = file.name;
    const reader = new FileReader();
    reader.onload = ev => {
      const preview = document.getElementById('hero-media-preview');
      if (!preview) return;
      preview.style.display = '';
      const isVideo = file.type.startsWith('video/');
      preview.innerHTML = isVideo
        ? `<video src="${ev.target.result}" style="width:100%;max-height:160px;object-fit:cover" muted loop autoplay></video>`
        : `<img src="${ev.target.result}" style="width:100%;max-height:160px;object-fit:cover">`;
    };
    reader.readAsDataURL(file);
  });
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

  $('#save-hero-btn')?.addEventListener('click', async () => {
    const btn = $('#save-hero-btn');
    btn.disabled = true; btn.textContent = '儲存中…';

    let mediaUrl = getValue('#hero-media-url').trim();
    const mediaFile = document.getElementById('hero-media-input')?.files[0];
    const mediaType = getValue('#hero-media-type') || 'image';

    if (mediaFile) {
      btn.textContent = '上傳媒體中…';
      const fd = new FormData();
      fd.append('file', mediaFile);
      fd.append('folder', 'hero');
      const res  = await fetch('https://arochemy-backend-production.up.railway.app/api/upload/image', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) mediaUrl = data.url;
    }

    await saveHomepageSection({
      heroTitle:    getValue('#hero-title'),
      heroSubtitle: getValue('#hero-subtitle'),
      heroMedia:    mediaUrl ? { type: mediaType, url: mediaUrl } : null,
    });

    btn.disabled = false; btn.textContent = '儲存 Hero 設定';
  });

  $('#save-brand-btn')?.addEventListener('click', () => saveHomepageSection({
    brandTitle: getValue('#brand-title'),
    brandBody:  getValue('#brand-body'),
  }));

  $('#add-faq-btn')?.addEventListener('click', () => addFaqItem('', ''));

  $('#save-faq-btn')?.addEventListener('click', () => {
    saveHomepageSection({ faqs: collectFaqs() });
  });
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
  faqs.forEach(f => addFaqItem(f.q, f.a, f.cat));
}

const FAQ_CATS = {
  products: '關於產品',
  care:     '使用與保存',
  custom:   '客製與合作',
  shopping: '購物與配送',
};

function addFaqItem(q = '', a = '', cat = 'products') {
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
      <select class="faq-cat">
        ${Object.entries(FAQ_CATS).map(([k, v]) => `<option value="${k}" ${k === (FAQ_CATS[cat] ? cat : 'products') ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
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
    cat: item.querySelector('.faq-cat')?.value || 'products',
    q: item.querySelector('.faq-q').value.trim(),
    a: item.querySelector('.faq-a').value.trim(),
  })).filter(f => f.q);
}

const SPEC_SIZES = ['5ml', '10ml', '30ml', '50ml', '100ml'];

async function loadProducts(filter = '', catFilter = '') {
  const tbody = $('#products-table-body');
  if (!tbody) return;
  const seq = nextSeq('products');
  tbody.innerHTML = skeletonRow(7);

  const products = await safeGet(db.collection('products'));
  if (!isLatest('products', seq)) return;
  if (isLoadError(products)) { tbody.innerHTML = errorRow(7); return; }
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

  $$('.edit-product-btn').forEach(b  => b.addEventListener('click', () => withLoadingButton(b, () => openProductModal(b.dataset.id))));
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

  const descUploadZone = $('#product-desc-image-upload');
  const descFileInput  = $('#product-desc-image-input');
  descUploadZone?.addEventListener('click', () => descFileInput?.click());
  descUploadZone?.addEventListener('dragover', e => { e.preventDefault(); descUploadZone.classList.add('dragover'); });
  descUploadZone?.addEventListener('dragleave', () => descUploadZone.classList.remove('dragover'));
  descUploadZone?.addEventListener('drop', e => {
    e.preventDefault(); descUploadZone.classList.remove('dragover');
    handleProductDescImages(e.dataTransfer.files);
  });
  descFileInput?.addEventListener('change', e => handleProductDescImages(e.target.files));
}

async function openProductModal(id = null) {
  editingProductId = id;
  productImages     = [];
  productDescImages = [];

  $$('#product-modal input, #product-modal textarea, #product-modal select').forEach(el => {
    if (el.type === 'checkbox') el.checked = false;
    else el.value = '';
  });
  $('#product-image-previews').innerHTML = '';
  $('#product-desc-image-previews').innerHTML = '';
  setValue('#product-status', 'active');
  $('#product-featured').checked = false;
  $('#product-modal-title').textContent = id ? '編輯產品' : '新增產品';

  if (!id) {
    setValue('#product-storage',
      '放置於陰涼處，避免陽光直射。\n保存於孩童、寵物不可及之處。'
    );
    setValue('#product-usage',
      '純精油可搭配擴香工具使用，如擴香石、恆溫擴香器、水氧機等。\n可與酒精調和，製作空間或衣物芳香噴霧。\n若為個人護理用途，以植物油稀釋，建議調配低濃度使用。'
    );
    setValue('#product-caution',
      '不建議嬰幼兒、孕婦使用。\n體質敏感者，使用前務必先進行測試。\n切勿直接塗抹於皮膚、黏膜、鼻子、眼睛、耳道等部位。\n若皮膚受刺激，先以大量植物油塗抹稀釋，再以肥皂水清洗患部，必要時請諮詢醫療專業人員。'
    );
  }

  if (id) {
    try {
      const data = await safeGetDoc(db.collection('products').doc(id));
      if (editingProductId !== id) return;
      if (isLoadError(data)) { toast(LOAD_ERROR_TEXT, 'error'); return; }
      setValue('#product-name',        data.name        || '');
      setValue('#product-category',    data.category    || '');
      setValue('#product-description', data.description || '');
      setValue('#product-status',      data.status      || 'active');
      $('#product-featured').checked = data.featured === true;
      setValue('#product-origin',      data.origin      || '');
      setValue('#product-family',      data.family      || '');
      setValue('#product-latin-name',  data.latinName   || '');
      setValue('#product-extraction',  data.extraction  || '');
      setValue('#product-plant-part',  data.plantPart   || '');
      setValue('#product-scent-note',  data.scentNote   || '');
      setValue('#product-skin-type',   data.skinType    || '');
      setValue('#product-doc-coa',     data.docCOA      || '');
      setValue('#product-doc-sds',     data.docSDS      || '');
      setValue('#product-doc-eu',      data.docEU       || '');
      setValue('#product-composition',
        (data.composition || []).map(c => c.name + ',' + c.pct).join('\n')
      );
      setValue('#product-storage', (data.storage || []).join('\n'));
      setValue('#product-usage',   (data.usage   || []).join('\n'));
      setValue('#product-caution', (data.caution || []).join('\n'));

      const specs = data.specs || {};
      SPEC_SIZES.forEach(size => {
        const row = $(`.spec-row[data-size="${size}"]`);
        if (!row) return;
        const sp = specs[size] || {};
        row.querySelector('.spec-enabled').checked = sp.enabled === true || (sp.enabled !== false && (!!sp.price || sp.stock > 0));
        row.querySelector('.spec-price').value     = sp.price ?? '';
        row.querySelector('.spec-stock').value     = sp.stock !== undefined ? sp.stock : '';
      });

      productImages = (data.images || []).map(url => ({ dataUrl: url }));
      renderProductImagePreviews();
      productDescImages = (data.descriptionImages || []).map(url => ({ dataUrl: url }));
      renderProductDescImagePreviews();
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

function handleProductDescImages(files) {
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => { productDescImages.push({ dataUrl: e.target.result, file }); renderProductDescImagePreviews(); };
    reader.readAsDataURL(file);
  });
}

function renderProductDescImagePreviews() {
  const container = $('#product-desc-image-previews');
  if (!container) return;
  container.innerHTML = '';
  productDescImages.forEach((img, i) => {
    const div = document.createElement('div');
    div.className = 'image-preview-item';
    const src = img.dataUrl || img.url || (typeof img === 'string' ? img : '');
    div.innerHTML = `
      <img src="${escHtml(src)}" alt="描述圖片 ${i+1}"
           style="width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit">
      <button class="image-preview-remove" title="移除此圖片">×</button>
    `;
    div.querySelector('.image-preview-remove').addEventListener('click', () => {
      productDescImages.splice(i, 1);
      renderProductDescImagePreviews();
    });
    container.appendChild(div);
  });
}

function renderProductImagePreviews() {
  const container = $('#product-image-previews');
  if (!container) return;
  container.innerHTML = '';
  productImages.forEach((img, i) => {
    const div = document.createElement('div');
    div.className = 'image-preview-item';
    const src = img.dataUrl || img.url || (typeof img === 'string' ? img : '');
    div.innerHTML = `
      <img src="${escHtml(src)}" alt="圖片 ${i+1}"
           style="width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit">
      <button class="image-preview-remove" title="移除此圖片">×</button>
    `;
    div.querySelector('.image-preview-remove').addEventListener('click', () => {
      productImages.splice(i, 1);
      renderProductImagePreviews();
    });
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
        const fd  = new FormData();
        fd.append('file', img.file);
        fd.append('folder', 'products');
        const res  = await fetch('https://arochemy-backend-production.up.railway.app/api/upload/image', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.url) uploadedUrls.push(data.url);
        else toast('圖片上傳失敗：' + (data.error || '未知錯誤'), 'error');
      } else {
        uploadedUrls.push(img.dataUrl);
      }
    }

    const uploadedDescUrls = [];
    for (const img of productDescImages) {
      if (img.file) {
        const fd  = new FormData();
        fd.append('file', img.file);
        fd.append('folder', 'products');
        const res  = await fetch('https://arochemy-backend-production.up.railway.app/api/upload/image', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.url) uploadedDescUrls.push(data.url);
        else toast('描述圖片上傳失敗：' + (data.error || '未知錯誤'), 'error');
      } else {
        uploadedDescUrls.push(img.dataUrl);
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

    const totalStock = SPEC_SIZES.reduce((s, sz) => {
      const sp = specs[sz];
      if (!sp || !sp.enabled) return s;
      return s + (Number(sp.stock) || 0);
    }, 0);
    const allStock = SPEC_SIZES.reduce((s, sz) => s + (Number(specs[sz]?.stock) || 0), 0);
    let status = getValue('#product-status');
    if (allStock === 0 && status === 'active') {
      status = 'hidden';
      toast('所有規格庫存為 0，已自動下架', 'info');
    }

    const compositionRaw = getValue('#product-composition');
    const composition = compositionRaw
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.includes(','))
      .map(line => {
        const [name, pct] = line.split(',').map(s => s.trim());
        return { name: name || '', pct: Number(pct) || 0 };
      })
      .filter(c => c.name);

    const parseList = sel => getValue(sel).split('\n').map(l => l.trim()).filter(Boolean);

    const data = {
      name:        getValue('#product-name'),
      category:    getValue('#product-category'),
      description: getValue('#product-description'),
      status,
      featured:    $('#product-featured').checked,
      origin:      getValue('#product-origin'),
      family:      getValue('#product-family'),
      latinName:   getValue('#product-latin-name'),
      extraction:  getValue('#product-extraction'),
      plantPart:   getValue('#product-plant-part'),
      scentNote:   getValue('#product-scent-note'),
      skinType:    getValue('#product-skin-type'),
      docCOA:      getValue('#product-doc-coa'),
      docSDS:      getValue('#product-doc-sds'),
      docEU:       getValue('#product-doc-eu'),
      composition,
      storage:     parseList('#product-storage'),
      usage:       parseList('#product-usage'),
      caution:     parseList('#product-caution'),
      specs,
      images:      uploadedUrls,
      descriptionImages: uploadedDescUrls,
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

async function loadArticles(filter = '') {
  const tbody = $('#articles-table-body');
  if (!tbody) return;
  const seq = nextSeq('articles');
  tbody.innerHTML = skeletonRow(5);

  const articles = await safeGet(db.collection('articles'));
  if (!isLatest('articles', seq)) return;
  if (isLoadError(articles)) { tbody.innerHTML = errorRow(5); return; }
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

  $$('.edit-article-btn').forEach(b    => b.addEventListener('click', () => withLoadingButton(b, () => openArticleModal(b.dataset.id))));
  $$('.delete-article-btn').forEach(b  => b.addEventListener('click', () => confirmDelete('article', b.dataset.id, b.dataset.name)));
  $$('.newsletter-btn').forEach(b      => b.addEventListener('click', () => withLoadingButton(b, () => openNewsletterModal(b.dataset.id, b.dataset.title))));
}

function initArticlesPage() {
  $('#add-article-btn')?.addEventListener('click', () => openArticleModal());
  $('#article-search')?.addEventListener('input', e => loadArticles(e.target.value));
  $('#save-article-btn')?.addEventListener('click', saveArticle);

  document.getElementById('article-cover-input')?.addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    coverImageFile = file;

    const labelSpan = document.getElementById('article-cover-label');
    if (labelSpan) labelSpan.textContent = file.name;

    const reader = new FileReader();
    reader.onload = ev => {
      const preview = document.getElementById('cover-preview');
      if (preview) preview.innerHTML = `<img src="${ev.target.result}" alt="封面預覽" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`;
    };
    reader.readAsDataURL(file);
  });

  const coverUrlInput = document.getElementById('article-cover-url');
  coverUrlInput?.addEventListener('input', () => {
    const url     = coverUrlInput.value.trim();
    const preview = document.getElementById('cover-preview');
    if (url && preview) {
      preview.innerHTML = `<img src="${url}" alt="封面預覽" style="width:100%;height:100%;object-fit:cover">`;
    }
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
  coverImageFile = null;

  setValue('#article-title', ''); setValue('#article-category', '');
  setValue('#article-status', 'draft'); setValue('#article-excerpt', '');
  setValue('#article-cover-url', '');
  coverImageFile = null;
  const labelSpan = document.getElementById('article-cover-label');
  if (labelSpan) labelSpan.textContent = '上傳封面';
  const coverPreview = document.getElementById('cover-preview');
  if (coverPreview) coverPreview.innerHTML = `
    <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
    <span style="font-size:12px">點擊上傳封面圖片</span>`;
  setTags([]);
  const editor = $('#article-editor-content');
  if (editor) editor.innerHTML = '';

  if (id) {
    $('#article-modal-title').textContent = '編輯文章';
    const d = await safeGetDoc(db.collection('articles').doc(id));
    if (editingArticleId !== id) return;
    if (isLoadError(d)) { toast(LOAD_ERROR_TEXT, 'error'); return; }
    setValue('#article-title',    d.title    || '');
    setValue('#article-category', d.category || '');
    setValue('#article-status',   d.status   || 'draft');
    setValue('#article-excerpt',  d.excerpt  || '');
    setTags(d.tags || []);
    if (editor) editor.innerHTML = d.content || '';
    if (d.coverImage) {
      setValue('#article-cover-url', d.coverImage);
      const preview = document.getElementById('cover-preview');
      const img     = document.getElementById('cover-preview-img');
      if (preview && img) { img.src = d.coverImage; preview.style.display = ''; }
    }
  } else {
    $('#article-modal-title').textContent = '發布新文章';
  }
  openModal('article-modal');
}

async function saveArticle() {
  const btn = $('#save-article-btn');
  btn.disabled = true; btn.textContent = '儲存中…';

  try {
    let coverUrl = (document.getElementById('article-cover-url')?.value || '').trim();

    if (coverImageFile) {
      btn.textContent = '上傳封面中…';
      try {
        const fd  = new FormData();
        fd.append('file', coverImageFile);
        fd.append('folder', 'articles');
        const res  = await fetch('https://arochemy-backend-production.up.railway.app/api/upload/image', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.url) coverUrl = data.url;
      } catch (e) {
        console.warn('封面上傳失敗，使用網址欄位：', e.message);
      }
    } else if (editingArticleId && !coverUrl) {
      const ex = await safeGetDoc(db.collection('articles').doc(editingArticleId));
      coverUrl = ex.coverImage || '';
    }

    btn.textContent = '寫入資料庫…';
    const editor = $('#article-editor-content');
    const title  = getValue('#article-title');

    if (!title) {
      toast('請填寫文章標題', 'error');
      return;
    }

    const data = {
      title,
      category:   getValue('#article-category'),
      status:     getValue('#article-status'),
      excerpt:    getValue('#article-excerpt'),
      content:    editor?.innerHTML || '',
      tags:       getTags(),
      coverImage: coverUrl,
      updatedAt:  firebase.firestore.FieldValue.serverTimestamp(),
    };

    btn.textContent = '寫入資料庫…';
    console.log('[saveArticle] 開始寫入 Firestore，data:', data);
    console.log('[saveArticle] 當前登入用戶：', auth.currentUser?.email);

    if (editingArticleId) {
      await db.collection('articles').doc(editingArticleId).update(data);
      console.log('[saveArticle] 更新成功');
      toast('文章已更新', 'success');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      const docRef = await db.collection('articles').add(data);
      console.log('[saveArticle] 新增成功，ID:', docRef.id);
      toast('文章已發布', 'success');
    }

    closeModal('article-modal');
    loadArticles();

  } catch (e) {
    console.error('[saveArticle] 完整錯誤：', e);
    console.error('[saveArticle] 錯誤代碼：', e.code);
    console.error('[saveArticle] 錯誤訊息：', e.message);

    let errMsg = '儲存失敗';
    if (e.code === 'permission-denied')  errMsg = '❌ 權限不足：Firestore 規則擋住寫入';
    else if (e.code === 'unavailable')   errMsg = '❌ Firebase 服務暫時無法使用，請稍後再試';
    else if (e.code === 'unauthenticated') errMsg = '❌ 未登入狀態，請重新整理頁面';
    else errMsg = `❌ 儲存失敗（${e.code || 'unknown'}）：${e.message}`;

    toast(errMsg, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '儲存文章';
  }
}

async function openNewsletterModal(articleId, articleTitle) {
  let article = { title: articleTitle, excerpt: '', coverImage: '' };
  try {
    const d = await safeGetDoc(db.collection('articles').doc(articleId));
    if (d.title) article = { id: articleId, ...d };
  } catch(e) {}

  const members     = await safeGet(db.collection('members'));
  if (isLoadError(members)) { toast(LOAD_ERROR_TEXT, 'error'); return; }
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
    btn.disabled = true; btn.textContent = '發送中…';

    try {
      const res  = await fetch('https://arochemy-backend-production.up.railway.app/api/email/newsletter', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId,
          subject: getValue('#newsletter-subject'),
        }),
      });
      const data = await res.json();
      toast(`電子報發送完成：${data.sent} 成功 / ${data.failed} 失敗`, data.sent > 0 ? 'success' : 'error');
    } catch (e) {
      toast('發送失敗：' + e.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = '確認發送';
      closeModal('newsletter-modal');
    }
  };
}


async function updateOrderStatus(orderId, { status, trackingNumber }) {
  const user = auth.currentUser;
  if (!user) throw new Error('登入狀態已失效，請重新登入');
  const token = await user.getIdToken();

  const res = await fetch(`https://arochemy-backend-production.up.railway.app/api/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ status, trackingNumber: trackingNumber || '' }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `更新失敗（${res.status}）`);
  }

  return data;
}

async function loadOrders(statusFilter = null) {
  const tbody = $('#orders-table-body');
  if (!tbody) return;
  if (statusFilter !== null) currentOrderFilter = statusFilter;
  const seq = nextSeq('orders');
  tbody.innerHTML = skeletonRow(7);
  ['#orders-month-revenue', '#orders-pending-count', '#orders-done-count', '#orders-total-count'].forEach(sel => setText(sel, LOADING_TEXT));
  const ordersRank = $('#orders-sales-rank');
  if (ordersRank) ordersRank.innerHTML = loadingBlock();

  const fetched = await safeGet(db.collection('orders'));
  if (!isLatest('orders', seq)) return;
  if (isLoadError(fetched)) {
    tbody.innerHTML = errorRow(7);
    ['#orders-month-revenue', '#orders-pending-count', '#orders-done-count', '#orders-total-count'].forEach(sel => setText(sel, '載入失敗'));
    if (ordersRank) ordersRank.innerHTML = errorBlock();
    return;
  }
  allOrders = fetched;
  allOrders.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));

  const selMonth = $('#order-month-filter')?.value;
  let filtered = allOrders;
  if (selMonth) {
    const [fy, fm] = selMonth.split('-').map(Number);
    filtered = filtered.filter(o => {
      const ts = toDate(o.createdAt);
      return ts.getFullYear() === fy && (ts.getMonth() + 1) === fm;
    });
  }

  if (currentOrderFilter && currentOrderFilter !== 'all') {
    filtered = filtered.filter(o => o.status === currentOrderFilter);
  }

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
        <td class="td-name">${escHtml(o.customerName || '—')}${o.stockShortage ? ' <span title="已付款但庫存不足，需人工處理" style="color:#b94a48;font-size:11px;font-weight:700;white-space:nowrap">⚠ 庫存不足</span>' : ''}</td>
        <td style="font-size:12px;color:var(--text-secondary)">${escHtml(o.customerEmail || '—')}</td>
        <td style="font-size:12px">${escHtml(o.shippingMethod || '—')}</td>
        <td style="color:var(--accent);font-weight:500">NT$ ${Number(o.total||0).toLocaleString()}</td>
        <td>
          <select class="status-select-inline" data-id="${o.id}">
            ${['pending','paid','shipped','done','cancel','refunded'].map(s =>
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
        const newStatus = sel.value;
        const orderId   = sel.dataset.id;
        try {
          await updateOrderStatus(orderId, { status: newStatus });
          toast(
            newStatus === 'shipped'
              ? '訂單已標記為已出貨，如需填寫物流單號請點「查看」進入詳細資料'
              : '訂單狀態已更新',
            'success'
          );
          loadOrders();
        } catch (e) {
          toast('更新失敗：' + e.message, 'error');
          loadOrders();
        }
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

  $('#order-detail-save-status-btn')?.addEventListener('click', async () => {
    if (!currentEditingOrderId) return;

    const errorEl = $('#order-detail-status-error');
    errorEl.style.display = 'none';

    const status         = getValue('#order-detail-status-select');
    const trackingNumber = getValue('#order-detail-tracking-input').trim();

    const btn = $('#order-detail-save-status-btn');
    btn.disabled = true;
    btn.textContent = '儲存中…';

    try {
      await updateOrderStatus(currentEditingOrderId, { status, trackingNumber });
      toast('訂單狀態已更新', 'success');
      closeModal('order-detail-modal');
      loadOrders();
    } catch (e) {
      errorEl.textContent = '更新失敗：' + e.message;
      errorEl.style.display = '';
    } finally {
      btn.disabled = false;
      btn.textContent = '儲存狀態';
    }
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
  const shortageNote = o.stockShortage
    ? '⚠ 已付款但庫存不足，需人工處理：' + (o.stockShortageItems || [])
        .map(i => `${i.name || ''}（${i.spec || ''}）訂購 ${i.requested}／付款當下庫存 ${i.available}`).join('；') + '\n'
    : '';
  setText('#order-detail-note',  shortageNote + (o.note || '（無備註）'));
  setText('#order-detail-status', statusLabel(o.status));

  currentEditingOrderId = o.id;
  setValue('#order-detail-status-select', o.status || 'pending');
  setValue('#order-detail-tracking-input', o.trackingNumber || '');
  $('#order-detail-status-error').style.display = 'none';

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

  const shippingRow = $('#order-detail-shipping-row');
  if (shippingRow) {
    const hasShipping = o.shippingFee !== undefined && o.shippingFee !== null;
    shippingRow.style.display = hasShipping ? '' : 'none';
    if (hasShipping) {
      setText('#order-detail-shipping', Number(o.shippingFee) > 0 ? 'NT$ ' + Number(o.shippingFee).toLocaleString() : '免運');
    }
  }
  setText('#order-detail-total', 'NT$ ' + Number(o.total || total).toLocaleString());
  openModal('order-detail-modal');
}

async function renderSalesRank(containerSel, limit = 5, ordersData = null) {
  const container = $(containerSel);
  if (!container) return;

  const orders    = ordersData || await safeGet(db.collection('orders'));
  if (isLoadError(orders)) { container.innerHTML = errorBlock(); return; }
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

async function loadMembers(filter = '') {
  const tbody = $('#members-table-body');
  if (!tbody) return;
  const seq = nextSeq('members');
  tbody.innerHTML = skeletonRow(8);
  setText('#members-sub-count', LOADING_TEXT);

  const members = await safeGet(db.collection('members'));
  if (!isLatest('members', seq)) return;
  if (isLoadError(members)) {
    tbody.innerHTML = errorRow(7);
    setText('#members-sub-count', '載入失敗');
    return;
  }
  members.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));

  const filtered  = filter
    ? members.filter(m => m.name?.toLowerCase().includes(filter.toLowerCase()) || m.email?.toLowerCase().includes(filter.toLowerCase()))
    : members;

  const subCount = members.filter(m => m.subscribed === true).length;
  setText('#stat-members',       members.length);
  setText('#members-sub-count',  subCount);

  tbody.innerHTML = '';
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">目前沒有會員資料</td></tr>`;
    return;
  }

  filtered.forEach(m => {
    const initials = (m.name || m.email || '?')[0].toUpperCase();
    const birthdayText = m.birthday || '未設定';
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
      <td style="font-size:12px;color:var(--text-secondary)">${escHtml(birthdayText)}</td>
      <td><span class="badge badge-${m.subscribed ? 'success' : 'hidden'}">${m.subscribed ? '✓ 已訂閱' : '未訂閱'}</span></td>
      <td style="font-size:12px;color:var(--text-muted)">${formatDate(m.createdAt)}</td>
      <td><button class="btn btn-sm btn-secondary member-edit-btn" data-id="${m.id}">編輯</button></td>
    `;
    tbody.appendChild(tr);
  });

  $$('.member-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => withLoadingButton(btn, () => openMemberModal(btn.dataset.id)));
  });
}

let editingMemberId = null;

async function openMemberModal(uid) {
  editingMemberId = uid;
  $('#member-error').style.display = 'none';

  const d = await safeGetDoc(db.collection('members').doc(uid));
  if (editingMemberId !== uid) return;
  if (isLoadError(d)) { toast(LOAD_ERROR_TEXT, 'error'); return; }
  setValue('#member-email',    d.email    || '');
  setValue('#member-name',     d.name     || '');
  setValue('#member-phone',    d.phone    || '');
  setValue('#member-birthday', d.birthday || '');

  openModal('member-modal');
}

async function saveMember() {
  if (!editingMemberId) return;
  const errorEl = $('#member-error');
  errorEl.style.display = 'none';

  const saveBtn = $('#member-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = '儲存中…';

  try {
    await db.collection('members').doc(editingMemberId).update({
      name:     getValue('#member-name'),
      phone:    getValue('#member-phone'),
      birthday: getValue('#member-birthday'),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    toast('會員資料已更新', 'success');
    closeModal('member-modal');
    loadMembers($('#member-search')?.value || '');

  } catch (e) {
    errorEl.textContent = '儲存失敗：' + e.message;
    errorEl.style.display = '';
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '儲存';
  }
}

function initMembersPage() {
  $('#member-cancel-btn')?.addEventListener('click', () => closeModal('member-modal'));
  $('#member-save-btn')?.addEventListener('click', saveMember);

  $('#member-search')?.addEventListener('input', e => loadMembers(e.target.value));

  $('#export-subscribers-btn')?.addEventListener('click', async () => {
    const members     = await safeGet(db.collection('members'));
    if (isLoadError(members)) { toast(LOAD_ERROR_TEXT, 'error'); return; }
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

let editingCouponId = null;

async function loadCoupons(filter = '') {
  const tbody = $('#coupons-table-body');
  if (!tbody) return;
  const seq = nextSeq('coupons');
  tbody.innerHTML = skeletonRow(8);

  const coupons = await safeGet(db.collection('coupons'));
  if (!isLatest('coupons', seq)) return;
  if (isLoadError(coupons)) { tbody.innerHTML = errorRow(8); return; }
  coupons.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));

  const filtered = filter
    ? coupons.filter(c => c.code?.toLowerCase().includes(filter.toLowerCase()))
    : coupons;

  tbody.innerHTML = '';
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">目前沒有折價券，點右上角「新增折價券」建立一張</td></tr>`;
    return;
  }

  filtered.forEach(c => {
    const discountText = c.type === 'percent' ? `${c.value}% 折扣` : `NT$ ${Number(c.value).toLocaleString()}`;

    const conditions = [];
    if (c.minSpend) conditions.push(`滿 NT$${Number(c.minSpend).toLocaleString()}`);
    if (c.newUserOnly) conditions.push(c.newUserWindowDays ? `新戶(註冊${c.newUserWindowDays}天內)` : '新戶限定');
    const conditionText = conditions.length ? conditions.join('、') : '無限制';

    const usedCount  = Number(c.usedCount || 0);
    const usageText  = c.usageLimit ? `${usedCount} / ${c.usageLimit}` : `${usedCount} / 不限`;

    let expiryText = '無期限';
    if (c.endDate) {
      const endDate = toDate(c.endDate);
      const expired = endDate < new Date();
      expiryText = `${expired ? '⚠️ 已過期 ' : ''}${endDate.toLocaleDateString('zh-TW')}`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code style="font-weight:800">${escHtml(c.code)}</code></td>
      <td style="font-size:12px;color:var(--text-secondary)">${escHtml(c.description || '—')}</td>
      <td style="font-weight:700">${discountText}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${escHtml(conditionText)}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${usageText}</td>
      <td style="font-size:12px;color:var(--text-muted)">${expiryText}</td>
      <td><span class="badge badge-${c.enabled !== false ? 'success' : 'hidden'}">${c.enabled !== false ? '啟用中' : '已停用'}</span></td>
      <td>
        <div class="flex-row gap-2">
          <button class="btn btn-sm btn-secondary coupon-edit-btn" data-id="${c.id}">編輯</button>
          <button class="btn btn-sm btn-danger coupon-delete-btn" data-id="${c.id}" data-code="${escHtml(c.code)}">刪除</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  $$('.coupon-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => withLoadingButton(btn, () => openCouponModal(btn.dataset.id)));
  });
  $$('.coupon-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete('coupon', btn.dataset.id, btn.dataset.code));
  });
}

async function openCouponModal(id = null) {
  editingCouponId = id;
  $('#coupon-modal-title').textContent = id ? '編輯折價券' : '新增折價券';
  $('#coupon-error').style.display = 'none';

  setValue('#coupon-code', '');
  setValue('#coupon-description', '');
  setValue('#coupon-type', 'fixed');
  setValue('#coupon-value', '');
  setValue('#coupon-min-spend', '');
  $('#coupon-new-user-only').checked = false;
  setValue('#coupon-new-user-window', '');
  $('#coupon-new-user-window-field').style.display = 'none';
  setValue('#coupon-usage-limit', '');
  setValue('#coupon-expiry-mode', 'none');
  setValue('#coupon-expiry-days', '');
  setValue('#coupon-expiry-date', '');
  $('#coupon-expiry-days-field').style.display = 'none';
  $('#coupon-expiry-date-field').style.display = 'none';
  $('#coupon-enabled').checked = true;
  setValue('#coupon-audience', 'all');
  setValue('#coupon-member-search', '');
  $('#coupon-assigned-member-field').style.display = 'none';
  $('#coupon-assigned-member').innerHTML = '';
  setText('#coupon-assigned-member-hint', '尚未選擇會員');

  if (id) {
    const d = await safeGetDoc(db.collection('coupons').doc(id));
    if (editingCouponId !== id) return;
    if (isLoadError(d)) { toast(LOAD_ERROR_TEXT, 'error'); return; }
    setValue('#coupon-code', d.code || '');
    setValue('#coupon-description', d.description || '');
    setValue('#coupon-type', d.type || 'fixed');
    setValue('#coupon-value', d.value ?? '');
    setValue('#coupon-min-spend', d.minSpend ?? '');
    $('#coupon-new-user-only').checked = !!d.newUserOnly;
    $('#coupon-new-user-window-field').style.display = d.newUserOnly ? '' : 'none';
    setValue('#coupon-new-user-window', d.newUserWindowDays ?? '');
    setValue('#coupon-usage-limit', d.usageLimit ?? '');
    $('#coupon-enabled').checked = d.enabled !== false;

    if (d.assignedCustomerId) {
      setValue('#coupon-audience', 'member');
      $('#coupon-assigned-member-field').style.display = '';
      const pickerOk = await loadMembersForCouponPicker();
      if (editingCouponId !== id) return;
      if (!pickerOk) { toast(LOAD_ERROR_TEXT, 'error'); return; }
      $('#coupon-assigned-member').value = d.assignedCustomerId;
      const matched = cachedMembersForCoupon?.find(m => m.uid === d.assignedCustomerId);
      setText('#coupon-assigned-member-hint',
        matched ? `目前指定：${matched.name || '（未填姓名）'}（${matched.email}）` : '目前指定：此會員資料已不存在');
    }

    if (d.endDate) {
      setValue('#coupon-expiry-mode', 'date');
      const endDate = toDate(d.endDate);
      setValue('#coupon-expiry-date', endDate.toISOString().slice(0, 10));
      $('#coupon-expiry-date-field').style.display = '';
    } else {
      setValue('#coupon-expiry-mode', 'none');
    }
  }

  openModal('coupon-modal');
}

let cachedMembersForCoupon = null;

async function loadMembersForCouponPicker() {
  if (cachedMembersForCoupon) { renderCouponMemberOptions(cachedMembersForCoupon); return true; }
  const selectEl = $('#coupon-assigned-member');
  if (selectEl) selectEl.innerHTML = `<option value="" disabled>${LOADING_TEXT}</option>`;
  const members = await safeGet(db.collection('members'));
  if (cachedMembersForCoupon) { renderCouponMemberOptions(cachedMembersForCoupon); return true; }
  if (isLoadError(members)) {
    if (selectEl) selectEl.innerHTML = `<option value="" disabled>${LOAD_ERROR_TEXT}</option>`;
    return false;
  }
  cachedMembersForCoupon = members.map(m => ({
    uid: m.id, name: m.name || '', email: m.email || '',
  })).filter(m => m.email);
  cachedMembersForCoupon.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'zh-Hant'));
  renderCouponMemberOptions(cachedMembersForCoupon);
  return true;
}

function renderCouponMemberOptions(list, targetSelector = '#coupon-assigned-member') {
  const selectEl = $(targetSelector);
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML = list.length
    ? list.map(m =>
        `<option value="${m.uid}">${escHtml(m.name || '（未填姓名）')}（${escHtml(m.email)}）</option>`
      ).join('')
    : `<option value="" disabled>目前沒有資料</option>`;
  if (current && list.some(m => m.uid === current)) selectEl.value = current;
}

async function saveCoupon() {
  const errorEl = $('#coupon-error');
  errorEl.style.display = 'none';

  const code  = getValue('#coupon-code').trim().toUpperCase();
  const value = Number(getValue('#coupon-value'));

  if (!code) { errorEl.textContent = '請輸入優惠碼'; errorEl.style.display = ''; return; }
  if (!value || value <= 0) { errorEl.textContent = '請輸入有效的折扣數值'; errorEl.style.display = ''; return; }

  const audience = getValue('#coupon-audience');
  let assignedCustomerId = null;
  if (audience === 'member') {
    assignedCustomerId = getValue('#coupon-assigned-member');
    if (!assignedCustomerId) {
      errorEl.textContent = '請選擇要指定的會員';
      errorEl.style.display = '';
      return;
    }
  }

  const type              = getValue('#coupon-type');
  const minSpend          = Number(getValue('#coupon-min-spend')) || 0;
  const newUserOnly       = $('#coupon-new-user-only').checked;
  const newUserWindowDays = getValue('#coupon-new-user-window') ? Number(getValue('#coupon-new-user-window')) : null;
  const usageLimit        = getValue('#coupon-usage-limit') ? Number(getValue('#coupon-usage-limit')) : null;
  const enabled            = $('#coupon-enabled').checked;
  const expiryMode         = getValue('#coupon-expiry-mode');

  let endDate = null;
  if (expiryMode === 'days') {
    const days = Number(getValue('#coupon-expiry-days'));
    if (!days || days <= 0) { errorEl.textContent = '請輸入有效的天數'; errorEl.style.display = ''; return; }
    endDate = firebase.firestore.Timestamp.fromDate(new Date(Date.now() + days * 86400000));
  } else if (expiryMode === 'date') {
    const dateStr = getValue('#coupon-expiry-date');
    if (!dateStr) { errorEl.textContent = '請選擇結束日期'; errorEl.style.display = ''; return; }
    endDate = firebase.firestore.Timestamp.fromDate(new Date(dateStr + 'T23:59:59'));
  }

  const saveBtn = $('#coupon-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = '儲存中…';

  try {
    const dup = await db.collection('coupons').where('code', '==', code).get();
    const isDuplicate = dup.docs.some(d => d.id !== editingCouponId);
    if (isDuplicate) {
      errorEl.textContent = '這個優惠碼已經存在了，請換一個';
      errorEl.style.display = '';
      return;
    }

    const data = {
      code, type, value, minSpend,
      newUserOnly, newUserWindowDays,
      usageLimit, enabled, endDate,
      assignedCustomerId,
      description: getValue('#coupon-description'),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (editingCouponId) {
      await db.collection('coupons').doc(editingCouponId).update(data);
    } else {
      data.usedCount  = 0;
      data.createdAt  = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('coupons').add(data);
    }

    toast(editingCouponId ? '折價券已更新' : '折價券已建立', 'success');
    closeModal('coupon-modal');
    loadCoupons();

  } catch (e) {
    errorEl.textContent = '儲存失敗：' + e.message;
    errorEl.style.display = '';
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '儲存';
  }
}

function initCouponsPage() {
  $('#coupon-search')?.addEventListener('input', e => loadCoupons(e.target.value));
  $('#add-coupon-btn')?.addEventListener('click', () => openCouponModal());
  $('#coupon-cancel-btn')?.addEventListener('click', () => closeModal('coupon-modal'));
  $('#coupon-save-btn')?.addEventListener('click', saveCoupon);

  $('#coupon-new-user-only')?.addEventListener('change', e => {
    $('#coupon-new-user-window-field').style.display = e.target.checked ? '' : 'none';
  });

  $('#coupon-expiry-mode')?.addEventListener('change', e => {
    $('#coupon-expiry-days-field').style.display = e.target.value === 'days' ? '' : 'none';
    $('#coupon-expiry-date-field').style.display = e.target.value === 'date' ? '' : 'none';
  });

  $('#coupon-audience')?.addEventListener('change', async (e) => {
    const isMember = e.target.value === 'member';
    $('#coupon-assigned-member-field').style.display = isMember ? '' : 'none';
    if (isMember) await loadMembersForCouponPicker();
  });

  $('#coupon-member-search')?.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!cachedMembersForCoupon) return;
    const filtered = q
      ? cachedMembersForCoupon.filter(m =>
          m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      : cachedMembersForCoupon;
    renderCouponMemberOptions(filtered);
  });
}

let editingMessageId = null;
let editingMessageStatus = null;

async function loadMessages() {
  const tbody = $('#messages-table-body');
  const seq = nextSeq('messages');
  if (tbody) tbody.innerHTML = skeletonRow(6);

  const messages = await safeGet(db.collection('b2b_inquiries'));
  if (!isLatest('messages', seq)) return;
  if (isLoadError(messages)) {
    if (tbody) tbody.innerHTML = errorRow(6);
    return;
  }
  messages.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));

  const unreadCount = messages.filter(m => m.status === 'unread').length;
  const badge = $('#messages-unread-badge');
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

  if (!tbody) return;

  tbody.innerHTML = '';
  if (!messages.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">目前沒有聯絡訊息</td></tr>`;
    return;
  }

  messages.forEach(m => {
    const isUnread = m.status !== 'read';
    const tr = document.createElement('tr');
    if (isUnread) tr.style.fontWeight = '700';
    tr.style.cursor = 'pointer';
    tr.innerHTML = `
      <td><span class="badge badge-${isUnread ? 'success' : 'hidden'}">${isUnread ? '● 未讀' : '已讀'}</span></td>
      <td>${escHtml(m.name || '—')}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${escHtml(m.email || '—')}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${escHtml(m.subject || '—')}</td>
      <td style="font-size:12px;color:var(--text-muted)">${formatDate(m.createdAt)}</td>
      <td><button class="btn btn-sm btn-secondary message-view-btn" data-id="${m.id}">查看</button></td>
    `;
    tr.querySelector('.message-view-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      withLoadingButton(e.currentTarget, () => openMessageModal(m.id));
    });
    tr.addEventListener('click', () => withLoadingButton(tr.querySelector('.message-view-btn'), () => openMessageModal(m.id)));
    tbody.appendChild(tr);
  });
}

async function openMessageModal(id) {
  const seq = nextSeq('messageModal');
  const d = await safeGetDoc(db.collection('b2b_inquiries').doc(id));
  if (!isLatest('messageModal', seq)) return;
  if (isLoadError(d)) { toast(LOAD_ERROR_TEXT, 'error'); return; }
  editingMessageId     = id;
  editingMessageStatus = d.status === 'read' ? 'read' : 'unread';

  setText('#msg-detail-name',    d.name    || '—');
  setText('#msg-detail-phone',   d.phone   || '—');
  setText('#msg-detail-subject', d.subject || '—');
  setText('#msg-detail-message', d.message || '—');
  setText('#msg-detail-time',    formatDate(d.createdAt));
  setText('#msg-detail-status',  editingMessageStatus === 'read' ? '已讀' : '未讀');

  const emailLink = $('#msg-detail-email');
  if (emailLink) {
    emailLink.textContent = d.email || '—';
    emailLink.href = d.email ? `mailto:${d.email}` : '#';
  }

  const toggleBtn = $('#msg-toggle-status-btn');
  if (toggleBtn) toggleBtn.textContent = editingMessageStatus === 'read' ? '標記為未讀' : '標記為已讀';

  openModal('message-modal');
}

async function toggleMessageStatus() {
  if (!editingMessageId) return;
  const newStatus = editingMessageStatus === 'read' ? 'unread' : 'read';
  const btn = $('#msg-toggle-status-btn');
  btn.disabled = true;
  try {
    await db.collection('b2b_inquiries').doc(editingMessageId).update({ status: newStatus });
    editingMessageStatus = newStatus;
    setText('#msg-detail-status', newStatus === 'read' ? '已讀' : '未讀');
    btn.textContent = newStatus === 'read' ? '標記為未讀' : '標記為已讀';
    loadMessages();
  } catch (e) {
    toast('更新狀態失敗：' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function confirmDeleteMessage() {
  if (!editingMessageId) return;
  $('#confirm-message').textContent = '確定要刪除這則聯絡訊息嗎？刪除後無法復原。';

  const doBtn = $('#confirm-do-btn');
  doBtn.onclick = async () => {
    doBtn.disabled = true;
    try {
      await db.collection('b2b_inquiries').doc(editingMessageId).delete();
      toast('聯絡訊息已刪除', 'success');
      closeModal('confirm-modal');
      closeModal('message-modal');
      loadMessages();
    } catch (e) {
      toast('刪除失敗：' + e.message, 'error');
    } finally {
      doBtn.disabled = false;
    }
  };
  openModal('confirm-modal');
}

function initMessagesPage() {
  $('#msg-toggle-status-btn')?.addEventListener('click', toggleMessageStatus);
  $('#msg-delete-btn')?.addEventListener('click', confirmDeleteMessage);
}

const SITE_FIELDS = ['#site-name', '#site-description', '#contact-email', '#contact-phone', '#contact-address', '#social-ig', '#social-fb', '#social-line'];

async function loadSiteSettings() {
  const seq = nextSeq('site');
  setFormLoading(SITE_FIELDS, ['#save-site-settings-btn'], 'loading');
  const d = await safeGetDoc(db.collection('settings').doc('site'));
  if (!isLatest('site', seq)) return;
  if (isLoadError(d)) {
    setFormLoading(SITE_FIELDS, ['#save-site-settings-btn'], 'error');
    toast(LOAD_ERROR_TEXT, 'error');
    return;
  }
  setFormLoading(SITE_FIELDS, ['#save-site-settings-btn'], 'success');
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

function confirmDelete(type, id, name) {
  const labels = { product: '產品', article: '文章', coupon: '折價券' };
  const collections = { product: 'products', article: 'articles', coupon: 'coupons' };

  $('#confirm-message').textContent = `確定要刪除${labels[type] || '此項目'}「${name}」嗎？此操作無法復原。`;

  const doBtn = $('#confirm-do-btn');
  doBtn.onclick = async () => {
    doBtn.disabled = true;
    try {
      await db.collection(collections[type]).doc(id).delete();
      toast(`${labels[type] || '項目'}已刪除`, 'success');
      closeModal('confirm-modal');
      if (type === 'product') loadProducts();
      else if (type === 'article') loadArticles();
      else if (type === 'coupon') loadCoupons();
    } catch (e) {
      toast('刪除失敗：' + e.message, 'error');
    } finally {
      doBtn.disabled = false;
    }
  };
  openModal('confirm-modal');
}

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

const getValue   = sel => document.querySelector(sel)?.value || '';
const setValue   = (sel, val)  => { const el = document.querySelector(sel); if (el) el.value = val; };
const setText    = (sel, val)  => { const el = document.querySelector(sel); if (el) el.textContent = val; };
const escHtml    = str => String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const catLabel   = v => ({ single:'單方精油', compound:'複方精油', spray:'噴霧', massage:'按摩油', 'eye-mask':'眼罩', diffuser:'擴香瓶' }[v] || v || '—');
const statusLabel= s => ({ pending:'待處理', paid:'已付款', shipped:'已出貨', done:'已完成', cancel:'已取消', refunded:'已退款' }[s] || '待處理');

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
  return `<tr><td colspan="${cols}" style="text-align:center;padding:32px;color:var(--text-muted)">${LOADING_TEXT}</td></tr>`;
}

function errorRow(cols) {
  return `<tr><td colspan="${cols}" style="text-align:center;padding:32px;color:var(--text-muted)">${LOAD_ERROR_TEXT}</td></tr>`;
}

function loadingBlock() {
  return `<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:12px">${LOADING_TEXT}</div>`;
}

function errorBlock() {
  return `<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:12px">${LOAD_ERROR_TEXT}</div>`;
}

document.addEventListener('DOMContentLoaded', () => {


  initAuth();
  initNav();
  initModals();
  initHomepageSettings();
  initProductsPage();
  initArticlesPage();
  initOrdersPage();
  initMembersPage();
  initCouponsPage();
  initMessagesPage();
  initSettingsPage();

  $('#insert-link-btn')?.addEventListener('mousedown', e => {
    e.preventDefault();
    const url = prompt('請輸入連結網址：');
    if (url) document.execCommand('createLink', false, url);
  });
});
