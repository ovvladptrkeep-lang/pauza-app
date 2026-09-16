# -*- coding: utf-8 -*-
"""
Генератор мастер-иконки PWA «Пауза».
Рисует логотип: тёмный фон + бирюзовое кольцо с разрывом сверху + точка.
Результат: icon-master-1024.png в корне проекта.
"""
from PIL import Image, ImageDraw

BG      = (26, 32, 44)      # --bg-dark  #1A202C
PRIMARY = (64, 224, 208)    # --primary  #40E0D0

SIZE = 1024
img = Image.new("RGBA", (SIZE, SIZE), BG)
draw = ImageDraw.Draw(img)

cx = cy = SIZE / 2
ring_r_outer = SIZE * 0.36
ring_width   = SIZE * 0.10
dot_r        = SIZE * 0.095

# Кольцо как дуга с разрывом сверху (~22°)
gap_deg = 22
start_angle = -90 + gap_deg / 2
end_angle   =  270 - gap_deg / 2

bbox_outer = [cx - ring_r_outer, cy - ring_r_outer,
              cx + ring_r_outer, cy + ring_r_outer]
bbox_inner = [cx - ring_r_outer + ring_width, cy - ring_r_outer + ring_width,
              cx + ring_r_outer - ring_width, cy + ring_r_outer - ring_width]

draw.pieslice(bbox_outer, start=start_angle, end=end_angle, fill=PRIMARY)
draw.pieslice(bbox_inner, start=0, end=360, fill=BG)
draw.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=PRIMARY)

# Скругление углов
mask = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, SIZE, SIZE], radius=SIZE * 0.22, fill=255)

final = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
final.paste(img, (0, 0), mask)
final.save("icon-master-1024.png")
print("✓ icon-master-1024.png — мастер-иконка готова")