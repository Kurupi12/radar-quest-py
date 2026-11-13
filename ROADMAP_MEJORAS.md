# Plan Priorizado de Mejoras — Radar Quest PY

Documento vivo de seguimiento técnico y de jugabilidad para implementar mejoras de producto por orden de prioridad.

---

## Prioridad Crítica (Impacto inmediato y seguridad)

- [x] **1. Corregir las 3 brechas técnicas detectadas en el código** *(Completado)*
  - **1.1. Tolerancia peatonal real en `< 30 m` (`< 35 km/h`):** Corregir `computeThermalBracket` y el umbral de `inVehicleMode` en `src/lib/radar/engine.ts` (más sincronización en `src/lib/radar/tacticalVectorAssistance.ts` y `RadarGameClient.tsx`) para que picos de jitter GPS de `20–34.9 km/h` cerca del tesoro no bloqueen el estado `QUEMANDO`, manteniendo bloqueado cualquier avance rápido en vehículo (`>= 35 km/h` dentro de `< 30 m`, `>= 20 km/h` fuera).
  - **1.2. Lectura GPS fresca obligatoria al reclamar (`QrClaimModal` y `ArcadeQrScannerModal`):** Centralizar `getFreshGpsCoords` en `src/lib/radar/geo.ts` con `maximumAge: 0` para forzar un fix real del GPS al validar reclamos en modo real (evitando rechazos falsos por coordenadas cacheadas en `localStorage` o por el centro difuso `publicCenterLat/Lng` al abrir links externos `/b/[brand]/claim`).
  - **1.3. Cierre de brechas de seguridad en APIs:** Restringir `POST /api/radar/demo-step` en producción (requiere sesión verificada de Comercio o Super-Admin, o `ENABLE_RADAR_DEMO="true"`) y exigir sesión HMAC-SHA256 verificada en `POST /api/radar/ping` y `POST /api/radar/claim` sin aceptar suplantación vía `body.hunterId`, manejando expiración `401` limpiamente en `RadarGameClient`.

- [x] **2. Selector de misiones por cercanía/ciudad en el HUD del jugador** *(Completado)*
  - Conectar `setSelectedMissionId` en `RadarGameClient.tsx` mediante un selector compacto en el HUD superior/tarjeta de misión para alternar entre misiones activas de una misma marca, preseleccionando automáticamente la misión más cercana al GPS o mostrando macro-distancia/ciudad cuando está `FUERA DE ZONA`.

- [ ] **3. Indicador visible de `Proof of Hunt` (`validHuntPings / requiredPings`) y acceso a "Mi Cupón"**
  - Mostrar en el HUD el progreso de rastreo válido requerido para desbloquear el Premio Mayor (ej. `Rastreo 2/3`) evitando confusiones con `CONSOLATION_CURIOUS`, y ofrecer acceso persistente a los cupones ganados durante la sesión aunque el usuario cierre el modal de victoria.

---

## Prioridad Alta (Mejora directa de la experiencia en la calle)

- [ ] **4. Polling adaptativo inteligente y feedback sonoro por cambio de estado**
  - Espaciar dinámicamente los pings en `RadarGameClient.tsx` según desplazamiento y estado (`~4 s` caminando activo, `12–15 s` detenido o en `FUERA DE ZONA`) para ahorrar batería, reducir tráfico serverless y evitar saturar `HunterPing` / Heatmap.
  - Disparar el tono chiptune de `triggerThermalFeedback` principalmente ante transiciones de estado térmico/táctico o intervalos espaciados para evitar fatiga auditiva en caminatas largas.

- [ ] **5. Escala fina en los últimos 30 m + Linterna QR + Botón Re-centrar / Brújula**
  - Añadir sub-progresión visual dentro de `< 30 m` (ej. pulso fino hacia `< 10 m`) sin bloquear de golpe todo el mapa al primer segundo si el jugador aún está buscando el cartel físico.
  - Agregar control de **Linterna (Flash/Torch)** mediante `MediaTrackConstraints` en `ArcadeQrScannerModal.tsx` para drops nocturnos.
  - Agregar botón flotante SVG **"Re-centrar en mí"** y rotación opcional por brújula (`DeviceOrientation`) en `ArcadeMap.tsx`.

- [ ] **6. Completar spritesheets de caminata 4D (`north`, `east`, `west`)**
  - Reemplazar los sprites estáticos con rebote `stepBob` en Norte, Este y Oeste por ciclos animados reales en `RadarCanvasOverlay.tsx` para eliminar el efecto de deslizamiento.

---

## Prioridad Media (Retención, profundidad de juego y viralidad)

- [ ] **7. Micro-mecánicas activas durante la caminata (Agencia del jugador)**
  - Incorporar un **"Pulso de Triangulación"** con cooldown (ej. cada `60 s` mostrar durante `3 s` un sector/cuadrante aproximado), hacer interactivo el congelamiento `¡BRRR!` (tocar para romper el hielo más rápido) y evaluar nodos intermedios de bonus en rutas largas.

- [ ] **8. Ranking (*Leaderboard*) por Marca/Ciudad e historial del cazador**
  - Tabla pública con mejores tiempos de captura, rachas y misiones completadas para fomentar la competencia recurrente entre drops.

- [ ] **9. Audio en `ViralRecorder` y armonía visual HUD / Mapa**
  - Mezclar la salida Web Audio / BGM dentro del `MediaStream` de `ViralRecorder.tsx` para exportar Reels/Stories con música Synthwave sincronizada, corregir el texto de `CALIENTE` (`30–160 m`), añadir el readout táctico y definir unificado estético entre mapa RPG diurno y HUD.

