# Reglas del Proyecto — Radar Quest PY

## Iconografía Estricta: 100% SVG (Prohibido Emojis en UI)
- Todos los iconos de interfaz (HUD 16-bits, botones, estados térmicos, avatares/emblemas de marca, marcadores de MapLibre, superposiciones `<canvas>` y paneles administrativos) deben renderizarse únicamente con **SVG** (`lucide-react` o componentes `<svg>` pixel-art/vectoriales propios).
- No utilizar emojis en elementos visuales del DOM ni de `<canvas>`.
- Los emojis solo están permitidos en cadenas de texto plano destinadas a canales externos sin soporte SVG cuando el requerimiento de negocio así lo especifica (ej. generador de copy para portapapeles de WhatsApp/Instagram y payload textual de Web Push).

