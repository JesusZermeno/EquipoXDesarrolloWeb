import { renderLayout } from "../../core/layout.js";

export async function render() {
  // Pintas el dashboard como siempre
  await renderLayout("./screens/dashboard/dashboard.html");

  // Después de renderizar, inicializa el topbar:
  setupTopbar();
}

function setupTopbar() {
  // 1) Mostrar Nombre Apellido en el topbar
  const nameEl = document.getElementById("userName");
  try {
    const stored = localStorage.getItem("user") || sessionStorage.getItem("user");
    if (stored && nameEl) {
      const u = JSON.parse(stored);
      const fullName = [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim();
      nameEl.textContent = fullName || "Usuario";
    } else if (nameEl) {
      nameEl.textContent = "Usuario";
    }
  } catch {
    if (nameEl) nameEl.textContent = "Usuario";
  }

  // 2) Logout: limpiar sesión y volver a Home
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      try {
        localStorage.removeItem("authToken");
        sessionStorage.removeItem("authToken");
        localStorage.removeItem("user");
        sessionStorage.removeItem("user");
      } finally {
        location.replace("#/home");
      }
    });
  }
}
