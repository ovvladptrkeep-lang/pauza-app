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
  const timerWrap = document.getElementById("timer-wrap");
  timerWrap.classList.remove("hidden");

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

/* ---------- Дыхательный таймер 4-4-4-4 ---------- */
const BREATH_PHASES = [
  { name: "Вдох",  dur: 4, from: 0.0, to: 1.0, buzzStart: 15, buzzEnd: 80 },
  { name: "Держи", dur: 4, from: 1.0, to: 1.0, buzzStart: 80, buzzEnd: 80 },
  { name: "Выдох", dur: 4, from: 1.0, to: 0.0, buzzStart: 80, buzzEnd: 15 },
  { name: "Держи", dur: 4, from: 0.0, to: 0.0, buzzStart: 15, buzzEnd: 15 }
];

let breathPhaseIdx = 0;
let breathPhaseStart = 0;
let breathCycles = 0;
let breathRunning = false;
let breathRafId = null;
let breathLastBuzz = 0;

const BREATH_RING_MIN = 60;
const BREATH_RING_MAX = 80;

const RING_PULSE_EL   = document.querySelector(".ring-pulse");
const BREATH_PHASE_EL = document.getElementById("breath-phase");
const BREATH_COUNT_EL = document.getElementById("breath-count");
const BREATH_CYCLE_EL = document.getElementById("breath-cycle");
const BTN_TOGGLE_EL   = document.getElementById("timer-toggle");

function vibrateBreath(ms) {
  if (navigator.vibrate) {
    try { navigator.vibrate(ms); } catch (e) {}
  }
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function setRingRadius(scale) {
  const r = BREATH_RING_MIN + (BREATH_RING_MAX - BREATH_RING_MIN) * scale;
  if (RING_PULSE_EL) RING_PULSE_EL.setAttribute("r", r.toFixed(1));
}

function updateBreathUI(phase, remainingInPhase, cycleNum) {
  if (BREATH_PHASE_EL) BREATH_PHASE_EL.textContent = phase.name;
  if (BREATH_COUNT_EL) BREATH_COUNT_EL.textContent = Math.max(1, Math.ceil(remainingInPhase));
  if (BREATH_CYCLE_EL) BREATH_CYCLE_EL.textContent = "цикл " + cycleNum;
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
  setRingRadius(scale);

  const buzzNow = phase.buzzStart + (phase.buzzEnd - phase.buzzStart) * t;
  const interval = Math.max(80, 300 - buzzNow * 2.5);
  if (now - breathLastBuzz > interval) {
    vibrateBreath(Math.round(buzzNow));
    breathLastBuzz = now;
  }

  updateBreathUI(phase, phase.dur - elapsed, breathCycles);

  if (elapsed >= phase.dur) {
    breathPhaseIdx = (breathPhaseIdx + 1) % BREATH_PHASES.length;
    if (breathPhaseIdx === 0) {
      breathCycles += 1;
      vibrateBreath(50);
      setTimeout(() => vibrateBreath(30), 80);
    }
    breathPhaseStart = now;
  }

  breathRafId = requestAnimationFrame(breathTick);
}

function startBreath() {
  if (breathRunning) return;
  breathRunning = true;
  breathPhaseStart = performance.now();
  breathLastBuzz = 0;
  breathRafId = requestAnimationFrame(breathTick);
  if (BTN_TOGGLE_EL) BTN_TOGGLE_EL.textContent = "⏸ Пауза";
}

function stopBreath() {
  breathRunning = false;
  if (breathRafId) cancelAnimationFrame(breathRafId);
  breathRafId = null;
  if (BTN_TOGGLE_EL) BTN_TOGGLE_EL.textContent = "▶ Продолжить";
}

function resetBreath() {
  stopBreath();
  breathPhaseIdx = 0;
  breathCycles = 0;
  setRingRadius(0);
  if (BREATH_PHASE_EL) BREATH_PHASE_EL.textContent = "Готовы?";
  if (BREATH_COUNT_EL) BREATH_COUNT_EL.textContent = "4";
  if (BREATH_CYCLE_EL) BREATH_CYCLE_EL.textContent = "цикл 0";
  if (BTN_TOGGLE_EL) BTN_TOGGLE_EL.textContent = "▶ Начать дыхание";
}

// Совместимость со старым API
function resetTimerUI() { resetBreath(); }
function updateTimerDisplay() {}

if (BTN_TOGGLE_EL) {
  BTN_TOGGLE_EL.addEventListener("click", () => {
    if (breathRunning) stopBreath();
    else startBreath();
  });
}
const BTN_RESET_EL = document.getElementById("timer-reset");
if (BTN_RESET_EL) {
  BTN_RESET_EL.addEventListener("click", resetBreath);
}


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
