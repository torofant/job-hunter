# AGENTS.md

## Fuente de verdad

`M0.11_Implementation_Spec.md` es la fuente de verdad para las decisiones arquitectónicas y funcionales cerradas durante M0.

No cambies silenciosamente una decisión cerrada de M0.

Si durante la implementación aparece un problema que requiere cambiar una decisión cerrada, detente y explica el problema antes de modificarla.

## Principios del proyecto

- Preferir soluciones simples, legibles y mantenibles.
- Evitar abstracciones y patrones de diseño innecesarios.
- No introducir complejidad sin una necesidad demostrada.
- Mantener responsabilidades claras.
- Preferir código sencillo frente a código ingenioso o difícil de entender.
- Añadir dependencias solo cuando aporten un valor claro.
- Las reglas de negocio deben permanecer en el código de la aplicación, no dentro de los prompts de IA.
- No inventar información que no esté disponible.
- Conservar el historial de procesamiento que sea útil.
- Los tests deben comprobar comportamiento real.

El proyecto debe reflejar el trabajo de un desarrollador junior con experiencia profesional. La calidad del código se mide por claridad, corrección, testing y mantenibilidad, no por sofisticación arquitectónica.

## Idioma

- Identificadores de código: inglés.
- Variables, funciones, clases, endpoints, tablas de base de datos y enums: inglés.
- Documentación: español.
- Mensajes visibles para el usuario: español inicialmente.
- Comentarios del código: español.

## Comentarios

Solo se utilizarán dos tipos de comentarios.

### Comentarios de sección

Se utilizan para separar visualmente secciones relevantes de un archivo.

Ejemplo:

```js
// ─── ESTRUCTURA MENSAJE TELEGRAM ─────────────────────────────
```

### Comentarios funcionales multilínea

Se utilizan únicamente cuando una explicación breve sea útil para recordar cómo funciona algo o por qué existe.

Ejemplo:

```js
/*
 * Se mantiene el mensaje original cuando Claude falla para que
 * un fallo puntual de IA no detenga el procesamiento.
 */
```

No añadir comentarios que simplemente describan código obvio.

No comentar obligatoriamente cada función, variable u operación.

## Entorno de desarrollo

El entorno principal de desarrollo es:

- Windows
- PowerShell
- Docker Desktop
- WSL 2 mediante Docker Desktop

No asumir Bash, Linux ni una máquina virtual de Ubuntu.

Si Linux pasa a ser técnicamente necesario, explicar primero el motivo antes de exigirlo.

## Flujo de implementación

Antes de realizar cambios:

1. Inspeccionar la estructura actual del repositorio.
2. Leer la documentación relevante.
3. Identificar el cambio mínimo y coherente necesario.
4. Implementarlo.
5. Añadir o actualizar tests significativos.
6. Ejecutar los tests y comprobaciones relevantes.
7. Revisar el diff resultante.
8. Informar de qué ha cambiado y de cualquier problema pendiente.

Mantener los cambios centrados. No modificar archivos no relacionados.

## Dependencias y herramientas

No instalar ni añadir herramientas, paquetes o servicios sin una razón.

Cuando una dependencia sea necesaria:

- explicar para qué se necesita;
- utilizar una versión concreta cuando la reproducibilidad sea importante;
- preferir soluciones conocidas y sencillas;
- documentar los requisitos de configuración relevantes.

Nunca asumir que una herramienta necesaria ya está instalada.

## Configuración y secretos

- Utilizar variables de entorno para secretos y configuración externa.
- Nunca subir al repositorio claves API, tokens, contraseñas u otros secretos.
- Mantener fuera de Git los archivos `.env` que contengan secretos.
- Proporcionar un `.env.example` adecuado cuando sean necesarias variables de entorno.

## Servicios externos

Los servicios externos no deben convertirse silenciosamente en lógica de negocio.

En particular:

- Claude estructura y enriquece información.
- La aplicación decide el filtrado, matching, scoring y priorización.
- Los fallos de Telegram no deben hacer fallar el procesamiento de ofertas.
- Los fallos de servicios externos deben gestionarse explícitamente.

## Git

- Mantener los commits centrados y comprensibles.
- No subir secretos ni configuraciones específicas de la máquina local.
- No reescribir el historial salvo que se solicite explícitamente.
- Revisar `git diff` antes de hacer un commit.
