const CART_KEY = "arochemy_cart";

const $ = (id) => document.getElementById(id);

function fmtPrice(n) {
  return `NT$ ${Number(n).toLocaleString("zh-Hant-TW")}`;
}

function getCart() {
  return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function renderCart() {
  const cart = getCart();
  const list = $("cartList");
  const totalEl = $("cartTotal");

  if (!cart.length) {
    list.innerHTML = `<p class="muted">購物車目前是空的。</p>`;
    totalEl.textContent = "總計：NT$ 0";
    return;
  }

  let total = 0;

  list.innerHTML = cart.map((item, index) => {
    const subtotal = item.price * item.qty;
    total += subtotal;

    return `
      <div class="card" style="padding:20px;margin-bottom:16px;display:grid;grid-template-columns:90px 1fr auto;gap:16px;align-items:center;">
        <div style="width:90px;height:90px;border-radius:16px;background:#f3f3f3;overflow:hidden;">
          ${
            item.image
              ? `<img src="${item.image}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;">`
              : ""
          }
        </div>

        <div>
          <h3 style="margin:0 0 6px;">${item.name}</h3>
          <p class="muted" style="margin:0;">${item.variantLabel}</p>
          <p style="margin:8px 0 0;">${fmtPrice(item.price)}</p>
        </div>

        <div style="display:flex;align-items:center;gap:10px;">
          <button data-action="minus" data-index="${index}">−</button>
          <span>${item.qty}</span>
          <button data-action="plus" data-index="${index}">＋</button>
          <button data-action="remove" data-index="${index}">刪除</button>
        </div>
      </div>
    `;
  }).join("");

  totalEl.textContent = `總計：${fmtPrice(total)}`;
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const cart = getCart();
  const index = Number(btn.dataset.index);
  const action = btn.dataset.action;

  if (!cart[index]) return;

  if (action === "plus") {
    cart[index].qty += 1;
  }

  if (action === "minus") {
    cart[index].qty = Math.max(1, cart[index].qty - 1);
  }

  if (action === "remove") {
    cart.splice(index, 1);
  }

  saveCart(cart);
  renderCart();
});

$("checkoutBtn")?.addEventListener("click", () => {
  const cart = getCart();

  if (!cart.length) {
    $("cartMsg").textContent = "購物車是空的，無法結帳。";
    return;
  }

  $("cartMsg").textContent = "結帳功能下一步製作。";
});

renderCart();
