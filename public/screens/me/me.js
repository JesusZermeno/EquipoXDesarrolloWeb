import { me } from "../../core/auth.js";
export async function render(root){
  root.innerHTML = `<div class="container py-4"><h2>Mi perfil</h2><pre id="meOut">Cargando...</pre></div>`;
  const out = root.querySelector('#meOut');
  out.textContent = JSON.stringify(await me(), null, 2);
}
