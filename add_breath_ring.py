# -*- coding: utf-8 -*-
"""
Автоматически заменяет старый таймер на кольцо-дыхание 4-4-4-4.
Правит: index.html, style.css, app.js, sw.js.
Файлы сохраняются в UTF-8 через временный файл (безопасно для Windows).
"""
import os
import re
import tempfile
import shutil


def safe_write(path, content):
    """Пишет через временный файл, потом атомарно заменяет."""
    dir_name = os.path.dirname(os.path.abspath(path)) or "."
    tmp_fd, tmp_path = tempfile.mkstemp(dir=dir_name, suffix=".tmp")
    try:
        with os.fdopen(tmp_fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
        if os.path.exists(path):
            os.replace(tmp_path, path)
        else:
            shutil.move(tmp_path, path)
    except OSError:
        fallback = path + ".new"
        shutil.move(tmp_path, fallback)
        print(f"  ⚠ {path} занят. Записал как {fallback}")
        return False
    return True


# ============================================================
# 1. index.html — заменить блок таймера
# ============================================================
NEW_TIMER_HTML = '''      <div id="timer-wrap" class="timer-wrap hidden">
        <div class="breath-ring">
          <svg viewBox="0 0 200 200" class="breath-svg">
            <circle cx="100" cy="100" r="80" class="ring-bg"/>
            <circle cx="100" cy="100" r="60" class="ring-pulse"/>
          </svg>
          <div class="breath-inner">
            <div class="breath-phase" id="breath-phase">Готовы?</div>
            <div class="breath-count" id="breath-count">4</div>
            <div class="breath-cycle" id="breath-cycle">цикл 0</div>
          </div>
        </div>
        <div class="timer-btns">
          <button id="timer-toggle" class="btn btn-small btn-primary">▶ Начать дыхание</button>
          <button id="timer-reset" class="btn btn-small">↺</button>
        </div>
      </div>'''


def update_index():
    path = "index.html"
    if not os.path.exists(path):
        print(f"⚠ {path} не найден")
        return
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    # Ищем блок <div id="timer-wrap" ...>...</div> и заменяем
    pattern = re.compile(
        r'<div id="timer-wrap".*?</div>\s*</div>',
        re.DOTALL
    )
    m = pattern.search(html)
    if not m:
        print(f"⚠ {path}: блок timer-wrap не найден — возможно, уже заменён")
        return

    # Находим конец именно timer-wrap (первый закрывающий </div>)
    # Проще: заменим по старому шаблону
    old = '''<div id="timer-wrap" class="timer-wrap hidden">
          <div class="timer-display" id="timer-display">00:00</div>
          <div class="timer-btns">
            <button id="timer-toggle" class="btn btn-small btn-primary">▶ Старт</button>
            <button id="timer-reset" class="btn btn-small">↺</button>
          </div>
        </div>'''
    if old in html:
        html = html.replace(old, NEW_TIMER_HTML)
    else:
        # Пробуем найти с другим отступом
        old2 = re.compile(
            r'<div id="timer-wrap"[^>]*>.*?<button id="timer-reset"[^>]*>↺</button>\s*</div>\s*</div>',
            re.DOTALL
        )
        html = old2.sub(NEW_TIMER_HTML, html, count=1)

    safe_write(path, html)
    print(f"✓ {path} обновлён")


# ============================================================
# 2. style.css — заменить блок /* ---- Timer ---- */
# ============================================================
NEW_TIMER_CSS = '''/* ---- Breath ring (timer) ---- */
.timer-wrap{
  margin-top:14px;
  text-align:center;
  background:var(--bg-dark);
  border-radius:14px;
  padding:18px 14px 14px;
}

.breath-ring{
  position:relative;
  width:200px;
  height:200px;
  margin:0 auto 14px;
}

.breath-svg{
  width:100%;
  height:100%;
  overflow:visible;
}

.ring-bg{
  fill:none;
  stroke:rgba(64,224,208,0.18);
  stroke-width:8;
}

.ring-pulse{
  fill:none;
  stroke:var(--primary);
  stroke-width:8;
  stroke-linecap:round;
  transition:stroke 0.3s;
  filter: drop-shadow(0 0 10px rgba(64,224,208,0.6));
}

.breath-inner{
  position:absolute;
  inset:0;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  pointer-events:none;
}

.breath-phase{
  font-size:14px;
  letter-spacing:0.5px;
  text-transform:uppercase;
  color:var(--primary);
  font-weight:700;
  opacity:0.9;
  min-height:18px;
}

.breath-count{
  font-size:52px;
  font-weight:800;
  line-height:1;
  margin-top:4px;
  color:var(--text-main);
}

.breath-cycle{
  font-size:11.5px;
  color:var(--text-muted);
  margin-top:6px;
  letter-spacing:0.5px;
}

.timer-btns{ display:flex; gap:10px; justify-content:center; }'''


def update_style():
    path = "style.css"
    if not os.path.exists(path):
        print(f"⚠ {path} не найден")
        return
    with open(path, "r", encoding="utf-8") as f:
        css = f.read()

    # Заменяем весь блок от "/* ---- Timer ---- */" до "/* ---- Calendar ---- */"
    pattern = re.compile(
        r'/\*\s*----\s*Timer\s*----\s*\*/.*?(?=/\*\s*----\s*Calendar)',
        re.DOTALL
    )
    if not pattern.search(css):
        print(f"⚠ {path}: блок Timer не найден — возможно, уже заменён")
        return
    css = pattern.sub(NEW_TIMER_CSS + "\n\n", css, count=1)

    safe_write(path, css)
    print(f"✓ {path} обновлён")


# ============================================================
# 3. app.js — заменить секцию таймера
# ============================================================
NEW_TIMER_JS = '''/* ---------- Дыхательный таймер 4-4-4-4 ---------- */
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
'''


def update_app():
    path = "app.js"
    if not os.path.exists(path):
        print(f"⚠ {path} не найден")
        return
    with open(path, "r", encoding="utf-8") as f:
        js = f.read()

    # Заменяем секцию от "/* ---------- Таймер практики ---------- */"
    # до "/* ---------- Календарь ---------- */"
    pattern = re.compile(
        r'/\*\s*-+\s*Таймер практики\s*-+\s*\*/.*?(?=/\*\s*-+\s*Календарь)',
        re.DOTALL
    )
    if not pattern.search(js):
        print(f"⚠ {path}: секция 'Таймер практики' не найдена — возможно, уже заменена")
        return
    js = pattern.sub(NEW_TIMER_JS + "\n\n", js, count=1)

    # Обновляем openDay: вместо resetTimerUI + if (day.timer) — resetBreath + всегда показываем
    old_openday = '''  resetTimerUI();
  const timerWrap = document.getElementById("timer-wrap");
  if (day.timer) {
    timerWrap.classList.remove("hidden");
    timerTotal = day.timer;
    timerRemaining = day.timer;
    updateTimerDisplay();
  } else {
    timerWrap.classList.add("hidden");
  }'''
    new_openday = '''  resetBreath();
  const timerWrap = document.getElementById("timer-wrap");
  timerWrap.classList.remove("hidden");'''
    if old_openday in js:
        js = js.replace(old_openday, new_openday)
        print("  ↳ openDay: таймер всегда показывается")

    # Удаляем старые переменные timerInterval и т.п., если остались
    js = re.sub(r'\nlet timerInterval = null;', '', js)
    js = re.sub(r'\nlet timerRemaining = 0;', '', js)
    js = re.sub(r'\nlet timerTotal = 0;', '', js)
    js = re.sub(r'\nlet timerRunning = false;', '', js)

    safe_write(path, js)
    print(f"✓ {path} обновлён")


# ============================================================
# 4. sw.js — поднять версию кэша
# ============================================================
def update_sw():
    path = "sw.js"
    if not os.path.exists(path):
        print(f"⚠ {path} не найден")
        return
    with open(path, "r", encoding="utf-8") as f:
        sw = f.read()

    m = re.search(r'const CACHE_NAME = "pauza-v(\d+)";', sw)
    if m:
        new_v = int(m.group(1)) + 1
        sw = re.sub(
            r'const CACHE_NAME = "pauza-v\d+";',
            f'const CACHE_NAME = "pauza-v{new_v}";',
            sw
        )
        print(f"  ↳ версия кэша → pauza-v{new_v}")
    else:
        sw = 'const CACHE_NAME = "pauza-v4";\n' + sw
        print("  ↳ версия кэша → pauza-v4")

    safe_write(path, sw)
    print(f"✓ {path} обновлён")


if __name__ == "__main__":
    print("→ Обновляю index.html…")
    update_index()
    print("\n→ Обновляю style.css…")
    update_style()
    print("\n→ Обновляю app.js…")
    update_app()
    print("\n→ Обновляю sw.js…")
    update_sw()
    print("\n🎉 Готово! Все файлы обновлены.")