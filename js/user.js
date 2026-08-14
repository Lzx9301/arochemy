/**
 * Arochemy — js/user.js
 * Header 登入狀態同步：登入後點人像進會員中心，不跳 confirm
 */
import { initializeApp, getApps, getApp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const firebaseConfig = {
  apiKey:            'AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI',
  authDomain:        'trying-89dc6.firebaseapp.com',
  projectId:         'trying-89dc6',
  storageBucket:     'trying-89dc6.firebasestorage.app',
  messagingSenderId: '115559148124',
  appId:             '1:115559148124:web:ac37b9c249183a919b5499',
};

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

onAuthStateChanged(auth, user => {
  const userArea    = document.getElementById('userArea');
  const userEmailEl = document.getElementById('userEmail');
  if (!userArea) return;

  // 無論登入與否，點人像都去 login.html（會員中心 / 待驗證畫面）
  userArea.href    = 'login.html';
  userArea.onclick = null; // 確保沒有舊的 confirm logout 事件

  if (user && user.emailVerified) {
    /* 已驗證會員：正常顯示登入狀態 */
    if (userEmailEl) userEmailEl.textContent = user.email;
    userArea.title = '會員中心';

  } else if (user && !user.emailVerified) {
    /* 已登入但 Email 還沒驗證：不能當成正常已驗證會員顯示，
       不顯示 Email，圖示點下去會連到 login.html 看到待驗證畫面。
       這裡不另外做一套複雜的提示 UI，維持跟原本一致的簡單樣式。 */
    if (userEmailEl) userEmailEl.textContent = '';
    userArea.title = '請完成 Email 驗證';

  } else {
    /* 未登入 */
    if (userEmailEl) userEmailEl.textContent = '';
    userArea.title = '會員登入';
  }
});
