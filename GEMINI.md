# Reglas del Proyecto — Radar Quest PY

## Iconografía Estricta: 100% SVG (Prohibido Emojis en UI)
- Todos los iconos de interfaz (HUD 16-bits, botones, estados térmicos, avatares/emblemas de marca, marcadores de MapLibre, superposiciones `<canvas>` y paneles administrativos) deben renderizarse únicamente con **SVG** (`lucide-react` o componentes `<svg>` pixel-art/vectoriales propios).
- No utilizar emojis en elementos visuales del DOM ni de `<canvas>`.
- Los emojis solo están permitidos en cadenas de texto plano destinadas a canales externos sin soporte SVG cuando el requerimiento de negocio así lo especifica (ej. generador de copy para portapapeles de WhatsApp/Instagram y payload textual de Web Push).

## Alcance Estricto: Cero Funcionalidades No Solicitadas
- Queda estrictamente prohibido inventar o agregar botones, modos, opciones o funcionalidades adicionales que el usuario no haya pedido explícitamente.
- Limitarse única y quirúrgicamente a resolver lo solicitado por el usuario sin añadir características extras por iniciativa propia.

## Documentación Viva Obligatoria (`GDD_RADAR_QUEST_PY.md`)
- El archivo `GDD_RADAR_QUEST_PY.md` en la raíz del proyecto es el documento maestro de diseño y arquitectura del videojuego.
- A partir de ahora, cada vez que se agregue, modifique o elimine cualquier mecánica de jugabilidad, módulo backend/frontend, elemento de UI/UX, animación, sonido o herramienta administrativa en el proyecto, **se debe actualizar automáticamente `GDD_RADAR_QUEST_PY.md` en la sección que le corresponda dentro de la misma entrega**.


