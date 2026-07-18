# Seguridad

## Acción inmediata para la versión anterior

El historial público anterior contenía un PAT de GitHub cifrado con una credencial
débil y los parámetros necesarios para intentar recuperarlo. Debe asumirse
comprometido y **revocarse/rotarse en GitHub**. Cambiar el password de la app o
borrar el valor de la rama actual no invalida un token ya copiado ni lo elimina del
historial Git.

La versión 2:

- elimina hash global, token embebido, configuración remota y enlace `#setup`;
- borra del navegador la configuración/token legacy al cargar;
- no acepta tokens en Ajustes;
- valida importaciones y aplica CSP;
- separa demo y cuentas;
- cifra registros y fotos.

## Reportar una vulnerabilidad

No publiques credenciales, datos reales ni detalles explotables en un issue. Usa un
GitHub Private Vulnerability Report / Security Advisory del repositorio.

Incluye versión, navegador, pasos mínimos y posible impacto. Usa únicamente datos
sintéticos en la reproducción.

## Fuera de alcance

- Recuperar una cuenta local sin su contraseña.
- Sincronización multi-dispositivo en GitHub Pages.
- Consejo o evaluación médica.
