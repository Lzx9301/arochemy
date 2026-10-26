import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, getDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            'AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI',
  authDomain:        'trying-89dc6.firebaseapp.com',
  projectId:         'trying-89dc6',
  storageBucket:     'trying-89dc6.firebasestorage.app',
  messagingSenderId: '115559148124',
  appId:             '1:115559148124:web:ac37b9c249183a919b5499',
};

const app = getApps().find(a => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);
const db  = getFirestore(app);

const SETTING_TEXT_IDS = ['footer-tel', 'footer-email', 'footer-address', 'contact-tel', 'contact-email'];

function restoreDefaultTexts() {
  SETTING_TEXT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.dataset.default !== undefined && el.textContent.trim() === '載入中...') {
      el.textContent = el.dataset.default;
    }
  });
  document.querySelectorAll('[data-site-field]').forEach(el => {
    if (el.dataset.default !== undefined && el.textContent.trim() === '載入中...') {
      el.textContent = el.dataset.default;
    }
  });
}

function applySiteFields(site) {
  document.querySelectorAll('[data-site-field]').forEach(el => {
    const value = String(site[el.dataset.siteField] ?? '').trim();
    if (value) el.textContent = value;
  });
}

(async function applySiteSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'site'));
    if (!snap.exists()) { restoreDefaultTexts(); return; }
    const site = snap.data();

    const setText = (id, text) => { const el = document.getElementById(id); if (el && text) el.textContent = text; };
    const setHref = (id, url)  => { const el = document.getElementById(id); if (el && url)  el.href = url; };

    if (site.contactPhone)   setText('footer-tel',     'Tel：'   + site.contactPhone);
    if (site.contactEmail)   setText('footer-email',   'Email：' + site.contactEmail);
    if (site.contactAddress) setText('footer-address', '地址：' + site.contactAddress);

    setHref('social-ig-btn',   site.socialIG);
    setHref('social-line-btn', site.socialLine);
    setHref('social-fb-btn',   site.socialFB);
    setHref('footer-ig-link',   site.socialIG);
    setHref('footer-line-link', site.socialLine);
    setHref('articles-follow-link', site.socialIG);
    setHref('faq-ig-link', site.socialIG);
    const tel = document.getElementById('contact-tel');
    if (tel && site.contactPhone) { tel.textContent = site.contactPhone; tel.href = 'tel:' + String(site.contactPhone).replace(/[^0-9+]/g, ''); }
    const mail = document.getElementById('contact-email');
    if (mail && site.contactEmail) { mail.textContent = site.contactEmail; mail.href = 'mailto:' + site.contactEmail; }
    applySiteFields(site);
    restoreDefaultTexts();
  } catch (e) {
    console.warn('[site-settings] 讀取網站設定失敗:', e.message);
    restoreDefaultTexts();
  }
})();
