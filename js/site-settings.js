/**
 * Arochemy — 網站設定同步(頁尾聯絡資訊、社群連結)
 * 讀取 Firestore settings/site，套用到所有頁面共用的頁尾與社群按鈕元素。
 * 這支檔案在每一頁都會載入，確保後台改了聯絡資訊/社群連結後，全站畫面都會同步更新。
 */
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

(async function applySiteSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'site'));
    if (!snap.exists()) return;
    const site = snap.data();

    const setText = (id, text) => { const el = document.getElementById(id); if (el && text) el.textContent = text; };
    const setHref = (id, url)  => { const el = document.getElementById(id); if (el && url)  el.href = url; };

    if (site.contactPhone)   setText('footer-tel',     'Tel：'   + site.contactPhone);
    if (site.contactEmail)   setText('footer-email',   'Email：' + site.contactEmail);
    if (site.contactAddress) setText('footer-address', '地址：' + site.contactAddress);

    setHref('social-ig-btn',   site.socialIG);
    setHref('social-line-btn', site.socialLine);
    setHref('social-fb-btn',   site.socialFB);
  } catch (e) {
    console.warn('[site-settings] 讀取網站設定失敗:', e.message);
  }
})();
