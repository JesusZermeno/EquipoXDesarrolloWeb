import { renderHTML } from "../../utils/dom.js";

export async function render(root) {
  const html = await renderHTML("./screens/splash/splash.html");
  root.innerHTML = html;

  // Pequeño delay y redirección al login
  setTimeout(() => { location.hash = "/login"; }, 3000);
}
