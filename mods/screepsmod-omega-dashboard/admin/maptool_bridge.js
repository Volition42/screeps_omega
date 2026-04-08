(function addOmegaAdminMapToolButton() {
  function mountButton() {
    if (document.getElementById("omega-admin-maptool-button")) return;

    const panel = document.querySelector(".controlpanel");
    if (!panel) return;

    const button = document.createElement("button");
    button.id = "omega-admin-maptool-button";
    button.type = "button";
    button.textContent = "Omega Admin Dashboard";
    button.style.marginBottom = "10px";
    button.style.width = "100%";
    button.style.padding = "10px 12px";
    button.style.border = "1px solid #2a5a49";
    button.style.borderRadius = "8px";
    button.style.background = "#2f6a57";
    button.style.color = "#f7f2e8";
    button.style.font = '600 14px/1.1 "Avenir Next", "Segoe UI", sans-serif';
    button.style.cursor = "pointer";
    button.addEventListener("click", () => {
      window.location.assign("/omega-admin/");
    });

    panel.insertBefore(button, panel.firstChild);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountButton, { once: true });
  } else {
    mountButton();
  }
})();
