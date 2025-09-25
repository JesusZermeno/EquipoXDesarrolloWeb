import { renderHTML } from "../../utils/dom.js";
import { login } from "../../core/auth.js";

export async function render(root) {
  root.innerHTML = await renderHTML("./screens/login/login.html");
  const form = root.querySelector("#formLogin");
  const passwordInput = root.querySelector("#passwordInput");
  const togglePassword = root.querySelector("#togglePassword");
  const btn = form.querySelector("button[type=submit]");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value.trim();

    if (!email || !password) {
      Swal.fire({
        icon: "warning",
        title: "Campos requeridos",
        text: "Debes ingresar correo y contraseña",
      });
      return;
    }

    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      Ingresando...
    `;

    try {
      await login(email, password);

      Swal.fire({
        icon: "success",
        title: "¡Bienvenido!",
        text: "Inicio de sesión correcto",
        confirmButtonText: "Continuar",
      }).then(() => location.replace("#/home"));
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error en el login",
        text: "Credenciales inválidas",
      });
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  });

  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      const toText = passwordInput.type === "password";
      passwordInput.type = toText ? "text" : "password";
      togglePassword.classList.toggle("bi-eye", !toText);
      togglePassword.classList.toggle("bi-eye-slash", toText);
    });
  }
}
