/* ── Arochemy 自訂 Firebase Email Action Handler 邏輯 ──────────
   沿用跟 login.html 完全相同的 Firebase config / SDK 版本，
   避免重複初始化造成衝突(用 getApps().length 防衛，這個頁面
   是獨立載入，本來就不會跟 login.html 共用同一個 JS context，
   這個防衛寫法只是沿用專案既有慣例，保持風格一致)。 */

import { initializeApp, getApps, getApp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, verifyPasswordResetCode, confirmPasswordReset, applyActionCode }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const cfg = {
  apiKey: 'AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI',
  authDomain: 'trying-89dc6.firebaseapp.com',
  projectId: 'trying-89dc6',
  storageBucket: 'trying-89dc6.firebasestorage.app',
  messagingSenderId: '115559148124',
  appId: '1:115559148124:web:ac37b9c249183a919b5499',
};

const app  = getApps().length ? getApp() : initializeApp(cfg);
const auth = getAuth(app);
const $    = id => document.getElementById(id);

/* ── 畫面切換：一次只顯示一個 .auth-view ── */
function showView(id) {
  document.querySelectorAll('.auth-view').forEach(el => el.classList.remove('active'));
  $(id)?.classList.add('active');
}

function showError(title, text) {
  $('errorTitle').textContent = title;
  $('errorText').textContent  = text;
  showView('viewError');
}

/* ── Firebase 錯誤碼 → 繁體中文友善訊息，絕對不把原始 error code 丟給使用者 ── */
function friendlyErrorText(code) {
  return ({
    'auth/expired-action-code': '此連結已過期，請重新申請。',
    'auth/invalid-action-code': '此連結已失效或已被使用過，請重新申請。',
    'auth/user-disabled':       '此帳號已被停用，請聯絡客服協助處理。',
    'auth/user-not-found':      '找不到對應的會員帳號，請確認連結是否正確。',
    'auth/weak-password':       '密碼強度不足，請設定至少 6 個字元的密碼。',
    'auth/network-request-failed': '網路連線異常，請檢查網路連線後再試一次。',
  })[code] || '發生未知錯誤，請稍後再試，或重新申請一次。';
}

/* ══════════════════════════════════════════════════════════
   主流程：解析網址參數，依 mode 分流處理
══════════════════════════════════════════════════════════ */
async function init() {
  const params  = new URLSearchParams(window.location.search);
  const mode    = params.get('mode');
  const oobCode = params.get('oobCode');

  if (!oobCode) {
    showError('連結不完整', '此連結不完整，請重新由 Email 中開啟完整連結。');
    return;
  }

  if (mode === 'resetPassword') {
    await handleResetPassword(oobCode);
  } else if (mode === 'verifyEmail') {
    await handleVerifyEmail(oobCode);
  } else {
    // 不支援的 mode(例如 recoverEmail 等 Firebase 其他內建類型)，顯示友善畫面，不讓頁面壞掉
    showError('不支援的操作', '此連結的操作類型不受支援。');
  }
}

/* ══════════════════════════════════════════════════════════
   resetPassword：驗證 oobCode → 顯示表單 → 送出新密碼
══════════════════════════════════════════════════════════ */
async function handleResetPassword(oobCode) {
  try {
    // 確認這個 oobCode 是否有效(未過期、未使用過)
    await verifyPasswordResetCode(auth, oobCode);
  } catch (e) {
    showError('此密碼重設連結已失效', friendlyErrorText(e.code));
    return;
  }

  showView('viewResetForm');

  const msgEl = $('resetFormMsg');
  const btn   = $('confirmResetBtn');
  let submitting = false; // 防止按鈕被連續重複提交

  btn.addEventListener('click', async () => {
    if (submitting) return;

    msgEl.textContent = '';
    msgEl.className = 'auth-msg';

    const pw1 = $('newPassword').value;
    const pw2 = $('newPasswordConfirm').value;

    if (!pw1 || !pw2) {
      msgEl.textContent = '請輸入新密碼並再次確認。';
      msgEl.className = 'auth-msg error';
      return;
    }
    if (pw1.length < 6) {
      msgEl.textContent = '密碼至少需要 6 個字元。';
      msgEl.className = 'auth-msg error';
      return;
    }
    if (pw1 !== pw2) {
      msgEl.textContent = '兩次輸入的密碼不一致，請重新確認。';
      msgEl.className = 'auth-msg error';
      return;
    }

    submitting = true;
    btn.disabled = true;
    btn.textContent = '更新中…';

    try {
      await confirmPasswordReset(auth, oobCode, pw1);
      showView('viewResetSuccess');
    } catch (e) {
      msgEl.textContent = friendlyErrorText(e.code);
      msgEl.className = 'auth-msg error';
      submitting = false;
      btn.disabled = false;
      btn.textContent = '確認修改';
    }
  });
}

/* ══════════════════════════════════════════════════════════
   verifyEmail：套用驗證碼，完成 Email 驗證
══════════════════════════════════════════════════════════ */
async function handleVerifyEmail(oobCode) {
  try {
    await applyActionCode(auth, oobCode);
    showView('viewVerifySuccess');
  } catch (e) {
    showError('此驗證連結已失效', friendlyErrorText(e.code));
  }
}

init();
