/* ============================================================
   ПАУЗА — логика приложения.
   Хранение: localStorage (весь дневник живёт только на телефоне
   пользователя, без сервера и без сети).
   ============================================================ */

const STORAGE_KEY = "pause_app_state_v1";
const TOTAL_DAYS = DAYS.length;

// Некоторые встроенные браузеры мессенджеров (Telegram/WhatsApp in-app)
// и приватный режим иногда блокируют localStorage целиком — обращение
// к нему может бросить исключение уже на чтении, не только на записи.
// Ниже всё завёрнуто так, чтобы приложение не падало намертво, а просто
// работало без сохранения (с предупреждением пользователю).
let STORAGE_AVAILABLE = true;
function checkStorage() {
  try {
    const testKey = "__pauza_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}
STORAGE_AVAILABLE = checkStorage();

function loadState() {
  if (!STORAGE_AVAILABLE) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* повреждённые данные — начинаем заново */ }
  return null;
}

function defaultState() {
  return {
    name: "",
    started: false,
    currentDay: 1,
    entries: {},        // { "1": { text, savedAt: "YYYY-MM-DD" } }
    points: 0,
    lastActiveDate: null,
    streak: 0
  };
}

let state = loadState() || defaultState();

function saveState() {
  if (!STORAGE_AVAILABLE) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Мягкое обновление прогресс-бара, если календарь уже отрисован
    const bar = document.getElementById("progress-bar-inner");
    if (bar) {
      const completed = getCompletedCount();
      bar.style.width = Math.round((completed / TOTAL_DAYS) * 100) + "%";
    }
  } catch (e) {
    STORAGE_AVAILABLE = false;
    showStorageWarning();
  }
}

function showStorageWarning() {
  if (document.getElementById("storage-warning")) return;
  const div = document.createElement("div");
  div.id = "storage-warning";
  div.style.cssText = "position:fixed;bottom:0;left:0;right:0;background:#FF6B6B;color:#1A202C;" +
    "padding:12px 16px;font-size:13px;text-align:center;z-index:9999;font-weight:600;";
  div.textContent = "⚠ Записи не сохраняются в этом браузере. Откройте ссылку в обычном Chrome (не во встроенном браузере мессенджера).";
  document.body.appendChild(div);
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function daysBetween(a, b) {
  const d1 = new Date(a), d2 = new Date(b);
  return Math.round((d2 - d1) / 86400000);
}

/* ---------- Навигация между экранами ---------- */
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
  document.getElementById("screen-" + name).classList.remove("hidden");
  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("active", t.dataset.goto === name);
  });
  window.scrollTo(0, 0);
}

document.querySelectorAll("[data-goto]").forEach(el => {
  el.addEventListener("click", () => {
    const target = el.dataset.goto;
    if (target === "calendar") renderCalendar();
    if (target === "glossary") renderGlossary();
    if (target === "home") renderHome();
    showScreen(target);
  });
});

/* ---------- Онбординг ---------- */
document.getElementById("onb-start").addEventListener("click", () => {
  const name = document.getElementById("onb-name").value.trim();
  state.name = name;
  state.started = true;
  saveState();
  renderHome();
  showScreen("home");
});

/* ---------- Главный экран ---------- */
function getCompletedCount() {
  return DAYS.filter(d => (state.entries[d.day] && state.entries[d.day].text.trim())).length;
}

function pickQuote() {
  const idx = Math.floor(Math.abs(hashCode(todayStr())) % QUOTES.length);
  return QUOTES[idx];
}
function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return h;
}

function renderHome() {
  const q = pickQuote();
  document.getElementById("quote-text").textContent = "«" + q.text + "»";
  document.getElementById("quote-author").textContent = "— " + q.author;

  document.getElementById("stat-streak").textContent = state.streak;
  document.getElementById("stat-done").textContent = getCompletedCount() + "/" + TOTAL_DAYS;
  document.getElementById("stat-points").textContent = state.points;

  const day = DAYS.find(d => d.day === state.currentDay) || DAYS[0];
  document.getElementById("today-num").textContent = "День " + day.day;
  document.getElementById("today-title").textContent = day.title;
}

document.getElementById("btn-open-today").addEventListener("click", () => openDay(state.currentDay));

/* ---------- Экран дня ---------- */
let activeDayNum = 1;

function openDay(num) {
  activeDayNum = num;
  const day = DAYS.find(d => d.day === num);
  if (!day) return;

  document.getElementById("day-brand").textContent = "День " + day.day;
  document.getElementById("day-week").textContent = "Неделя " + day.week;
  document.getElementById("day-title").textContent = day.title;
  document.getElementById("day-subtitle").textContent = day.subtitle;
  document.getElementById("day-morning").textContent = day.morning;
  document.getElementById("day-practice").textContent = day.practice;
  document.getElementById("day-science").textContent = day.science;
  document.getElementById("day-dharma").textContent = day.dharma;
  document.getElementById("day-reflection-q").textContent = day.reflection;

  const entry = state.entries[day.day];
  document.getElementById("day-note").value = entry ? entry.text : "";
  document.getElementById("save-toast").classList.add("hidden");

  resetBreath();

  document.getElementById("day-prev").disabled = day.day <= 1;
  document.getElementById("day-next").disabled = day.day >= TOTAL_DAYS;
  document.getElementById("day-scroll").scrollTop = 0;

  showScreen("day");
}

document.getElementById("day-prev").addEventListener("click", () => { if (activeDayNum > 1) openDay(activeDayNum - 1); });
document.getElementById("day-next").addEventListener("click", () => { if (activeDayNum < TOTAL_DAYS) openDay(activeDayNum + 1); });

document.getElementById("day-save").addEventListener("click", () => {
  const text = document.getElementById("day-note").value;
  const hadEntryBefore = !!(state.entries[activeDayNum] && state.entries[activeDayNum].text.trim());
  state.entries[activeDayNum] = { text, savedAt: todayStr() };

  if (!hadEntryBefore && text.trim()) {
    state.points += 2;
    updateStreak();
    if (activeDayNum === state.currentDay && state.currentDay < TOTAL_DAYS) {
      state.currentDay += 1;
    }
  }
  saveState();

  // Обновляем главную и календарь, чтобы счётчики и прогресс были актуальны
  renderHome();
  renderCalendar();

  const toast = document.getElementById("save-toast");
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 1600);
});

function updateStreak() {
  const today = todayStr();
  if (state.lastActiveDate === today) {
    // уже засчитан сегодняшний день
  } else if (state.lastActiveDate && daysBetween(state.lastActiveDate, today) === 1) {
    state.streak += 1;
    state.lastActiveDate = today;
  } else {
    state.streak = 1;
    state.lastActiveDate = today;
  }
}

/* ---------- Дыхательный круг 4-4-4-4 ---------- */
const BREATH_PHASES = [
  { name: "in",    dur: 4, from: 0.0, to: 1.0, buzzStart: 15, buzzEnd: 90 },
  { name: "hold1", dur: 4, from: 1.0, to: 1.0, buzzStart: 90, buzzEnd: 90 },
  { name: "out",   dur: 4, from: 1.0, to: 0.0, buzzStart: 90, buzzEnd: 15 },
  { name: "hold2", dur: 4, from: 0.0, to: 0.0, buzzStart: 15, buzzEnd: 15 }
];

const BREATH_MIN_SCALE = 1.0;   // базовый размер
const BREATH_MAX_SCALE = 2.6;   // максимум — растёт заметно

let breathPhaseIdx = 0;
let breathPhaseStart = 0;
let breathRunning = false;
let breathRafId = null;
let breathLastBuzz = 0;

const BREATH_CIRCLE_EL = document.getElementById("breath-circle");

function vibrateBreath(ms) {
  if (navigator.vibrate) {
    try { navigator.vibrate(ms); } catch (e) {}
  }
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function setCircleScale(scale) {
  if (!BREATH_CIRCLE_EL) return;
  const size = BREATH_MIN_SCALE + (BREATH_MAX_SCALE - BREATH_MIN_SCALE) * scale;
  BREATH_CIRCLE_EL.style.transform = "scale(" + size.toFixed(3) + ")";
}

function breathTick(now) {
  if (!breathRunning) return;

  const phase = BREATH_PHASES[breathPhaseIdx];
  const elapsed = (now - breathPhaseStart) / 1000;
  const t = Math.min(elapsed / phase.dur, 1);

  let scale;
  if (phase.from === phase.to) {
    scale = phase.from;
  } else {
    const eased = easeInOut(t);
    scale = phase.from + (phase.to - phase.from) * eased;
  }
  setCircleScale(scale);

  const buzzNow = phase.buzzStart + (phase.buzzEnd - phase.buzzStart) * t;
  const interval = Math.max(80, 320 - buzzNow * 2.6);
  if (now - breathLastBuzz > interval) {
    vibrateBreath(Math.round(buzzNow));
    breathLastBuzz = now;
  }

  if (elapsed >= phase.dur) {
    breathPhaseIdx = (breathPhaseIdx + 1) % BREATH_PHASES.length;
    if (breathPhaseIdx === 0) {
      vibrateBreath(60);
      setTimeout(() => vibrateBreath(35), 90);
    }
    breathPhaseStart = now;
  }

  breathRafId = requestAnimationFrame(breathTick);
}

function startBreath() {
  if (breathRunning) return;
  breathRunning = true;
  breathPhaseIdx = 0;
  breathPhaseStart = performance.now();
  breathLastBuzz = 0;
  if (BREATH_CIRCLE_EL) {
    BREATH_CIRCLE_EL.classList.remove("idle");
    BREATH_CIRCLE_EL.classList.add("active");
  }
  breathRafId = requestAnimationFrame(breathTick);
}

function stopBreath() {
  breathRunning = false;
  if (breathRafId) cancelAnimationFrame(breathRafId);
  breathRafId = null;
  setCircleScale(0);
  if (BREATH_CIRCLE_EL) {
    BREATH_CIRCLE_EL.classList.remove("active");
    BREATH_CIRCLE_EL.classList.add("idle");
  }
}

function resetBreath() { stopBreath(); }
function resetTimerUI() { resetBreath(); }
function updateTimerDisplay() {}

if (BREATH_CIRCLE_EL) {
  BREATH_CIRCLE_EL.addEventListener("click", () => {
    if (breathRunning) stopBreath();
    else startBreath();
  });
}


/* ---------- Дыхание кругами на воде 4-4-4-4 (без вибрации) ---------- */
const BREATH_DUR = 4;
const OVERLAY_FADE_MS = 300;
const PHASE_IN = 0, PHASE_HOLD1 = 1, PHASE_OUT = 2, PHASE_HOLD2 = 3;

let breathPhase = PHASE_IN;
let breathPhaseStart = 0;
let breathRunning = false;
let breathRafId = null;

const OVERLAY_EL = document.getElementById("breath-overlay");
const RIPPLE_EL  = document.getElementById("breath-ripple");

// Подсказка + центральная точка (создаются один раз)
if (OVERLAY_EL && !document.getElementById("breath-hint")) {
  const hint = document.createElement("div");
  hint.id = "breath-hint";
  hint.className = "breath-hint";
  hint.textContent = "нажмите, чтобы закрыть";
  OVERLAY_EL.appendChild(hint);

  const core = document.createElement("div");
  core.className = "breath-core";
  OVERLAY_EL.appendChild(core);
}

// Единственный тактильный сигнал — короткий «тик»
function tickFeedback() {
  if (navigator.vibrate) {
    try { navigator.vibrate(20); } catch (e) {}
  }
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function maxRippleScale() {
  const w = window.innerWidth, h = window.innerHeight;
  const diag = Math.sqrt(w * w + h * h);
  return (diag * 1.05) / 200;
}

function setRipple(t, isInhale) {
  if (!RIPPLE_EL) return;
  const maxScale = maxRippleScale();
  const minScale = 0.1;
  let scale, opacity, borderW;
  if (isInhale) {
    scale = minScale + (maxScale - minScale) * t;
    opacity = 1 - 0.95 * t;
    borderW = 6 - 4 * t;
  } else {
    scale = maxScale - (maxScale - minScale) * t;
    opacity = 0.05 + 0.95 * t;
    borderW = 2 + 4 * t;
  }
  RIPPLE_EL.style.transform = "translate(-50%,-50%) scale(" + scale.toFixed(3) + ")";
  RIPPLE_EL.style.opacity = opacity.toFixed(3);
  RIPPLE_EL.style.borderWidth = borderW.toFixed(2) + "px";
}

function startPhase(now) {
  breathPhaseStart = now;
  if ((breathPhase === PHASE_HOLD1 || breathPhase === PHASE_HOLD2) && RIPPLE_EL) {
    RIPPLE_EL.style.opacity = "0";
  }
}

function breathTick(now) {
  if (!breathRunning) return;
  const elapsed = (now - breathPhaseStart) / 1000;
  const t = Math.min(elapsed / BREATH_DUR, 1);

  if (breathPhase === PHASE_IN)       setRipple(easeInOut(t), true);
  else if (breathPhase === PHASE_OUT) setRipple(easeInOut(t), false);

  if (elapsed >= BREATH_DUR) {
    breathPhase = (breathPhase + 1) % 4;
    startPhase(now);
  }
  breathRafId = requestAnimationFrame(breathTick);
}

function startBreath() {
  if (breathRunning) return;
  breathRunning = true;
  breathPhase = PHASE_IN;

  if (OVERLAY_EL) {
    OVERLAY_EL.classList.remove("hidden");
    OVERLAY_EL.style.opacity = "0";
    requestAnimationFrame(() => {
      OVERLAY_EL.style.transition = "opacity " + OVERLAY_FADE_MS + "ms ease";
      OVERLAY_EL.style.opacity = "1";
    });
  }

  tickFeedback();
  startPhase(performance.now());
  breathRafId = requestAnimationFrame(breathTick);
}

function stopBreath() {
  breathRunning = false;
  if (breathRafId) cancelAnimationFrame(breathRafId);
  breathRafId = null;

  tickFeedback();

  if (OVERLAY_EL) {
    OVERLAY_EL.style.transition = "opacity " + OVERLAY_FADE_MS + "ms ease";
    OVERLAY_EL.style.opacity = "0";
    setTimeout(() => {
      if (!breathRunning) OVERLAY_EL.classList.add("hidden");
    }, OVERLAY_FADE_MS);
  }
}

function resetBreath() { stopBreath(); }
function resetTimerUI() { resetBreath(); }
function updateTimerDisplay() {}

if (OVERLAY_EL) OVERLAY_EL.addEventListener("click", () => stopBreath());

const BTN_START = document.getElementById("breath-start-btn");
if (BTN_START) BTN_START.addEventListener("click", (e) => {
  e.stopPropagation();
  startBreath();
});


/* ---------- Календарь ---------- */
function renderCalendar() {
  const completed = getCompletedCount();
  document.getElementById("progress-bar-inner").style.width = Math.round((completed / TOTAL_DAYS) * 100) + "%";
  const grid = document.getElementById("cal-grid");
  grid.innerHTML = "";
  DAYS.forEach(d => {
    const btn = document.createElement("button");
    btn.className = "cal-cell";
    const done = state.entries[d.day] && state.entries[d.day].text.trim();
    if (done) btn.classList.add("done");
    if (d.day === state.currentDay) btn.classList.add("today");
    btn.textContent = d.day;
    btn.addEventListener("click", () => openDay(d.day));
    grid.appendChild(btn);
  });
}

/* ---------- Словарь ---------- */
function renderGlossary() {
  const list = document.getElementById("gloss-list");
  list.innerHTML = "";
  TERMS.forEach(t => {
    const item = document.createElement("div");
    item.className = "gloss-item";
    item.innerHTML = `<p class="gloss-term">${t.term}</p><p class="gloss-def">${t.def}</p>`;
    list.appendChild(item);
  });
}

/* ---------- Экспорт ---------- */
document.getElementById("export-btn").addEventListener("click", () => {
  let out = "=".repeat(50) + "\n";
  out += "ДНЕВНИК ПРАКТИКИ «ПАУЗА» — 21 день внимания к реакциям\n";
  if (state.name) out += "Автор: " + state.name + "\n";
  out += "Баллов практики: " + state.points + "\n";
  out += "Экспортировано: " + new Date().toLocaleDateString("ru-RU") + "\n";
  out += "=".repeat(50) + "\n\n";
  DAYS.forEach(d => {
    const e = state.entries[d.day];
    if (e && e.text.trim()) {
      out += "-".repeat(30) + "\n";
      out += "ДЕНЬ " + d.day + ": " + d.title + " (" + (e.savedAt || "") + ")\n";
      out += "-".repeat(30) + "\n";
      out += e.text.trim() + "\n\n";
    }
  });
  const blob = new Blob([out], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pauza_dnevnik_" + todayStr() + ".txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

/* ---------- Запуск ---------- */
function init() {
  if (!STORAGE_AVAILABLE) showStorageWarning();
  if (state.started) {
    renderHome();
    showScreen("home");
  } else {
    showScreen("onboarding");
  }
}

window.addEventListener("error", (e) => {
  const app = document.getElementById("app");
  if (app && !document.getElementById("fatal-error")) {
    const div = document.createElement("div");
    div.id = "fatal-error";
    div.style.cssText = "position:fixed;inset:0;background:#1A202C;color:#E2E8F0;" +
      "display:flex;align-items:center;justify-content:center;padding:30px;text-align:center;" +
      "font-size:15px;line-height:1.5;z-index:99999;";
    div.textContent = "Что-то пошло не так при запуске. Попробуйте открыть это же приложение в Chrome (не во встроенном браузере мессенджера) и обновить страницу.";
    document.body.appendChild(div);
  }
});

try {
  init();
} catch (e) {
  window.dispatchEvent(new ErrorEvent("error", { error: e }));
}

/* ---------- Service worker (офлайн-режим) ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
