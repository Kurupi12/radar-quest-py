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

- [x] **3. Indicador visible de `Proof of Hunt` (`validHuntPings / requiredPings`) y acceso a "Mi Cupón"** *(Completado)*
  - Mostrar en el HUD el progreso de rastreo válido requerido para desbloquear el Premio Mayor (ej. `Rastreo 2/3`) evitando confusiones con `CONSOLATION_CURIOUS`, y ofrecer acceso persistente a los cupones ganados durante la sesión (`GET /api/radar/claims` + botón `"Mis Cupones"` + sincronización `localStorage`) aunque el usuario cierre el modal de victoria.

---

## Prioridad Alta (Mejora directa de la experiencia en la calle)

- [x] **4. Polling adaptativo inteligente y feedback sonoro por cambio de estado** *(Completado)*
  - Espaciar dinámicamente los pings en `RadarGameClient.tsx` según desplazamiento y estado (`4 s` en `CALIENTE`/`QUEMANDO`, `5 s` caminando en `TIBIO`, `7 s` caminando en `CONGELADO`, `12 s` detenido, `15 s` en `FUERA DE ZONA` y `30 s` en pestaña oculta con ping inmediato al moverse `>= 6 m` o volver al foco).
  - Disparar el tono chiptune de `triggerSmartThermalFeedback` ante transiciones de estado térmico o intervalos espaciados (`12 s` `QUEMANDO`, `22 s` `CALIENTE`) para evitar fatiga auditiva en caminatas largas.

- [x] **5. Escala fina en los últimos 30 m + Linterna QR + Botón Re-centrar / Brújula** *(Completado)*
  - Sub-progresión visual no filtrante dentro de `< 30 m` (`climaxLevel: 1 | 2 | 3` sin exponer metros exactos) con acceso no bloqueante (`Ver Radar`) y banner compacto de reapertura.
  - Control de **Linterna (Flash/Torch)** mediante `MediaTrackConstraints` (`capabilities.torch`) en `ArcadeQrScannerModal.tsx` para drops nocturnos.
  - Botones flotantes 100% SVG **"Re-centrar en mí"**, **Brújula (`DeviceOrientationEvent`)** y conmutador de tema visual en `ArcadeMap.tsx`.

- [x] **6. Completar spritesheets de caminata 4D (`north`, `east`, `west`)** *(Completado)*
  - Reemplazados los sprites estáticos por ciclos animados PixelLab nativos de 9 fotogramas para las 4 direcciones (`walk_south`, `walk_north`, `walk_east`, `walk_west`) en `RadarCanvasOverlay.tsx`.

---

## Prioridad Media (Retención, profundidad de juego y viralidad)

- [x] **7. Micro-mecánicas activas durante la caminata (Agencia del jugador)** *(Completado)*
  - Incorporado **"Pulso de Triangulación"** (`POST /api/radar/triangulate`, cooldown `60 s`, barrido visual de sector de `45°` durante `4 s`), congelamiento interactivo `¡BRRR!` (tocar 3 veces sobre el sprite congelado para quebrar el hielo con sonido cristalino) y 2 **Balizas de Ruta** públicas por misión que suman `+1 Proof of Hunt` y reducen `-15 s` el cooldown de triangulación.

- [x] **8. Ranking (*Leaderboard*) por Marca/Ciudad e historial del cazador** *(Completado)*
  - Endpoint `GET /api/radar/leaderboard` y modal **"Salón de Cazadores"** en el HUD con mejores tiempos de captura, capturas totales, filtro por ciudad y pestaña **"Mi Historial"**.

- [x] **9. Audio en `ViralRecorder` y armonía visual HUD / Mapa** *(Completado)*
  - Mezcla de Web Audio SFX + BGM mediante `MediaStreamAudioDestinationNode` dentro del `MediaStream` de `ViralRecorder.tsx`, corrección de etiqueta `CALIENTE (30-160M)`, readout de pista táctica/Proof of Hunt en lienzo 9:16 y armonización estética diurna/nocturna (`.rf-hud-day` / conmutador `rpg-16bit` <-> `cyberpunk-dark`).

