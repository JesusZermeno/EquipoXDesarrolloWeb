import { renderHTML } from "../../utils/dom.js";
import { login } from "../../core/auth.js";

// Config: define aquí el correo del admin (fallback si el backend no manda role)
const ADMIN_EMAIL = "admin@suntec.mx";

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
      // login() debe devolver al menos { idToken, ... } y opcionalmente { role }
      const r = await login(email, password);

      // Guarda espejo de token
      if (r?.idToken) {
        localStorage.setItem("idToken", r.idToken);
        localStorage.setItem("authToken", r.idToken);
      } else {
        localStorage.setItem("authToken", "ok");
      }

      // Rol: usa r.role si viene del backend; si no, asume por correo
      const role = (r?.role && String(r.role).toLowerCase()) ||
                   (email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? "admin" : "user");
      localStorage.setItem("role", role);

      // Perfil sencillo para el topbar
      const userObj = inferUserFromEmail(email);
      localStorage.setItem("user", JSON.stringify(userObj));

      Swal.fire({
        icon: "success",
        title: "¡Bienvenido!",
        showConfirmButton: false,
        timer: 700,
      }).then(() => {
        location.replace(role === "admin" ? "#/admin" : "#/dashboard");
      });

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
