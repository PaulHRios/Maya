# Arquitectura

## Fronteras

Maya tiene tres modos que comparten la interfaz, no el almacenamiento:

| Modo | Identidad | Datos | IA | Medios |
|---|---|---|---|---|
| Cuenta local | username + contraseña local | bóveda AES‑GCM | cálculo local | IndexedDB cifrado |
| Demo público | ninguna | fixture sintético en `sessionStorage` | GPT permitido en Sites + fallback | recurso ficticio |
| Sites | Sign in with ChatGPT | D1 por familia/bebé | endpoint servidor | R2 con autorización |

La PWA estática nunca se conecta a GitHub. `maya_datos` es una fuente de migración
administrativa de una sola vez, no una base de datos en producción.

## Datos

El modelo conserva las colecciones históricas: `tomas`, `suenos`, `panales`,
`condiciones`, `intervenciones`, `medicamentos`, `crecimiento`, `fotos`,
`actividades`, `banco` y `borrados`.

`data-schema.js` elimina propiedades desconocidas, limita tamaños, valida fechas,
restringe IDs y admite solo imágenes data URL JPEG/PNG/WebP. En conflictos se usa
last-write-wins por `updatedAt` a nivel de registro, más tombstones.

## Cuenta local

`account-vault.js` guarda un índice mínimo y un registro cifrado por username. El
payload incluye el tracker, timers, preferencias, dispositivo y una llave aleatoria
de medios. Las fotos se cifran por separado para no rebasar la cuota de localStorage.

Las cuentas locales son una etapa segura para la PWA estática, no auth remota. No
hay recuperación ni sincronización entre iPhones hasta Sites.

## IA

`insights-engine.js` es la única autoridad sobre métricas, observaciones, acciones
y evidencia. GPT no recibe registros crudos y no decide estado clínico. El servidor:

1. valida el snapshot y limita tamaño/frecuencia;
2. llama a `gpt-5.6-sol` mediante Responses API con `store:false`;
3. exige Structured Outputs;
4. valida IDs y vocabulario de salida;
5. agrega el disclaimer determinista;
6. ante cualquier error devuelve/retiene el fallback local.

Solo el demo sintético puede llamar al endpoint mientras no haya ZDR aprobado.

## Sites

El port usa capability path:

- SIWC para rutas privadas;
- D1: usuarios, hogares, miembros, bebés, eventos, mediciones e insights;
- R2: fotos cifradas/privadas con acceso autorizado;
- rutas server-side para CRUD e IA;
- demo sin login y sin acceso a tablas privadas.

La migración valida `maya.json`, sube fotos a R2, escribe eventos idempotentes y
compara conteos antes de finalizar. Los datos reales nunca se incorporan al build.
