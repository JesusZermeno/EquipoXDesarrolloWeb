import { renderHTML } from "../../utils/dom.js";

export async function render(root) {
  const html = await renderHTML("./screens/splash/splash.html");
  root.innerHTML = html;

  // Después del splash, ve a HOME (si quieres saltar al dashboard cuando hay sesión, ver comentario abajo)
  setTimeout(() => {
    // Si prefieres: const hasSession = !!(localStorage.getItem("authToken") || sessionStorage.getItem("authToken"));
    // location.hash = hasSession ? "/dashboard" : "/home";
    location.hash = "/home";
  }, 1500);
}
