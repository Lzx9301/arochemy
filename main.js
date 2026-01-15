(() => {
    const burgerBtn = document.getElementById("burgerBtn");
    const drawer = document.getElementById("mobileDrawer");

    const isOpen = () => drawer?.classList.contains("open");

    const setDrawerOpen = (open) => {
        if (!drawer || !burgerBtn) return;
        drawer.classList.toggle("open", open);
        drawer.setAttribute("aria-hidden", String(!open));
        burgerBtn.setAttribute("aria-expanded", String(open));
        document.body.style.overflow = open ? "hidden": "";
    };

    // 漢堡：開/關切換
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

    // // Products page: category dropdown
    // const catBtn = document.getElementById("catBtn");
    // const catMenu = document.getElementById("catMenu");

    // const closeCatMenu = () => {
    //     if (!catMenu || !catBtn) return;
    //     catMenu.classList.remove("open");
    //     catBtn.setAttribute("aria-expanded", "false");
    // };

    // const toggleCatMenu = () => {
    //     if (!catMenu || !catBtn) return;
    //     const isOpen = catMenu.classList.toggle("open");
    //     catBtn.setAttribute("aria-expanded", String(isOpen));
    // };

    // catBtn?.addEventListener("click", (e) => {
    //     e.stopPropagation();
    //     toggleCatMenu();
    // });

    // // 點到頁面其他地方就關閉
    // document.addEventListener("click", () => closeCatMenu());

    // // 點選分類後關閉（先不做篩選也沒關係）
    // catMenu?.querySelectorAll("a").forEach((a) => {
    //     a.addEventListener("click", () => closeCatMenu());
    // });

    // // ESC 關閉
    // window.addEventListener("keydown", (e) => {
    //     if (e.key === "Escape") closeCatMenu();
    // });

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
                plant.style.opacity = showBottle ? "0": "1";
                bottle.style.opacity = showBottle ? "1": "0";
            }, 2500); // ⏱ 每 2.5 秒切換（你可改）
        });
    }

    // ===== Products category menu + title sync =====
    const catToggle = document.getElementById("catToggle");
    const catMenu = document.getElementById("catMenu");
    const currentCat = document.getElementById("currentCat");
    const catItems = document.querySelectorAll(".cat-item");

    /* 開 / 關選單 */
    catToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = catMenu.classList.toggle("open");
        catToggle.setAttribute("aria-expanded", String(isOpen));
    });

    /* 點分類 → 改標題 */
    catItems.forEach(item => {
        item.addEventListener("click", () => {
            const label = item.textContent;

            currentCat.textContent = label; // ⭐ 重點
            catMenu.classList.remove("open");
            catToggle.setAttribute("aria-expanded", "false");

            // 👉 之後你可以在這裡加：
            // filterProducts(item.dataset.cat);
            // or update URL
        });
    });

    /* 點外面關閉 */
    document.addEventListener("click", () => {
        catMenu.classList.remove("open");
        catToggle.setAttribute("aria-expanded", "false");
    });


})();
