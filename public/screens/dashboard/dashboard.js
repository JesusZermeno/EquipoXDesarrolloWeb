import { renderLayout } from "../../core/layout.js";

export async function render() {
  await renderLayout("./screens/dashboard/dashboard.html");
  setupTopbar();

  // Espejo: si hay idToken pero no authToken, créalo (para router y SSE)
  const idt = localStorage.getItem("idToken") || sessionStorage.getItem("idToken");
  const aut = localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
  if (!aut && idt) localStorage.setItem("authToken", idt);

  const deviceId = "mega01";     // <--- cambia si tu device tiene otro id
  loadDeviceSummary({ deviceId });   // 1) primera pintura
  startDeviceStream({ deviceId });   // 2) tiempo real
}

function setupTopbar() {
  const nameEl = document.getElementById("userName");
  try {
    const stored = localStorage.getItem("user") || sessionStorage.getItem("user");
    if (stored && nameEl) {
      const u = JSON.parse(stored);
      const fullName = [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim();
      nameEl.textContent = fullName || "Usuario";
    } else if (nameEl) nameEl.textContent = "Usuario";
  } catch { if (nameEl) nameEl.textContent = "Usuario"; }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("authToken");
      sessionStorage.removeItem("authToken");
      localStorage.removeItem("idToken");
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      location.replace("#/home");
    });
  }
}

/* -------------------- helpers -------------------- */
function getToken() {
  return localStorage.getItem("authToken") || sessionStorage.getItem("authToken") || "";
}
function fmtNumber(n, opts = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-MX", opts).format(n);
}
function fmtTs(ms) {
  if (!ms) return "—";
  try { return new Date(Number(ms)).toLocaleString("es-MX"); } catch { return "—"; }
}

/* -------------------- REST: primera carga -------------------- */
async function loadDeviceSummary({ deviceId }) {
  const API = `http://localhost:3000/devices/${encodeURIComponent(deviceId)}/state/last`;
  const token = getToken();

  const el = targets();
  [el.power, el.energy, el.avail, el.co2].forEach(e => e && (e.textContent = "…"));

  try {
    const r = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    paintKpis(data);
  } catch (err) {
    console.error("Error cargando KPIs:", err);
    paintNoData();
  }
}

/* -------------------- SSE: tiempo real -------------------- */
function startDeviceStream({ deviceId }) {
  const token = getToken();
  if (!token) return;

  const url = `http://localhost:3000/devices/${encodeURIComponent(deviceId)}/state/stream?token=${encodeURIComponent(token)}`;
  const es = new EventSource(url);

  es.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data); // { estado, nivel, valor, ts }
      paintKpis(data);
    } catch {}
  };

  es.addEventListener("error", () => {
    // El navegador reintenta; podrías cerrar/abrir con backoff si quieres
  });
}

/* -------------------- pintado -------------------- */
function targets() {
  return {
    power:   document.getElementById("kpiPowerValue"),
    powerTs: document.getElementById("kpiPowerTs"),
    energy:  document.getElementById("kpiEnergyValue"),
    energyTs:document.getElementById("kpiEnergyTs"),
    avail:   document.getElementById("kpiAvailValue"),
    availTs: document.getElementById("kpiAvailTs"),
    co2:     document.getElementById("kpiCO2Value"),
    co2Ts:   document.getElementById("kpiCO2Ts"),
  };
}
function paintKpis(data) {
  const el = targets();

  const potenciaW  = Number(data?.valor) || 0;
  const energiaHoy = Number(data?.nivel) || 0;

  const encendido =
    data?.estado === true ||
    String(data?.estado).toUpperCase() === "ENCENDIDO" ||
    String(data?.estado).toUpperCase() === "ON";

  const disponibilidad = encendido ? 100 : 0;
  const co2 = energiaHoy * 0.45; // kg CO₂ por kWh (estimación)

  if (el.power)   el.power.textContent   = `${fmtNumber(potenciaW)} W`;
  if (el.powerTs) el.powerTs.textContent = `Actualizado: ${fmtTs(data?.ts)}`;

  if (el.energy)  el.energy.textContent  = `${fmtNumber(energiaHoy, { maximumFractionDigits: 2 })} kWh`;
  if (el.energyTs)el.energyTs.textContent= `Actualizado: ${fmtTs(data?.ts)}`;

  if (el.avail)   el.avail.textContent   = `${fmtNumber(disponibilidad)} %`;
  if (el.availTs) el.availTs.textContent = `Estado: ${encendido ? "Encendido" : "Apagado"}`;

  if (el.co2)     el.co2.textContent     = `${fmtNumber(co2, { maximumFractionDigits: 2 })} kg`;
  if (el.co2Ts)   el.co2Ts.textContent   = `Basado en energía de hoy`;
}
function paintNoData() {
  const el = targets();
  [el.power, el.energy, el.avail, el.co2].forEach(e => e && (e.textContent = "—"));
  [el.powerTs, el.energyTs, el.availTs, el.co2Ts].forEach(e => e && (e.textContent = "Sin datos"));
}
