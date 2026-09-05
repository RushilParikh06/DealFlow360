(() => {
  const routes = {
    login: "pages/login.html",
    dashboard: "pages/dashboard.html",
    quotations: "pages/quotations.html",
    approvals: "pages/approvals.html",
    fulfillment: "pages/fulfillment.html",
    subscriptions: "pages/subscriptions.html",
    invoices: "pages/invoices.html",
    "deal-health": "pages/deal-health.html",
    "admin-reports": "pages/reports.html",
    quote: "pages/quotation-detail.html",
    approval: "pages/approval-detail.html",
    allocation: "pages/warehouse-allocation.html",
    billing: "pages/subscription-billing.html",
    invoice: "pages/invoice-detail.html",
    portal: "pages/customer-quotation.html"
  };

  const root = new URL("./", new URL("../", location.href));
  const go = route => { location.href = new URL(routes[route], root); };
  const page = location.pathname.split("/").pop().replace(/\.html$/, "");
  const label = element => element.textContent.replace(/\s+/g, " ").trim();

  function wireNavigation() {
    const nav = document.querySelector("body > header nav");
    if (!nav) return;

    const activePath = [
      [/^dashboard$/, "dashboard"],
      [/^quotation/, "quotations"],
      [/^approval/, "approvals"],
      [/^fulfillment$|^warehouse-/, "fulfillment"],
      [/^subscriptions$|^subscription-/, "subscriptions"],
      [/^invoices$|^invoice-/, "invoices"],
      [/^deal-health$/, "deal-health"],
      [/^reports$/, "admin-reports"]
    ].find(([pattern]) => pattern.test(page))?.[1];

    nav.querySelectorAll("a").forEach(link => {
      const path = link.dataset.path || label(link).toLowerCase().replace("deal health", "deal-health").replace("reports", "admin-reports");
      if (!routes[path]) return;
      link.dataset.path = path;
      link.href = new URL(routes[path], root);
      if (path === activePath) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    const button = document.createElement("button");
    button.className = "df-menu-button";
    button.type = "button";
    button.setAttribute("aria-label", "Open application navigation");
    button.setAttribute("aria-expanded", "false");
    button.textContent = "☰";

    const mobileNav = nav.cloneNode(true);
    mobileNav.className = "df-mobile-nav";
    mobileNav.removeAttribute("data-active-classes");
    mobileNav.dataset.open = "false";
    mobileNav.querySelectorAll("a[data-path]").forEach(link => {
      link.href = new URL(routes[link.dataset.path], root);
    });

    button.addEventListener("click", () => {
      const open = mobileNav.dataset.open !== "true";
      mobileNav.dataset.open = String(open);
      button.setAttribute("aria-expanded", String(open));
      button.textContent = open ? "×" : "☰";
    });

    nav.after(button);
    document.querySelector("body > header").append(mobileNav);
  }

  function wireBrandLogo() {
    document.querySelectorAll('img[alt*="DealFlow360"]').forEach(image => {
      image.src = new URL("assets/logo.svg", root);
      image.alt = "DealFlow360 logo";
    });
  }

  function wirePageRoutes() {
    const routeRules = [
      [/dashboard/, /New Quotation/, "quote"],
      [/dashboard/, /Browse active ledger/, "quotations"],
      [/dashboard/, /Review approvals queue|^Approvals 3 PENDING$/, "approvals"],
      [/dashboard/, /Open Deal Health triage/, "deal-health"],
      [/dashboard/, /^Q-1042$|Verify Line Items/, "approval"],
      [/dashboard/, /Approve Split/, "allocation"],
      [/^quotations$/, /^Q-1042$|New Quotation/, "quote"],
      [/quotation-detail/, /Preview Customer View/, "portal"],
      [/quotation-detail/, /Submit for Approval/, "approval"],
      [/^approvals$/, /^Q-1042$|Review & Sign-off/, "approval"],
      [/approval-detail/, /^Approvals$/, "approvals"],
      [/^fulfillment$/, /Review Split|View Allocation/, "allocation"],
      [/warehouse-allocation/, /^Fulfillment$/, "fulfillment"],
      [/^subscriptions$/, /^SUB-4012/, "billing"],
      [/subscription-billing/, /^Subscriptions$/, "subscriptions"],
      [/subscription-billing/, /^Q-1042 Enterprise Rev$/, "quote"],
      [/^invoices$/, /View Detail/, "invoice"],
      [/invoice-detail/, /^Invoices$/, "invoices"],
      [/deal-health/, /Review Concession|Audit Trail/, "approval"],
      [/deal-health/, /Reallocate Depot/, "allocation"]
    ];

    document.querySelectorAll("a, button").forEach(element => {
      const match = routeRules.find(([pagePattern, textPattern]) =>
        pagePattern.test(page) && textPattern.test(label(element))
      );
      if (!match) return;
      element.style.cursor = "pointer";
      element.addEventListener("click", event => {
        event.preventDefault();
        go(match[2]);
      });
    });
  }

  function wireLogin() {
    if (page !== "login") return;
    let role = "internal";
    document.getElementById("role-internal")?.addEventListener("click", () => { role = "internal"; });
    document.getElementById("role-customer")?.addEventListener("click", () => { role = "customer"; });
    document.getElementById("submit-btn")?.addEventListener("click", () => {
      go(role === "customer" ? "portal" : "dashboard");
    });
  }

  function wireLogout() {
    const profileImage = document.querySelector('img[alt="Profile"]');
    if (!profileImage) return;

    const logoutButton = document.createElement("button");
    logoutButton.type = "button";
    logoutButton.dataset.logout = "true";
    logoutButton.setAttribute("aria-label", "Log out");
    logoutButton.className = "inline-flex items-center gap-space-xxs px-space-xs py-1 bg-surface-container-lowest text-on-surface border border-outline hover:bg-surface-container transition-colors font-label-md text-label-md";
    logoutButton.innerHTML = '<span class="material-symbols-outlined text-[16px]">logout</span><span class="hidden sm:inline">Log out</span>';
    logoutButton.addEventListener("click", () => go("login"));
    profileImage.replaceWith(logoutButton);
  }

  function isolatePortal() {
    if (page !== "customer-quotation") return;
    document.querySelector("body > header.fixed")?.remove();
    document.querySelector("body > main")?.classList.remove("pt-16");

    document.querySelectorAll("body > main header a, body > main header button").forEach(element => {
      const text = label(element);
      if (text.includes("My Quotation")) element.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
      if (text.includes("Messages")) element.addEventListener("click", () => document.getElementById("dynamicMessages")?.scrollIntoView({ behavior: "smooth" }));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    isolatePortal();
    wireBrandLogo();
    wireNavigation();
    wirePageRoutes();
    wireLogin();
    wireLogout();
  });
})();
