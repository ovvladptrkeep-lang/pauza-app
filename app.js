/* ============================================================
   ПАУЗА — логика приложения.
   ============================================================ */

const STORAGE_KEY = "pause_app_state_v1";
const TOTAL_DAYS = DAYS.length;

let STORAGE_AVAILABLE = true;
try {
  const testKey = "__pauza_test__";
  localStorage.setItem(testKey, "1");
  localStorage.removeItem(testKey);
} catch (e) { STORAGE_AVAILABLE = false; }

function loadState() {
  if (!STORAGE_AVAILABLE) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function defaultState() {
  return {
    name: "",
    started: false,
    currentDay: 1,
    entries: {},
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
  div.textContent = "⚠ Записи не сохраняются в этом браузере. Откройте в обычном Chrome.";
  document.body.appendChild(div);
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

function daysBetween(a, b) {
  const d1 = new Date(a), d2 = new Date(b);
  return Math.round((d2 - d1) / 86400000);
}

/* ---------- Навигация ---------- */
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
  const target = document.getElementById("screen-" + name);
  if (target) target.classList.remove("hidden");
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
const ONB_START = document.getElementById("onb-start");
if (ONB_START) {
  ONB_START.addEventListener("click", () => {
    const nameInput = document.getElementById("onb-name");
    state.name = nameInput ? nameInput.value.trim() : "";
    state.started = true;
    saveState();
    renderHome();
    showScreen("home");
  });
}

/* ---------- Главный экран ---------- */
function getCompletedCount() {
  return DAYS.filter(d => (state.entries[d.day] && state.entries[d.day].text.trim())).length;
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return h;
}

function pickQuote() {
  const idx = Math.floor(Math.abs(hashCode(todayStr())) % QUOTES.length);
  return QUOTES[idx];
}

function renderHome() {
  const q = pickQuote();
  const qt = document.getElementById("quote-text");
  const qa = document.getElementById("quote-author");
  if (qt) qt.textContent = "«" + q.text + "»";
  if (qa) qa.textContent = "— " + q.author;

  const ss = document.getElementById("stat-streak");
  const sd = document.getElementById("stat-done");
  const sp = document.getElementById("stat-points");
  if (ss) ss.textContent = state.streak;
  if (sd) sd.textContent = getCompletedCount() + "/" + TOTAL_DAYS;
  if (sp) sp.textContent = state.points;

  const day = DAYS.find(d => d.day === state.currentDay) || DAYS[0];
  const tn = document.getElementById("today-num");
  const tt = document.getElementById("today-title");
  if (tn) tn.textContent = "День " + day.day;
  if (tt) tt.textContent = day.title;
}

const BTN_TODAY = document.getElementById("btn-open-today");
if (BTN_TODAY) {
  BTN_TODAY.addEventListener("click", () => openDay(state.currentDay));
}

/* ---------- Экран дня ---------- */
let activeDayNum = 1;

function openDay(num) {
  activeDayNum = num;
  const day = DAYS.find(d => d.day === num);
  if (!day) return;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("day-brand", "День " + day.day);
  set("day-week", "Неделя " + day.week);
  set("day-title", day.title);
  set("day-subtitle", day.subtitle);
  set("day-morning", day.morning);
  set("day-practice", day.practice);
  set("day-science", day.science);
  set("day-dharma", day.dharma);
  set("day-reflection-q", day.reflection);

  const entry = state.entries[day.day];
  const note = document.getElementById("day-note");
  if (note) note.value = entry ? entry.text : "";
  const toast = document.getElementById("save-toast");
  if (toast) toast.classList.add("hidden");

  resetBreath();

  const prev = document.getElementById("day-prev");
  const next = document.getElementById("day-next");
  if (prev) prev.disabled = day.day <= 1;
  if (next) next.disabled = day.day >= TOTAL_DAYS;
  const scroll = document.getElementById("day-scroll");
  if (scroll) scroll.scrollTop = 0;

  showScreen("day");
}

const BTN_PREV = document.getElementById("day-prev");
const BTN_NEXT = document.getElementById("day-next");
if (BTN_PREV) BTN_PREV.addEventListener("click", () => { if (activeDayNum > 1) openDay(activeDayNum - 1); });
if (BTN_NEXT) BTN_NEXT.addEventListener("click", () => { if (activeDayNum < TOTAL_DAYS) openDay(activeDayNum + 1); });

const BTN_SAVE = document.getElementById("day-save");
if (BTN_SAVE) {
  BTN_SAVE.addEventListener("click", () => {
    const note = document.getElementById("day-note");
    const text = note ? note.value : "";
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
    renderHome();
    renderCalendar();

    const t = document.getElementById("save-toast");
    if (t) {
      t.classList.remove("hidden");
      setTimeout(() => t.classList.add("hidden"), 1600);
    }
  });
}

function updateStreak() {
  const today = todayStr();
  if (state.lastActiveDate === today) {
    return;
  } else if (state.lastActiveDate && daysBetween(state.lastActiveDate, today) === 1) {
    state.streak += 1;
    state.lastActiveDate = today;
  } else {
    state.streak = 1;
    state.lastActiveDate = today;
  }
}

/* ============================================================
   Дыхание кругами на воде 4-4-4-4 (без вибрации)
   ============================================================ */
const BREATH_DUR = 4;
const OVERLAY_FADE_MS = 300;
const PHASE_IN = 0, PHASE_HOLD1 = 1, PHASE_OUT = 2, PHASE_HOLD2 = 3;

let breathPhase = PHASE_IN;
let breathPhaseStart = 0;
let breathRunning = false;
let breathRafId = null;

const OVERLAY_EL = document.getElementById("breath-overlay");
const RIPPLE_EL = document.getElementById("breath-ripple");

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

if (OVERLAY_EL) {
  OVERLAY_EL.addEventListener("click", () => stopBreath());
}

const BTN_START = document.getElementById("breath-start-btn");
if (BTN_START) {
  BTN_START.addEventListener("click", (e) => {
    e.stopPropagation();
    startBreath();
  });
}

/* ---------- Календарь ---------- */
function renderCalendar() {
  const completed = getCompletedCount();
  const bar = document.getElementById("progress-bar-inner");
  if (bar) bar.style.width = Math.round((completed / TOTAL_DAYS) * 100) + "%";
  const grid = document.getElementById("cal-grid");
  if (!grid) return;
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
  if (!list) return;
  list.innerHTML = "";
  TERMS.forEach(t => {
    const item = document.createElement("div");
    item.className = "gloss-item";
    item.innerHTML = '<p class="gloss-term">' + t.term + '</p>' +
                     '<p class="gloss-def">' + t.def + '</p>';
    list.appendChild(item);
  });
}

/* ---------- Экспорт ---------- */
const BTN_EXPORT = document.getElementById("export-btn");
if (BTN_EXPORT) {
  BTN_EXPORT.addEventListener("click", () => {
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
}

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

try {
  init();
} catch (e) {
  console.error("Ошибка инициализации:", e);
}

/* ---------- Service worker ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}