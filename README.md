# Maya · Baby tracker privado

Maya convierte los pequeños registros de un día con bebé —alimentación, sueño,
pañales, banco de leche, crecimiento y notas para consulta— en una vista clara,
instalable y útil incluso sin internet.

Esta versión fue rediseñada para [OpenAI Build Week 2026](https://openai.com/es-ES/build-week/)
en la categoría **Apps for your life**. Conserva las funciones familiares del
proyecto original, corrige su frontera de seguridad y añade un demo reproducible
con datos completamente ficticios.

> Maya describe registros; no diagnostica, determina urgencias ni sustituye a un
> profesional de salud.

## Demo para jueces

**Demo público en Sites:** [Abrir Maya](https://maya-baby-tracker-paulhrios.paulintintin.chatgpt.site/)

No se requiere cuenta. Cada URL tiene un escenario sintético aislado:

- `?demo=steady` — registros parecidos al historial reciente.
- `?demo=shift` — cambios frente al historial propio.
- `?demo=sparse` — información insuficiente.
- `?demo=offline` — fallback local sin red.

En el demo se puede registrar, navegar, iniciar timers y restablecer el escenario.
No descarga fotos ni accede al repositorio privado de Maya; usa `sessionStorage`
en un namespace separado.

El port de Sites añade un diario sincronizado en `/diario`: inicio de sesión con
ChatGPT, creación de familia y perfiles de bebé, varios bebés por cuenta, CRUD de
todos los registros, temporizadores persistentes por bebé, fotos privadas en R2,
respaldo JSON e impresión/PDF. Los registros viven en D1 y nunca se mezclan con
el demo. El resumen de una cuenta real se calcula localmente con conteos
observacionales y no envía los datos del bebé a OpenAI.

## Qué puede registrar

- Alimentación: timer de pecho izquierdo/derecho, biberón, fórmula y mililitros.
- Sueño y vigilia: timers, cuidador y bitácora.
- Pañales: pipí, popó, mixto, color, consistencia y foto local cifrada.
- Banco de leche: extracción, refrigeración, congelado, consumo y descarte.
- Condiciones y mediciones, intervenciones, medicamentos y crecimiento.
- Fotos semanales, ideas de juego por edad, rachas y logros.
- Resumen PDF configurable y respaldo JSON validado.
- PWA offline, safe areas de iPhone, cinco destinos, modo noche y diseño responsive.

## Resumen inteligente y GPT‑5.6 Sol

El producto no usa un chatbot médico. La arquitectura separa decisión y redacción:

```text
registros locales
      ↓
snapshot por lista blanca (conteos agregados, sin PII)
      ↓
motor determinista ───────────────→ fallback inmediato/offline
      ↓ solo demo sintético
endpoint de Sites → Responses API → GPT‑5.6 Sol → validación estricta
      ↓
misma tarjeta con evidencia y procedencia
```

El motor local calcula métricas de las últimas 24 horas, cobertura y diferencias
frente a la mediana de los siete días anteriores. GPT‑5.6 Sol solo puede mejorar
la claridad y el tono dentro de un JSON Schema estricto. La respuesta se descarta
si inventa una observación, usa una acción no permitida o hace una afirmación clínica.

Nunca entran al payload: nombre, fecha de nacimiento, cuidadores, timestamps
exactos, notas, fotos, condiciones, medicamentos, dosis, crecimiento, repositorios
o IDs estables. El panel **Ver evidencia y privacidad** muestra el payload agregado.

La PWA estática mantiene el fallback y no contiene una clave de OpenAI. El endpoint
real vive en el port de Sites y su secreto se configura únicamente en el servidor.
La IA sobre datos reales permanece desactivada: la guía de OpenAI requiere Zero
Data Retention antes de procesar datos personales de menores de 13 años.

Más detalle en [ARCHITECTURE.md](ARCHITECTURE.md) y [PRIVACY.md](PRIVACY.md).

## Cuentas y migración desde la versión anterior

Las cuentas de esta PWA son bóvedas locales independientes:

- AES‑256‑GCM, IV nuevo por guardado.
- PBKDF2‑SHA256 con 310,000 iteraciones y salt único.
- Llave no exportable y solo en memoria mientras la sesión está abierta.
- Username normalizado; nombre visible preservado.
- Conflictos entre pestañas detectados por revisión y fusionados por registro.
- Fotos como blobs AES‑GCM en IndexedDB; la llave de medios vive dentro de la bóveda.

La contraseña antigua de cuatro dígitos ya no es adecuada para cifrar información
sensible. En un dispositivo que conserve `maya.data.v1`, la pantalla **Crear cuenta**
ofrece importar el diario anterior y pide una contraseña nueva de al menos 12
caracteres. Solo después de escribir correctamente la bóveda se elimina la copia
JSON sin cifrar.

Esta versión elimina al cargar cualquier sesión y configuración GitHub antigua.
El PAT que apareció cifrado en el historial público debe considerarse comprometido
y revocarse; cambiar solo la contraseña de la app no lo corrige. Consulta
[SECURITY.md](SECURITY.md).

## Desarrollo local

Requiere Node.js 20 o superior; no hay dependencias de npm.

```bash
npm start
```

Abre `http://127.0.0.1:4173/?demo=steady`.

Pruebas y validación de sintaxis:

```bash
npm run check
npm test
```

La suite cubre cifrado/manipulación, contraseña incorrecta, conflictos, validación
de datos, aislamiento del demo, snapshots sin PII, prompt injection, fallos de
contrato, ausencia de secretos y semántica básica PWA.

## Instalar en iPhone

1. Abre el sitio en Safari.
2. Toca **Compartir**.
3. Elige **Agregar a pantalla de inicio**.
4. Abre Maya desde su icono para usarla como app independiente.

La PWA precachea el shell. Los registros siguen disponibles sin internet. En esta
fase estática, cada cuenta vive en ese dispositivo; el port de Sites añade acceso
autenticado y sincronización multi-cuidador.

## Estructura

```text
index.html                 shell accesible y PWA
css/styles.css             sistema visual responsive, AA y modo noche
js/account-vault.js        cuentas y cifrado local
js/media-store.js          fotos cifradas en IndexedDB
js/data-schema.js          allowlist y validación de respaldos
js/demo-data.js            cuatro fixtures sintéticos
js/insights-engine.js      métricas, evidencia, fallback y contrato GPT
js/insights-client.js      cliente opcional, timeout y validación de respuesta
js/store.js                repositorio local/demo y CRUD compatible
js/app.js                  interfaz y flujos conservados
tests/                     22+ pruebas sin llamadas reales
```

## Seguridad y límites conocidos

- No se guardan PAT, API keys ni credenciales fijas en HTML/JavaScript.
- La CSP bloquea scripts y conexiones de terceros.
- Importaciones se normalizan por esquema; IDs y URLs peligrosos se rechazan.
- Cerrar sesión elimina la llave de memoria, no la cuenta cifrada.
- La cuenta local completa y sus fotos pueden eliminarse desde Ajustes.
- No existe recuperación de contraseña en la PWA local.
- El respaldo JSON no incluye los blobs de fotos cifradas.
- Los metadatos de la lista de cuentas (username visible y fechas) no están cifrados.
- El cifrado en reposo no protege frente a JavaScript malicioso del mismo origen
  durante una sesión abierta; por eso la CSP y la eliminación de secretos son críticas.
- GitHub Pages no es el backend de producción. Sites usa origen dedicado,
  autenticación, D1 para registros y R2 para medios.

## Build Week

El repositorio incluye:

- proyecto funcional y datos de muestra sintéticos;
- instrucciones de ejecución y prueba;
- arquitectura y decisiones de privacidad;
- uso explícito de Codex y GPT‑5.6 Sol;
- fallback offline y pruebas automatizadas;
- licencia pública.

Antes de enviar en Devpost faltan dos tareas no versionables: video público de
menos de tres minutos y el Session ID obtenido con `/feedback`.
El guion sugerido está en [docs/demo-script.md](docs/demo-script.md).

## Licencia

[MIT](LICENSE). Las imágenes, registros y demás contenido privado de una familia no
forman parte de esta licencia ni de este repositorio.
