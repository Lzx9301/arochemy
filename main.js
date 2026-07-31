(() => {
  const burgerBtn = document.getElementById("burgerBtn");
  const drawer = document.getElementById("mobileDrawer");

  const isOpen = () => drawer?.classList.contains("open");

  const setDrawerOpen = (open) => {
    if (!drawer || !burgerBtn) return;
    drawer.classList.toggle("open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    burgerBtn.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  };

  // 漢堡：開 / 關切換
  burgerBtn?.addEventListener("click", () => {
    setDrawerOpen(!isOpen());
  });

  // 點到遮罩（非選單內容）就關
  drawer?.addEventListener("click", (e) => {
    if (e.target === drawer) setDrawerOpen(false);
  });

  // 點選單連結後關閉
  drawer?.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => setDrawerOpen(false));
  });

  // ESC 關閉
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setDrawerOpen(false);
  });

  // Footer 年份
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ===== 導覽列下拉選單(產品/服務)：滑鼠裝置用CSS hover，觸控裝置用點擊切換 =====
  (function initNavDropdown() {
    const isFineHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const dropdownItems = document.querySelectorAll(".nav-item.has-dropdown");
    if (!dropdownItems.length) return;

    if (!isFineHover) {
      dropdownItems.forEach((item) => {
        const trigger = item.querySelector(":scope > a");
        trigger?.addEventListener("click", (e) => {
          const alreadyOpen = item.classList.contains("open");
          if (!alreadyOpen) {
            e.preventDefault();
            dropdownItems.forEach((other) => other.classList.remove("open"));
            item.classList.add("open");
          }
          // 已展開時，允許點擊正常導航到該頁面
        });
      });

      document.addEventListener("click", (e) => {
        dropdownItems.forEach((item) => {
          if (!item.contains(e.target)) item.classList.remove("open");
        });
      });
    }
  })();

  // ===== 手機選單內：產品/服務 摺疊子選單 =====
  (function initMobileNavAccordion() {
    document.querySelectorAll(".mnav-item").forEach((item) => {
      const toggle = item.querySelector(".mnav-toggle");
      toggle?.addEventListener("click", () => {
        const isOpenNow = item.classList.contains("open");
        document.querySelectorAll(".mnav-item").forEach((other) => other.classList.remove("open"));
        if (!isOpenNow) item.classList.add("open");
      });
    });
  })();

  // ===== Mobile auto image switch (no hover devices) =====
  if (window.matchMedia("(hover: none)").matches) {
    const cards = document.querySelectorAll(".product-image");

    cards.forEach((imgBox) => {
      const plant = imgBox.querySelector(".p-img.plant");
      const bottle = imgBox.querySelector(".p-img.bottle");
      if (!plant || !bottle) return;

      let showBottle = false;

      setInterval(() => {
        showBottle = !showBottle;
        plant.style.opacity = showBottle ? "0" : "1";
        bottle.style.opacity = showBottle ? "1" : "0";
      }, 2500);
    });
  }
})();


/* ── Header 透明/不透明切換 ────────────────────────────── */
(function initHeaderScroll() {
  const header = document.getElementById('top');
  if (!header) return;

  function updateHeader() {
    if (window.scrollY > 60) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
})();
