# Privacidad

Maya contiene información sensible de una bebé y de sus cuidadores. La regla del
proyecto es minimizar por defecto.

## PWA local

- El diario se cifra en reposo con una contraseña elegida por el cuidador.
- La llave no se persiste y se elimina al cerrar sesión o recargar.
- Las fotos se cifran antes de escribirse en IndexedDB.
- El demo usa otro namespace y solo fixtures ficticios.
- El service worker cachea código e iconos, nunca registros ni respuestas de IA.
- No hay analytics, anuncios, trackers ni llamadas a terceros.

## IA

El snapshot permitido contiene únicamente banda de edad, cobertura y métricas
agregadas/redondeadas. Se excluye todo texto libre y dato clínico.

OpenAI indica que no se deben procesar datos personales de menores de 13 años sin
Zero Data Retention aprobado. `store:false` no equivale a ZDR. Por ese motivo la IA
remota está habilitada exclusivamente sobre datos sintéticos hasta cumplir esa
condición y completar una revisión formal.

Referencias:

- [Under 18 API Guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance)
- [Data controls](https://developers.openai.com/api/docs/guides/your-data)
- [Usage policies](https://openai.com/policies/usage-policies/)

## Exportaciones

El respaldo JSON y el PDF pueden contener el diario. El usuario recibe un aviso
antes de exportar y debe guardarlos en un lugar privado. El JSON no incorpora los
blobs de fotos cifradas. El demo exporta solo datos ficticios.

## Eliminación

En la PWA local, borrar un registro crea un tombstone y elimina su foto cifrada de
IndexedDB. También se puede eliminar una cuenta local completa, incluida su bóveda
y sus medios. Sites aplica borrado de D1/R2 y una política de retención explícita.
