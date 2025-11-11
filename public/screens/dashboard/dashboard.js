import { renderLayout } from "../../core/layout.js";
// IndexedDB helpers
import {
  initDB,
  addState,
  addStatesBulk,
  getStatesByRange,
  getLastState,
  pruneBefore,            // limpieza opcional
} from "../../core/db.js";

export async function render() {
  await renderLayout("./screens/dashboard/dashboard.html");
  setupTopbar();

  // IndexedDB listo
  await initDB();

  // Limpia datos viejos (opcional: conserva ~48 h)
  try { await pruneBefore(hoursAgo(48)); } catch {}

  // Espejo de token para router/SSE
  const idt = localStorage.getItem("idToken") || sessionStorage.getItem("idToken");
  const aut = localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
  if (!aut && idt) localStorage.setItem("authToken", idt);

  const deviceId = "mega01"; // cambia si tu device usa otro id

  // 0) Warm-up: si hay red, precarga 24h/día a IDB para que
  //    al recargar offline tengas puntos suficientes
  await warmUpHistory(deviceId);

  // 1) KPIs: primera pintura con fallback a IDB
  await loadDeviceSummary({ deviceId });

  // 2) Gráficas: histórico (offline-first)
  await loadCharts(deviceId);

  // 3) Tiempo real: KPIs + gráficas + persistencia
  startRealtime(deviceId);
}

/* ===================== Topbar ===================== */
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

/* ===================== helpers ===================== */
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
function toTime(ms) {
  return new Date(ms).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}
function startOfToday() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}
function hoursAgo(n) {
  const d = new Date(); d.setHours(d.getHours() - n); return d;
}
function downsample(items, target = 300) {
  if (items.length <= target) return items;
  const step = Math.ceil(items.length / target);
  const out = [];
  for (let i = 0; i < items.length; i += step) out.push(items[i]);
  return out;
}

/* ===================== KPIs (REST con fallback IDB) ===================== */
async function loadDeviceSummary({ deviceId }) {
  const API = `http://localhost:3000/devices/${encodeURIComponent(deviceId)}/state/last`;
  const token = getToken();

  const el = targets();
  [el.power, el.energy, el.avail, el.co2].forEach(e => e && (e.textContent = "…"));

  try {
    const r = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    // Guarda también en IndexedDB
    await addState({
      deviceId,
      ts: data.ts,
      valor: data.valor,
      nivel: data.nivel,
      estado: data.estado
    });

    paintKpis(data);
  } catch (err) {
    // Fallback a último registro en IndexedDB
    const cached = await getLastState(deviceId);
    if (cached) {
      paintKpis(cached);
    } else {
      console.error("Error cargando KPIs:", err);
      paintNoData();
    }
  }
}

/* ===================== SSE: tiempo real (KPIs + charts) ===================== */
function startRealtime(deviceId) {
  const token = getToken();
  if (!token) return;

  if (!window.__suntec) window.__suntec = {};
  if (window.__suntec.sse) {
    try { window.__suntec.sse.close(); } catch {}
  }

  const url = `http://localhost:3000/devices/${encodeURIComponent(deviceId)}/state/stream?token=${encodeURIComponent(token)}`;
  const es = new EventSource(url);
  window.__suntec.sse = es;

  es.onmessage = async (evt) => {
    try {
      const d = JSON.parse(evt.data); // { estado, nivel, valor, ts }

      // 1) KPIs
      paintKpis(d);

      // 2) Persistir en IndexedDB
      await addState({
        deviceId,
        ts: d.ts,
        valor: d.valor,
        nivel: d.nivel,
        estado: d.estado
      });

      // 3) Empujar a charts si existen
      pushRealtimeToCharts(d);
    } catch {}
  };

  es.onerror = () => {
    // El navegador reintenta automáticamente
  };
}

/* ===================== Pintado de KPIs ===================== */
function targets() {
  return {
    power:  document.getElementById("kpiPowerValue"),
    powerTs:document.getElementById("kpiPowerTs"),
    energy: document.getElementById("kpiEnergyValue"),
    energyTs:document.getElementById("kpiEnergyTs"),
    avail:  document.getElementById("kpiAvailValue"),
    availTs:document.getElementById("kpiAvailTs"),
    co2:    document.getElementById("kpiCO2Value"),
    co2Ts:  document.getElementById("kpiCO2Ts"),
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
  const co2 = energiaHoy * 0.45; // kg CO₂ / kWh (estimación simple)

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

/* ===================== Charts (Histórico + Realtime) ===================== */
async function fetchStateRange({ deviceId, from, to, limit = 2000 }) {
  const token = getToken();
  const url = new URL(`http://localhost:3000/devices/${encodeURIComponent(deviceId)}/state`);
  if (from) url.searchParams.set("from", String(+from));
  if (to)   url.searchParams.set("to",   String(+to));
  url.searchParams.set("limit", String(limit));

  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.items || [];
}

// Dibuja chart o un placeholder si no hay puntos suficientes,
// y ajusta el estilo cuando hay pocas muestras.
function renderSeriesOrEmpty(canvasId, cfg, minPoints = 2) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const points = (cfg?.data?.datasets?.[0]?.data?.length) || 0;
  const wrap = canvas.parentElement;
  let msg = wrap?.querySelector('.chart-empty-msg');

  if (points < minPoints) {
    // Oculta lienzo y muestra mensaje
    canvas.style.display = 'none';
    if (!msg) {
      msg = document.createElement('div');
      msg.className = 'chart-empty-msg text-center text-muted py-5';
      msg.textContent = 'Sin datos suficientes (offline)';
      wrap?.appendChild(msg);
    }
    return null;
  } else {
    if (msg) msg.remove();
    canvas.style.display = 'block';
    const onlyDots = points < 5; // 2..4 puntos: solo puntos
    return ensureChartSmart(canvasId, cfg, { onlyDots });
  }
}

// Crea/actualiza el chart con comportamiento inteligente para pocas muestras
function ensureChartSmart(canvasId, { labels, datasetLabel, data }, { onlyDots = false } = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  if (!window.__charts) window.__charts = {};
  let chart = window.__charts[canvasId];

  const cfg = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: datasetLabel,
        data,
        tension: 0.25,
        fill: false,
        borderWidth: 2,
        showLine: !onlyDots,           // sin línea si pocas muestras
        pointRadius: onlyDots ? 4 : 0, // puntos visibles si pocas muestras
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: { x: { display: true }, y: { beginAtZero: true } },
      plugins: { legend: { display: false } }
    }
  };

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].showLine = cfg.data.datasets[0].showLine;
    chart.data.datasets[0].pointRadius = cfg.data.datasets[0].pointRadius;
    chart.update('none');
  } else {
    chart = new Chart(canvas, cfg);
    window.__charts[canvasId] = chart;
  }
  return chart;
}

export async function loadCharts(deviceId) {
  // Rango
  const from24 = hoursAgo(24);
  const now = new Date();
  const fromDay = startOfToday();

  // 1) Offline-first: pinta con IndexedDB
  let cached24 = await getStatesByRange(deviceId, +from24, +now, 5000);
  cached24 = cached24.sort((a, b) => a.ts - b.ts);
  const c24 = downsample(cached24, 400);
  renderSeriesOrEmpty('powerChart', {
    labels: c24.map(x => toTime(x.ts)),
    datasetLabel: 'Potencia (W)',
    data: c24.map(x => Number(x.valor) || 0)
  });

  let cachedDay = await getStatesByRange(deviceId, +fromDay, +now, 5000);
  cachedDay = cachedDay.sort((a, b) => a.ts - b.ts);
  const cDay = downsample(cachedDay, 400);
  renderSeriesOrEmpty('energyChart', {
    labels: cDay.map(x => toTime(x.ts)),
    datasetLabel: 'Energía (kWh)',
    data: cDay.map(x => Number(x.nivel) || 0)
  });

  // 2) Refresca con servidor (si hay red) y persiste
  try {
    const fresh24 = await fetchStateRange({ deviceId, from: from24, to: now, limit: 4000 });
    if (fresh24?.length) {
      await addStatesBulk(fresh24.map(x => ({ deviceId, ts: x.ts, valor: x.valor, nivel: x.nivel, estado: x.estado })));
      const ord = fresh24.sort((a, b) => a.ts - b.ts);
      const comp = downsample(ord, 400);
      renderSeriesOrEmpty('powerChart', {
        labels: comp.map(x => toTime(x.ts)),
        datasetLabel: 'Potencia (W)',
        data: comp.map(x => Number(x.valor) || 0)
      });
    }

    const freshDay = await fetchStateRange({ deviceId, from: fromDay, to: now, limit: 4000 });
    if (freshDay?.length) {
      await addStatesBulk(freshDay.map(x => ({ deviceId, ts: x.ts, valor: x.valor, nivel: x.nivel, estado: x.estado })));
      const ord = freshDay.sort((a, b) => a.ts - b.ts);
      const comp = downsample(ord, 400);
      renderSeriesOrEmpty('energyChart', {
        labels: comp.map(x => toTime(x.ts)),
        datasetLabel: 'Energía (kWh)',
        data: comp.map(x => Number(x.nivel) || 0)
      });
    }
  } catch {
    // sin red: ya pintamos con cache
  }
}

// Empuja último punto del SSE a las gráficas (suave)
function pushRealtimeToCharts(d) {
  if (!window.__charts) return;
  const t = toTime(d.ts);

  const pc = window.__charts['powerChart'];
  if (pc) {
    pc.data.labels.push(t);
    pc.data.datasets[0].data.push(Number(d.valor) || 0);
    if (pc.data.labels.length > 400) { pc.data.labels.shift(); pc.data.datasets[0].data.shift(); }
    pc.update('none');
  }

  const ec = window.__charts['energyChart'];
  if (ec) {
    ec.data.labels.push(t);
    ec.data.datasets[0].data.push(Number(d.nivel) || 0);
    if (ec.data.labels.length > 400) { ec.data.labels.shift(); ec.data.datasets[0].data.shift(); }
    ec.update('none');
  }
}

/* ===================== Warm-up de histórico ===================== */
async function warmUpHistory(deviceId) {
  try {
    const from24 = hoursAgo(24);
    const now = new Date();
    const fromDay = startOfToday();

    const [h24, day] = await Promise.all([
      fetchStateRange({ deviceId, from: from24, to: now, limit: 4000 }).catch(() => []),
      fetchStateRange({ deviceId, from: fromDay, to: now, limit: 4000 }).catch(() => []),
    ]);

    const all = [...(h24 || []), ...(day || [])];
    if (all.length) {
      await addStatesBulk(
        all.map(x => ({ deviceId, ts: x.ts, valor: x.valor, nivel: x.nivel, estado: x.estado }))
      );
    }
  } catch {
    // sin red o error: simplemente no se precarga
  }
}
