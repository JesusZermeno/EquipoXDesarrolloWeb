import { renderHTML } from "../../utils/dom.js";

// import { register } from "../../core/auth.js";

export async function render(root) {
  const html = await renderHTML("./screens/register/register.html");
  root.innerHTML = html;

  const form = root.querySelector("#formRegister");
  const pwd = root.querySelector("#passwordInput");
  const confirm = root.querySelector("#confirmInput");
  const help = root.querySelector("#pwdHelp");

  const togglePwd = root.querySelector("#togglePassword");
  const toggleConfirm = root.querySelector("#toggleConfirm");

  // Toggle de contraseña
  if (togglePwd && pwd) {
    togglePwd.addEventListener("click", () => {
      const toText = pwd.type === "password";
      pwd.type = toText ? "text" : "password";
      togglePwd.classList.toggle("bi-eye", !toText);
      togglePwd.classList.toggle("bi-eye-slash", toText);
    });
  }
  if (toggleConfirm && confirm) {
    toggleConfirm.addEventListener("click", () => {
      const toText = confirm.type === "password";
      confirm.type = toText ? "text" : "password";
      toggleConfirm.classList.toggle("bi-eye", !toText);
      toggleConfirm.classList.toggle("bi-eye-slash", toText);
    });
  }

  // Validar que coincidan contraseñas en tiempo real
  function checkMatch() {
    const match = pwd.value === confirm.value;
    help.classList.toggle("d-none", match);
    return match;
  }
  pwd.addEventListener("input", checkMatch);
  confirm.addEventListener("input", checkMatch);

  // Submit (simulado)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!checkMatch()) return;

    const data = {
      nombre: form.nombre.value.trim(),
      apellidoP: form.apellidoP.value.trim(),
      apellidoM: form.apellidoM.value.trim(),
      email: form.email.value.trim(),
      fechaNac: form.fechaNac.value,
      telefono: form.telefono.value.trim(),
      password: form.password.value
    };

    // await register(data)
    console.log("Register submit:", data);
    alert("Registro simulado.");
    // location.hash = "/home";
  });
}
