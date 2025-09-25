import { renderHTML } from "../../utils/dom.js";
import { register } from "../../core/auth.js";

export async function render(root) {
  root.innerHTML = await renderHTML("./screens/register/register.html");

  const form = root.querySelector("#formRegister");
  const pwd = root.querySelector("#passwordInput");
  const confirm = root.querySelector("#confirmInput");
  const help = root.querySelector("#pwdHelp");

  // Botón fuera del <form>, se selecciona por el atributo form="formRegister"
  const btn = root.querySelector('button[form="formRegister"][type="submit"]');

  const togglePwd = root.querySelector("#togglePassword");
  const toggleConfirm = root.querySelector("#toggleConfirm");

  const toggle = (input, el) => {
    if (!input || !el) return;
    el.addEventListener("click", () => {
      const toText = input.type === "password";
      input.type = toText ? "text" : "password";
      el.classList.toggle("bi-eye", !toText);
      el.classList.toggle("bi-eye-slash", toText);
    });
  };
  toggle(pwd, togglePwd);
  toggle(confirm, toggleConfirm);

  const match = () => {
    const ok = (pwd?.value ?? "") === (confirm?.value ?? "");
    if (help) help.classList.toggle("d-none", ok);
    return ok;
  };
  pwd?.addEventListener("input", match);
  confirm?.addEventListener("input", match);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!match()) {
      Swal.fire({
        icon: "warning",
        title: "Contraseñas no coinciden",
        text: "Por favor revisa tu contraseña",
      });
      return;
    }

    const payload = {
      email: form.email.value.trim(),
      password: form.password.value,
      displayName: form.nombre.value.trim(),
      nombre: form.nombre.value.trim(),
      apellidoP: form.apellidoP.value.trim(),
      apellidoM: form.apellidoM.value.trim(),
      fechaNac: form.fechaNac.value,
      telefono: form.telefono.value.trim(),
    };

    // Manejo seguro del botón (si existe)
    const originalHTML = btn ? btn.innerHTML : null;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        Registrando...
      `;
    }

    try {
      const res = await register(payload);
      Swal.fire({
        icon: "success",
        title: "¡Cuenta creada!",
        text: `Bienvenido ${res.email}`,
        confirmButtonText: "Iniciar sesión",
      }).then(() => location.replace("#/login"));
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error en el registro",
        text: err.message || "No se pudo crear la cuenta",
      });
    } finally {
      if (btn && originalHTML != null) {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
      }
    }
  });
}
