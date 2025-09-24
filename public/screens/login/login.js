import { renderHTML } from "../../utils/dom.js";

// import { login } from "../../core/auth.js";

export async function render(root) {
  const html = await renderHTML("./screens/login/login.html");
  root.innerHTML = html;

  const form = root.querySelector("#formLogin");
  const passwordInput = root.querySelector("#passwordInput");
  const togglePassword = root.querySelector("#togglePassword");

  // Submit (login simulado)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const pass  = form.password.value.trim();

    // await login(email, pass);
    console.log("Login submit:", { email, pass });
    alert("Login simulado.");
    // location.hash = "/home";
  });

  // Mostrar / ocultar contraseña (cambia icono)
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      const toText = passwordInput.type === "password";
      passwordInput.type = toText ? "text" : "password";

      // Cambia solo la parte del icono, manteniendo las clases de posición
      togglePassword.classList.toggle("bi-eye", !toText);
      togglePassword.classList.toggle("bi-eye-slash", toText);
    });
  }
}
