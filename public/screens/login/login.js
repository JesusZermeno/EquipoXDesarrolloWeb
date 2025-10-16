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
      // Si tu login() devuelve { token, user }, aprovéchalo:
      //   user: { firstName, lastName, email } (puede variar)
      const result = await login(email, password);

      // === Persistencia de sesión (coincidir con el guard del router) ===
      const token = result?.token ?? "ok";
      localStorage.setItem("authToken", token);

      // === Guardar perfil para topbar ===
      // Si tu backend retorna user, úsalo; si no, lo inferimos desde el email.
      const profile = normalizeUser(result?.user) ?? inferUserFromEmail(email);
      localStorage.setItem("user", JSON.stringify(profile));

      Swal.fire({
        icon: "success",
        title: "¡Bienvenido!",
        text: "Inicio de sesión correcto",
        showConfirmButton: false,
        timer: 1000,
        timerProgressBar: true,
        didClose: () => {
          location.replace("#/dashboard");
        },
      });

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

  // Mostrar/ocultar contraseña
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      const toText = passwordInput.type === "password";
      passwordInput.type = toText ? "text" : "password";
      togglePassword.classList.toggle("bi-eye", !toText);
      togglePassword.classList.toggle("bi-eye-slash", toText);
    });
  }
}

/* ========= Helpers ========= */
// Acomoda un objeto user proveniente del backend a { firstName, lastName, email }
function normalizeUser(user) {
  if (!user) return null;
  const firstName = user.firstName ?? user.name ?? user.given_name ?? "";
  const lastName  = user.lastName  ?? user.surname ?? user.family_name ?? "";
  const email     = user.email ?? "";
  const fn = String(firstName || "").trim();
  const ln = String(lastName || "").trim();
  if (!fn && !ln && !email) return null;
  return {
    firstName: capitalize(fn || "Usuario"),
    lastName: capitalize(ln || ""),
    email
  };
}

// Si no viene user del backend, inferimos desde el email
function inferUserFromEmail(email) {
  const userPart = (email || "").split("@")[0] || "";
  const parts = userPart.split(/[.\-_ ]+/).filter(Boolean);
  const first = parts[0] ? capitalize(parts[0]) : "Usuario";
  const last  = parts[1] ? capitalize(parts[1]) : "";
  return { firstName: first, lastName: last, email };
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}
