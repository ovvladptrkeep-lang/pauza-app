# -*- coding: utf-8 -*-
"""
Автоматически обновляет manifest.json, index.html, sw.js, app.js.
Устойчиво к занятым файлам: пишет во временный .tmp и переименовывает.
"""
import json
import os
import re
import tempfile
import shutil


def safe_write(path, content):
    """
    Безопасная запись: пишем во временный файл, затем атомарно заменяем.
    Так избегаем OSError [Errno 22] на занятых файлах.
    """
    dir_name = os.path.dirname(os.path.abspath(path)) or "."
    tmp_fd, tmp_path = tempfile.mkstemp(dir=dir_name, suffix=".tmp")
    try:
        with os.fdopen(tmp_fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
        # Пытаемся заменить оригинал
        if os.path.exists(path):
            os.replace(tmp_path, path)
        else:
            shutil.move(tmp_path, path)
    except OSError as e:
        # Если не удалось заменить — оставляем .tmp рядом и предупреждаем
        fallback = path + ".new"
        try:
            shutil.move(tmp_path, fallback)
            print(f"  ⚠ {path} занят ({e}). Записал как {fallback}")
            print(f"     → закрой программы, которые держат {path},")
            print(f"       затем переименуй {fallback} → {os.path.basename(path)}")
        except Exception:
            raise
        return False
    return True


# ====== 1. manifest.json ======
def update_manifest():
    path = "manifest.json"
    if not os.path.exists(path):
        print(f"⚠ {path} не найден, пропускаю")
        return

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    data["start_url"] = "./"
    data["scope"] = "./"
    data["display"] = "standalone"
    data["orientation"] = "portrait"
    data["background_color"] = "#1A202C"
    data["theme_color"] = "#1A202C"

    data["icons"] = [
        {"src": "icons/icon-48.png",  "sizes": "48x48",   "type": "image/png"},
        {"src": "icons/icon-72.png",  "sizes": "72x72",   "type": "image/png"},
        {"src": "icons/icon-96.png",  "sizes": "96x96",   "type": "image/png"},
        {"src": "icons/icon-144.png", "sizes": "144x144", "type": "image/png"},
        {"src": "icons/icon-180.png", "sizes": "180x180", "type": "image/png"},
        {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png",
         "purpose": "any maskable"},
        {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png",
         "purpose": "any maskable"},
    ]

    content = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if safe_write(path, content):
        print(f"✓ {path} обновлён")


# ====== 2. index.html ======
def update_index():
    path = "index.html"
    if not os.path.exists(path):
        print(f"⚠ {path} не найден, пропускаю")
        return

    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    # Убираем старые теги (если уже были)
    html = re.sub(r'\s*<link rel="icon"[^>]*>\s*', '\n', html)
    html = re.sub(r'\s*<link rel="apple-touch-icon"[^>]*>\s*', '\n', html)

    icon_tags = (
        '  <link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">\n'
        '  <link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">\n'
        '  <link rel="apple-touch-icon" sizes="180x180" href="icons/icon-180.png">\n'
    )

    if '<link rel="manifest"' in html:
        html = html.replace(
            '<link rel="manifest"',
            icon_tags + '  <link rel="manifest"',
            1
        )
    else:
        html = html.replace("</head>", icon_tags + "</head>", 1)

    if safe_write(path, html):
        print(f"✓ {path} обновлён")


# ====== 3. sw.js ======
def update_sw():
    path = "sw.js"
    if not os.path.exists(path):
        print(f"⚠ {path} не найден, пропускаю")
        return

    with open(path, "r", encoding="utf-8") as f:
        sw = f.read()

    # Поднимаем версию кэша
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
        sw = 'const CACHE_NAME = "pauza-v3";\n' + sw
        print("  ↳ версия кэша → pauza-v3 (создана заново)")

    new_assets = """const ASSETS = [
  "./index.html",
  "./style.css",
  "./app.js",
  "./content.js",
  "./manifest.json",
  "./icons/favicon-32.png",
  "./icons/icon-48.png",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-144.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];"""

    sw = re.sub(r'const ASSETS = \[[^\]]*\];', new_assets, sw, count=1)

    if safe_write(path, sw):
        print(f"✓ {path} обновлён")


# ====== 4. app.js ======
def update_app():
    path = "app.js"
    if not os.path.exists(path):
        print(f"⚠ {path} не найден, пропускаю")
        return

    with open(path, "r", encoding="utf-8") as f:
        js = f.read()

    changed = False

    # --- Фикс 1: авто-обновление прогресс-бара внутри saveState ---
    old_save = """function saveState() {
  if (!STORAGE_AVAILABLE) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    STORAGE_AVAILABLE = false;
    showStorageWarning();
  }
}"""
    new_save = """function saveState() {
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
}"""
    if old_save in js:
        js = js.replace(old_save, new_save)
        print("  ↳ saveState: добавлено авто-обновление прогресс-бара")
        changed = True
    elif "progress-bar-inner" in js and "saveState" in js:
        print("  ↳ saveState: похоже, уже обновлён ранее")
    else:
        print("  ⚠ saveState: не найден шаблон, правь вручную (см. инструкцию)")

    # --- Фикс 2: обновление UI после сохранения дня ---
    old_save_handler = """  saveState();

  const toast = document.getElementById("save-toast");"""
    new_save_handler = """  saveState();

  // Обновляем главную и календарь, чтобы счётчики и прогресс были актуальны
  renderHome();
  renderCalendar();

  const toast = document.getElementById("save-toast");"""

    if old_save_handler in js and "renderHome();\n  renderCalendar();" not in js:
        js = js.replace(old_save_handler, new_save_handler)
        print("  ↳ day-save: добавлен вызов renderHome() + renderCalendar()")
        changed = True
    else:
        print("  ↳ day-save: либо уже обновлён, либо нет шаблона")

    if changed and safe_write(path, js):
        print(f"✓ {path} обновлён")
    elif not changed:
        print(f"  (файл {path} не менялся)")


if __name__ == "__main__":
    print("→ Обновляю manifest.json…")
    update_manifest()
    print("\n→ Обновляю index.html…")
    update_index()
    print("\n→ Обновляю sw.js…")
    update_sw()
    print("\n→ Обновляю app.js…")
    update_app()
    print("\n🎉 Готово.")