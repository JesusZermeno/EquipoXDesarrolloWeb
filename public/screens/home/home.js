import { renderHTML } from '../../utils/dom.js';
import { requireAuth } from '../../core/guards.js';

export async function render(root) {
  // Protegemos esta pantalla:
  requireAuth(async () => {
    root.innerHTML = await renderHTML('./screens/home/home.html');
  });
}
