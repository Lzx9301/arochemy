import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

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

const CART_PREFIX = 'arochemy_cart:';
const FAV_PREFIX  = 'arochemy_favs:';

let owner = null;
const listeners = new Set();
let resolveReady;
export const ownerReady = new Promise(r => { resolveReady = r; });

export function isOwnerReady() { return owner !== null; }
export function cartKey() { return owner ? CART_PREFIX + owner : null; }
export function favKey()  { return owner ? FAV_PREFIX + owner : null; }

function readList(key) {
  if (!key) return [];
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function writeList(key, list) {
  if (!key) return false;
  try { localStorage.setItem(key, JSON.stringify(list)); return true; }
  catch { return false; }
}

export function getCart()      { return readList(cartKey()); }
export function saveCart(cart) { const ok = writeList(cartKey(), cart); window.updateCartBadge?.(); return ok; }
export function getFavs()      { return readList(favKey()); }
export function saveFavs(ids)  { return writeList(favKey(), ids); }

export function clearCart() {
  return ownerReady.then(() => {
    try { localStorage.removeItem(cartKey()); } catch {}
    window.updateCartBadge?.();
  });
}

export function onOwnerChange(cb) { listeners.add(cb); }

onAuthStateChanged(auth, user => {
  const next = user ? 'u_' + user.uid : 'guest';
  const changed = owner !== null && owner !== next;
  owner = next;
  window.__arochemyCartKey = CART_PREFIX + owner;
  resolveReady(owner);
  window.updateCartBadge?.();
  if (changed) listeners.forEach(cb => { try { cb(owner); } catch (e) { console.error(e); } });
});

window.arochemyCartStore = { ownerReady, clearCart };
window.dispatchEvent(new Event('arochemy:cart-store-ready'));
