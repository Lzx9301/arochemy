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
  <div class="card cart-item">
    <div class="cart-item-img">
      ${
        item.image
          ? `<img src="${item.image}" alt="${item.name}">`
          : ""
      }
    </div>

    <div>
      <div class="cart-item-name">${item.name}</div>
      <p class="muted">${item.variantLabel}</p>
      <p>${fmtPrice(item.price)}</p>
    </div>

    <div class="cart-qty">
      <button data-action="minus" data-index="${index}">−</button>
      <span>${item.qty}</span>
      <button data-action="plus" data-index="${index}">＋</button>
      <button class="cart-remove" data-action="remove" data-index="${index}">刪除</button>
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

  window.location.href = "checkout.html";
});

renderCart();
