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
      Swal.fire({ icon: "warning", title: "Campos requeridos", text: "Debes ingresar correo y contraseña" });
      return;
    }

    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span>Ingresando...`;

    try {
      // login() debe devolver { idToken, refreshToken, uid, expiresIn }
      const r = await login(email, password);

      // Persistencia: idToken y shadow a authToken (para el guard y para SSE)
      if (r?.idToken) {
        localStorage.setItem("idToken", r.idToken);
        localStorage.setItem("authToken", r.idToken);
      } else {
        // fallback legacy
        localStorage.setItem("authToken", "ok");
      }

      // Perfil básico para topbar
      const user = inferUserFromEmail(email);
      localStorage.setItem("user", JSON.stringify(user));

      Swal.fire({
        icon: "success",
        title: "¡Bienvenido!",
        showConfirmButton: false,
        timer: 900,
      }).then(() => location.replace("#/dashboard"));
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error en el login", text: "Credenciales inválidas" });
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

function inferUserFromEmail(email) {
  const userPart = (email || "").split("@")[0] || "";
  const parts = userPart.split(/[.\-_ ]+/).filter(Boolean);
  const first = parts[0] ? capitalize(parts[0]) : "Usuario";
  const last  = parts[1] ? capitalize(parts[1]) : "";
  return { firstName: first, lastName: last, email };
}
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);
