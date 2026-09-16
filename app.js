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
let timerInterval = null;
let timerRemaining = 0;
let timerTotal = 0;
let timerRunning = false;

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

  resetTimerUI();
  const timerWrap = document.getElementById("timer-wrap");
  if (day.timer) {
    timerWrap.classList.remove("hidden");
    timerTotal = day.timer;
    timerRemaining = day.timer;
    updateTimerDisplay();
  } else {
    timerWrap.classList.add("hidden");
  }

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

/* ---------- Таймер практики ---------- */
function updateTimerDisplay() {
  const m = Math.floor(timerRemaining / 60);
  const s = timerRemaining % 60;
  document.getElementById("timer-display").textContent =
    String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}
function resetTimerUI() {
  clearInterval(timerInterval);
  timerRunning = false;
  document.getElementById("timer-toggle").textContent = "▶ Старт";
}
document.getElementById("timer-toggle").addEventListener("click", () => {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById("timer-toggle").textContent = "▶ Продолжить";
  } else {
    if (timerRemaining <= 0) { timerRemaining = timerTotal; }
    timerRunning = true;
    document.getElementById("timer-toggle").textContent = "⏸ Пауза";
    timerInterval = setInterval(() => {
      timerRemaining -= 1;
      updateTimerDisplay();
      if (timerRemaining <= 0) {
        clearInterval(timerInterval);
        timerRunning = false;
        document.getElementById("timer-toggle").textContent = "✓ Готово";
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    }, 1000);
  }
});
document.getElementById("timer-reset").addEventListener("click", () => {
  clearInterval(timerInterval);
  timerRunning = false;
  timerRemaining = timerTotal;
  updateTimerDisplay();
  document.getElementById("timer-toggle").textContent = "▶ Старт";
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
