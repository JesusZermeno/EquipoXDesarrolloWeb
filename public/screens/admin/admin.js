import { renderLayout } from "../../core/layout.js";

export async function render() {
  // Reutilizamos el mismo layout del dashboard
  await renderLayout("./screens/admin/admin.html");

  // Si quieres ocultar el sidebar para admin, descomenta:
  // const aside = document.getElementById("sidebar");
  // if (aside) aside.style.display = "none";
}
