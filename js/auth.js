/**
 * Arochemy — js/auth.js v2
 * 登入、註冊、登出、會員中心（個人資料 + 電子報訂閱設定）
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth,
         createUserWithEmailAndPassword,
         signInWithEmailAndPassword,
         signOut,
         onAuthStateChanged }    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore,
         doc, getDoc, setDoc, updateDoc,
         serverTimestamp }       from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ── Firebase ──────────────────────────────────────────────── */
const firebaseConfig = {
  apiKey:            'AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI',
  authDomain:        'trying-89dc6.firebaseapp.com',
  projectId:         'trying-89dc6',
  storageBucket:     'trying-89dc6.firebasestorage.app',
  messagingSenderId: '115559148124',
  appId:             '1:115559148124:web:ac37b9c249183a919b5499',
};

const app  = getApps().find(a => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ── DOM 快捷 ──────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

/* ── 顯示訊息 ──────────────────────────────────────────────── */
function showMsg(elId, text, isError = false) {
  const el = $(elId);
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? '#b94a48' : '#456b55';
}

/* ── 錯誤碼翻譯 ────────────────────────────────────────────── */
function friendlyError(code) {
  const map = {
    'auth/user-not-found':      '找不到此帳號，請先註冊。',
    'auth/wrong-password':      '密碼錯誤，請再試一次。',
    'auth/invalid-credential':  '帳號或密碼錯誤，請再試一次。',
    'auth/email-already-in-use':'此 Email 已被註冊，請直接登入。',
    'auth/weak-password':       '密碼至少需要 6 個字元。',
    'auth/invalid-email':       'Email 格式不正確。',
    'auth/too-many-requests':   '嘗試次數過多，請稍後再試。',
  };
  return map[code] || '發生錯誤，請稍後再試。';
}

/* ── 切換登入 / 註冊模式 ───────────────────────────────────── */
$('showRegisterBtn')?.addEventListener('click', () => {
  $('loginMode').style.display    = 'none';
  $('registerMode').style.display = '';
  showMsg('authMsg', '');
});

$('showLoginBtn')?.addEventListener('click', () => {
  $('registerMode').style.display = 'none';
  $('loginMode').style.display    = '';
  showMsg('authMsg', '');
});

/* ══════════════════════════════════════════════════════════════
   登入
══════════════════════════════════════════════════════════════ */
$('loginBtn')?.addEventListener('click', async () => {
  const email    = $('loginEmail')?.value.trim();
  const password = $('loginPassword')?.value;
  if (!email || !password) { showMsg('authMsg', '請填寫 Email 與密碼。', true); return; }

  const btn = $('loginBtn');
  btn.disabled = true; btn.textContent = '登入中…';
  showMsg('authMsg', '');

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged 接手後續
  } catch (e) {
    showMsg('authMsg', friendlyError(e.code), true);
  } finally {
    btn.disabled = false; btn.textContent = '會員登入';
  }
});

/* ══════════════════════════════════════════════════════════════
   註冊
══════════════════════════════════════════════════════════════ */
$('registerBtn')?.addEventListener('click', async () => {
  const name       = $('regName')?.value.trim();
  const phone      = $('regPhone')?.value.trim();
  const email      = $('regEmail')?.value.trim();
  const password   = $('regPassword')?.value;
  const subscribed = $('regSubscribed')?.checked || false;

  if (!email || !password) { showMsg('authMsg', '請填寫 Email 與密碼。', true); return; }
  if (password.length < 6) { showMsg('authMsg', '密碼至少需要 6 個字元。', true); return; }

  const btn = $('registerBtn');
  btn.disabled = true; btn.textContent = '註冊中…';
  showMsg('authMsg', '');

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'members', cred.user.uid), {
      uid: cred.user.uid,
      name:  name  || '',
      phone: phone || '',
      email,
      subscribed,
      createdAt:   serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
    showMsg('authMsg', '註冊成功！歡迎加入 Arochemy 🌿');
    if (subscribed) localStorage.setItem('arochemy_subscribed', '1');
  } catch (e) {
    showMsg('authMsg', friendlyError(e.code), true);
  } finally {
    btn.disabled = false; btn.textContent = '註冊會員';
  }
});

/* ══════════════════════════════════════════════════════════════
   登出
══════════════════════════════════════════════════════════════ */
$('logoutBtn')?.addEventListener('click', async () => {
  await signOut(auth);
  localStorage.removeItem('arochemy_subscribed');
});

/* ══════════════════════════════════════════════════════════════
   儲存個人資料
══════════════════════════════════════════════════════════════ */
$('saveProfileBtn')?.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return;

  const name  = $('editName')?.value.trim();
  const phone = $('editPhone')?.value.trim();
  const btn   = $('saveProfileBtn');

  btn.disabled = true; btn.textContent = '儲存中…';
  showMsg('memberMsg', '');

  try {
    await updateDoc(doc(db, 'members', user.uid), {
      name:  name  || '',
      phone: phone || '',
      updatedAt: serverTimestamp(),
    });

    // 更新頁面顯示
    if ($('memberName')) $('memberName').textContent = name || '會員';
    if ($('memberInitial')) $('memberInitial').textContent = (name || user.email)[0].toUpperCase();

    showMsg('memberMsg', '✓ 個人資料已更新');
  } catch (e) {
    showMsg('memberMsg', '儲存失敗：' + e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = '儲存資料';
  }
});

/* ══════════════════════════════════════════════════════════════
   更新訂閱設定
══════════════════════════════════════════════════════════════ */
$('saveSubBtn')?.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return;

  const subscribed = $('subToggle')?.checked || false;
  const btn        = $('saveSubBtn');

  btn.disabled = true; btn.textContent = '更新中…';
  showMsg('memberMsg', '');

  try {
    await updateDoc(doc(db, 'members', user.uid), { subscribed, updatedAt: serverTimestamp() });
    if (subscribed) localStorage.setItem('arochemy_subscribed', '1');
    else localStorage.removeItem('arochemy_subscribed');
    showMsg('memberMsg', subscribed ? '✓ 已訂閱電子報' : '✓ 已取消訂閱');
  } catch (e) {
    showMsg('memberMsg', '更新失敗：' + e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = '更新訂閱設定';
  }
});

/* ══════════════════════════════════════════════════════════════
   監聽登入狀態 → 切換面板
══════════════════════════════════════════════════════════════ */
onAuthStateChanged(auth, async user => {
  const authPanel   = $('authPanel');
  const memberPanel = $('memberPanel');

  if (user) {
    // 顯示會員中心
    if (authPanel)   authPanel.style.display   = 'none';
    if (memberPanel) memberPanel.style.display  = '';

    // 更新 header
    const userEmailEl = $('userEmail');
    if (userEmailEl) userEmailEl.textContent = user.email;

    // 填入 email（固定，不可改）
    if ($('editEmail')) $('editEmail').value = user.email;
    if ($('memberEmailDisplay')) $('memberEmailDisplay').textContent = user.email;

    // 更新 lastLoginAt
    try {
      await updateDoc(doc(db, 'members', user.uid), { lastLoginAt: serverTimestamp() });
    } catch(_) {}

    // 讀取會員資料
    try {
      const snap = await getDoc(doc(db, 'members', user.uid));
      if (snap.exists()) {
        const d = snap.data();
        if ($('editName'))    $('editName').value  = d.name  || '';
        if ($('editPhone'))   $('editPhone').value = d.phone || '';
        if ($('subToggle'))   $('subToggle').checked = d.subscribed || false;
        if ($('memberName'))  $('memberName').textContent  = d.name || '會員';
        if ($('memberInitial')) $('memberInitial').textContent = (d.name || user.email)[0].toUpperCase();
      }
    } catch(e) {
      console.warn('讀取會員資料失敗：', e.message);
    }

    // 登入後跳轉
    const redirect = sessionStorage.getItem('loginRedirect');
    if (redirect) {
      sessionStorage.removeItem('loginRedirect');
      window.location.href = redirect;
    }

  } else {
    // 顯示登入/註冊面板
    if (authPanel)   authPanel.style.display   = '';
    if (memberPanel) memberPanel.style.display  = 'none';
  }
});

/* ── 提供給其他頁面的輔助函式 ─────────────────────────────── */
export function getCurrentUser() {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, user => { unsub(); resolve(user); });
  });
}

export { auth, db };
