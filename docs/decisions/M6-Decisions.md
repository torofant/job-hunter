# M6 — Decisiones técnicas

## Propósito

Este documento registra las decisiones técnicas propuestas para M6 del proyecto Job Hunter.

`M0.11_Implementation_Spec.md` continúa siendo la especificación funcional base. `M1-Decisions.md`, `M2-Decisions.md`, `M3-Decisions.md`, `M4-Decisions.md` y las decisiones posteriores registran las concreciones de sus respectivos hitos. M6 concreta el contrato de ingestión externa y registra únicamente las ampliaciones necesarias para que los clientes puedan reintentar peticiones de forma segura.

La planificación de hitos se actualiza expresamente: M6 deja de corresponder al Dashboard previsto originalmente en M0.11 y pasa a centrarse en el contrato de ingestión externa. Este cambio de planificación no invalida las decisiones técnicas anteriores que sigan vigentes.

El documento se ha contrastado con `M0.11_Implementation_Spec.md` y las decisiones M1–M5 de la versión del proyecto. Registra las ampliaciones específicas de M6 sin afirmar que estén implementadas.

## M6.1 — Actualización de la hoja de ruta

### Decisión

La planificación propuesta queda reorganizada de la siguiente manera:

| Hito | Alcance |
|---|---|
| M5 | Notificaciones por Telegram |
| M6 | Contrato de entrada e idempotencia HTTP |
| M7 | Integración Gmail → n8n → Job Hunter |
| M8 | Entorno operativo y despliegue |
| M9 | Validación integral y estabilización |
| Hito posterior | Dashboard, todavía sin numeración asignada |

### Motivo

La integración de alertas de empleo necesita un contrato de entrada estable antes de implementar la automatización externa y preparar el despliegue.

### Relación con M0.11

M0.11 situaba originalmente el Dashboard en M6. La nueva hoja de ruta cambia la asignación y secuencia de los hitos futuros, pero no sustituye automáticamente los requisitos funcionales ni las decisiones técnicas ya acordadas. Toda modificación adicional de una decisión cerrada debe quedar documentada explícitamente.

---

## M6.2 — Punto de entrada y responsabilidades

### Decisión

Se mantiene `POST /api/jobs` como punto de entrada para recibir una oferta representada mediante `RawJobInput`. No se creará una API paralela específica para Gmail o n8n.

Cada petición representa una oferta. Si un correo contiene varias ofertas válidas, n8n enviará una petición por oferta.

n8n será un adaptador de integración: localizará alertas, identificará la fuente original, extraerá ofertas, construirá el contrato y llamará a la API. No escribirá directamente en PostgreSQL ni replicará reglas de negocio de Job Hunter.

Job Hunter conservará la responsabilidad sobre validación, persistencia, normalización, deduplicación, filtrado, matching, scoring, priorización y notificaciones.

### Motivo

Reutilizar la interfaz existente evita duplicar validaciones y reglas de negocio, y mantiene el dominio independiente del proveedor de correo y de la herramienta de automatización.

### Relación con M0.11 y M1

Se conserva el contrato `RawJobInput` independiente de la fuente y el endpoint implementado en M1.

---

## M6.3 — Contrato de `RawJobInput`

### Decisión

Se mantiene como base el esquema actual de `RawJobInput`.

Campos obligatorios:

- `source`: fuente original de la oferta.
- `title`: título de la oferta.
- `company`: empresa.
- `url`: URL válida de la oferta.
- `detected_at`: fecha y hora de detección, con zona horaria.

Campos opcionales:

- `source_job_id`: identificador de la oferta en su fuente original.
- `description`: descripción disponible.
- `location`: ubicación disponible.
- `raw_metadata`: objeto con metadatos originales de la fuente; puede omitirse o ser `null`.

El contrato seguirá rechazando propiedades desconocidas. `source` identificará la fuente original de la oferta, no el sistema intermediario n8n. `detected_at` representará la detección, no necesariamente la fecha de publicación.

### Motivo

Un contrato independiente de la fuente permite alimentar el mismo pipeline desde distintos sistemas externos.

### Relación con M0.11

No se cambia la estructura de `RawJobInput` salvo la ampliación de la cabecera HTTP de idempotencia descrita en M6.4.

---

## M6.4 — Cabecera obligatoria `Idempotency-Key`

### Decisión

`POST /api/jobs` exigirá la cabecera HTTP `Idempotency-Key` además de la autenticación Bearer existente.

Ejemplo:

```http
POST /api/jobs
Authorization: Bearer <API_KEY>
Idempotency-Key: <stable-key>
Content-Type: application/json
```

La clave deberá contener entre 1 y 255 caracteres ASCII imprimibles, sin espacios ni caracteres de control (`^[\x21-\x7E]{1,255}$`). n8n utilizará una clave opaca y determinista de 64 caracteres hexadecimales en minúsculas, derivada mediante SHA-256 de una identidad versionada de la detección de origen. La API validará el formato, pero no dependerá de que la clave contenga datos de negocio legibles.

La clave identificará una detección de origen concreta, no una oferta normalizada. La misma clave se reutilizará en todos los reintentos de esa detección. Una aparición posterior de la misma oferta en otro correo podrá usar una clave distinta.

### Motivo

La idempotencia de entrada debe distinguir un reintento técnico de una nueva detección legítima. Usar la URL o `source_job_id` como clave por sí solos podría impedir registrar apariciones posteriores de una oferta.

### Relación con M0.11

Esta decisión amplía el contrato HTTP de M0.11. No cambia el significado de los campos de `RawJobInput` ni las reglas de deduplicación de ofertas.

---

## M6.5 — Generación y estabilidad de la clave en n8n

### Decisión

n8n derivará la clave mediante SHA-256 sobre la representación UTF-8 de un JSON canónico versionado con los campos `version`, `gmail_message_id`, `source` y `offer_identity`. `offer_identity` contendrá un tipo (`source_job_id` o `url`) y su valor. El formato canónico deberá ordenar las claves del objeto y no depender de espacios, del orden de las propiedades ni de la ejecución de n8n. La salida será el digest hexadecimal en minúsculas de 64 caracteres. La versión inicial será `v1`; cualquier cambio incompatible en la regla de identidad requerirá una nueva versión explícita.

La identidad de la oferta será `source_job_id` cuando exista y sea estable; en caso contrario, será la URL extraída del correo, normalizada de forma determinista conforme a los principios de M2: eliminar espacios exteriores, normalizar el hostname a minúsculas y conservar path y query sin eliminar parámetros arbitrariamente. Si un correo contiene varias apariciones indistinguibles de la misma identidad de oferta, n8n deberá consolidarlas antes del envío o definir un discriminador estable que no dependa del orden accidental de extracción.

La clave no dependerá del identificador de ejecución de n8n, de la hora del reintento ni de un valor aleatorio generado en cada ejecución. Si el flujo se reejecuta para el mismo correo y la misma oferta, deberá reconstruir la misma clave. Si la oferta aparece en otro correo, la clave será distinta.

`detected_at` y los campos de `raw_metadata` enviados en los reintentos también deberán ser estables. n8n no regenerará `detected_at` con la hora actual en cada intento ni incluirá identificadores de ejecución o marcas temporales volátiles en el cuerpo. Para alertas de Gmail, `detected_at` deberá derivarse de un valor estable que represente la recepción/detección del mensaje y que se conserve entre ejecuciones, o de un valor inicial persistido por el flujo. No deberá regenerarse con la hora de cada reintento.

### Motivo

La idempotencia solo funciona si los reintentos de una misma operación reutilizan la misma clave y el mismo contenido validado.

### Pendiente de implementación

M7 deberá verificar qué identificador estable de Gmail está disponible en el flujo y resolver cómo representar una oferta cuando una alerta contiene varias ofertas sin identificador de fuente. Esto no bloquea la implementación del contrato HTTP de M6, que recibe la clave y exige que el cliente la reutilice de forma estable.

---

## M6.6 — Persistencia permanente y unicidad

### Decisión

Se añadirá un registro persistente de idempotencia en PostgreSQL. Las claves no tendrán caducidad automática y no se eliminarán mediante una tarea periódica.

El registro almacenará:

- clave de idempotencia (`key`), utilizada como clave primaria;
- huella del contenido validado (`request_hash`);
- `detection_id` asociado;
- fecha de creación (`created_at`).

La clave primaria garantiza la unicidad de cada clave de idempotencia para `POST /api/jobs`. No se necesita un identificador interno adicional.

El diseño definitivo de nombres y tipos se concretará al implementar el esquema. La clave no deberá contener directamente el correo, el nombre de empresa o la URL en texto legible. La huella permitirá comparar una repetición sin guardar otra copia completa del cuerpo de la petición.

La relación con `JobDetection` no podrá eliminar en cascada el registro de idempotencia. Mientras las claves deban conservarse permanentemente, la eliminación de una detección referenciada deberá impedirse o resolverse mediante una futura política de retención aprobada explícitamente.

El registro de idempotencia, `RawJobInput`, `ProcessingRun` y `JobDetection` deberán confirmarse en una misma transacción. La clave no podrá quedar confirmada si la aceptación asociada se revierte.

### Motivo

La conservación permanente requiere que la clave sobreviva a reinicios y despliegues. Una restricción única en la base de datos es necesaria para resolver correctamente peticiones concurrentes.

### Relación con M1

La implementación existente crea la entrada, la ejecución y la detección dentro de una transacción. M6 ampliará esa transacción para incluir el registro de idempotencia.

---

## M6.7 — Comparación del contenido y reutilización de claves

### Decisión

La huella se calculará con SHA-256 sobre una representación canónica del contenido ya validado por el esquema, no sobre el orden textual de las propiedades JSON. La canonicalización deberá:

- convertir `detected_at` a ISO 8601 UTC;
- ordenar recursivamente las claves de objetos;
- conservar el orden de los arrays;
- omitir los campos opcionales ausentes;
- normalizar `raw_metadata` ausente y `raw_metadata: null` a la misma representación;
- conservar los valores `null` dentro de `raw_metadata`.

El mismo contenido semántico no deberá producir huellas distintas por diferencias irrelevantes en el orden de las propiedades JSON. n8n deberá enviar el mismo contenido canónico durante los reintentos de una misma detección.

El comportamiento HTTP será:

| Situación | Respuesta |
|---|---|
| Clave nueva y petición válida | `202 Accepted` con un nuevo `detection_id` |
| Misma clave y mismo contenido | `202 Accepted` con el `detection_id` original |
| Misma clave y contenido distinto | `409 Conflict` con código `IDEMPOTENCY_KEY_REUSED` |
| Falta la clave o su formato no es válido | `400 Bad Request` |
| Autenticación ausente o incorrecta | `401 Unauthorized` |
| Cuerpo inválido | `400 Bad Request` |

Los errores mantendrán el formato de respuesta implementado por la API (`status`, `code` y `message`). El conflicto usará este cuerpo:

```json
{
  "status": "error",
  "code": "IDEMPOTENCY_KEY_REUSED",
  "message": "La clave de idempotencia ya se utilizó con otro contenido"
}
```

Los errores de clave o cuerpo inválidos utilizarán el `400` de validación existente. La autenticación se ejecuta antes del manejador de la ruta, por lo que una petición sin autenticación válida devolverá `401` aunque también falte la cabecera o el cuerpo sea inválido. Las peticiones rechazadas por autenticación o validación no consumirán la clave. El uso de una clave ya registrada con contenido diferente no modificará el registro original.

### Motivo

La comparación de contenido evita que una clave reutilizada accidentalmente o por un error de integración oculte una oferta distinta. La canonicalización evita falsos conflictos causados únicamente por el orden de las propiedades JSON o por diferencias de representación temporal.

### Respuesta repetida

Una repetición idéntica devolverá la respuesta de aceptación original, incluido el mismo `detection_id`. No creará otro `RawJobInput`, `ProcessingRun` ni `JobDetection`.

## M6.8 — Concurrencia y fallos transaccionales

### Decisión

La unicidad de la clave se garantizará en PostgreSQL, no únicamente mediante una consulta previa en la aplicación.

La implementación deberá garantizar estos resultados:

- Dos peticiones simultáneas con la misma clave y el mismo contenido producen una sola aceptación.
- Si las peticiones concurrentes contienen cuerpos diferentes, solo una podrá aceptar la clave; la otra recibirá `409`.
- Si la transacción de aceptación falla, no quedará una clave registrada sin su detección ni una detección creada por una aceptación revertida.
- Si una petición repetida encuentra una clave existente, recuperará el `detection_id` original.
- Los errores inesperados de base de datos no se convertirán silenciosamente en respuestas de aceptación.

La estrategia concreta para gestionar conflictos de unicidad deberá respetar los límites de las transacciones de Drizzle y PostgreSQL, y probarse con peticiones concurrentes. Si la inserción de la clave provoca una violación de unicidad, la transacción perdedora deberá revertirse por completo; después, fuera de la transacción abortada, se recuperará el registro ganador y se comparará la huella antes de responder. No se intentará continuar consultando dentro de una transacción PostgreSQL que ya haya quedado abortada.

### Motivo

Una secuencia de «consultar si existe y después insertar» sin restricción única no evita carreras entre peticiones simultáneas.

---

## M6.9 — Separación entre idempotencia y deduplicación de ofertas

### Decisión

La idempotencia HTTP y la deduplicación de ofertas son mecanismos independientes.

La idempotencia evita aceptar dos veces la misma operación de origen identificada por la misma clave. La deduplicación de M2 determina si detecciones diferentes corresponden a una oferta normalizada ya existente.

Se conservan las reglas de M2:

1. `source + sourceJobId`, cuando exista.
2. `normalizedUrl`, como alternativa.

Una nueva detección de una oferta ya conocida podrá conservarse como historial y asociarse a la oferta existente. La idempotencia no deberá impedir nuevas detecciones legítimas cuando la oferta vuelva a aparecer en otra alerta.

### Motivo

La clave de idempotencia representa una operación de entrada; la identidad normalizada representa una oferta. Confundir ambas identidades eliminaría historial legítimo o generaría procesamiento redundante.

### Relación con M0.11 y M2

Se conservan las reglas de deduplicación y actualización de ofertas de M0.11 y M2. M6 no introduce similitud semántica ni modifica los criterios de identidad de las ofertas.

---

## M6.10 — Reintentos y procesamiento asíncrono

### Decisión

Se mantienen las reglas de reintento del contrato base:

- No reintentar errores `400`, `401` ni `409`. Un `409` indica que el cliente reutilizó una clave con contenido distinto y requiere intervención o corrección del cliente, no un reintento automático.
- Permitir reintentos limitados ante errores temporales, como errores de red o respuestas `500`.
- Ante una respuesta `202`, considerar aceptada la petición, no completado el procesamiento.

Si se pierde la respuesta después de que la transacción se haya confirmado, n8n podrá repetir la petición con la misma clave y recuperar el `detection_id` original.

Si el procesamiento interno falla después de la aceptación, la clave seguirá vinculada a esa aceptación. Repetir la petición no creará una detección nueva. La recuperación de ejecuciones pendientes o fallidas corresponderá al pipeline interno y no a la idempotencia HTTP.

### Motivo

La aceptación HTTP y la finalización del procesamiento son etapas diferentes. La idempotencia no debe utilizarse como mecanismo de reintento del pipeline interno.

---

## M6.11 — Autenticación y compatibilidad de clientes

### Decisión

Se conserva la autenticación existente:

```text
Authorization: Bearer <API_KEY>
```

La cabecera `Idempotency-Key` será obligatoria para las nuevas peticiones a `POST /api/jobs`. Los scripts manuales, las pruebas y cualquier cliente existente deberán actualizarse para enviar una clave.

La autenticación se comprobará antes de procesar la petición. No se almacenarán claves de API ni otros secretos en el registro de idempotencia.

### Motivo

El endpoint debe continuar protegido por la autenticación existente, mientras la nueva cabecera protege frente a duplicados por reintentos.

### Relación con M0.11 y M1

Se conserva el mecanismo Bearer existente. La obligación de aportar `Idempotency-Key` es una ampliación explícita del contrato HTTP.

---

## M6.12 — Pruebas de aceptación

### Decisión

La implementación de M6 deberá cubrir, como mínimo:

- Una petición válida con clave nueva devuelve `202` y un `detection_id`.
- La repetición idéntica devuelve `202` y el mismo `detection_id`.
- La repetición idéntica no crea otra entrada, detección ni ejecución de procesamiento.
- La misma clave con contenido diferente devuelve `409` y `IDEMPOTENCY_KEY_REUSED`, sin alterar el registro original; un reintento posterior del contenido original sigue devolviendo el `detection_id` inicial.
- La falta de clave, una clave vacía, una clave con espacios/caracteres de control o una clave de más de 255 caracteres devuelve `400`.
- Las peticiones no autenticadas siguen devolviendo `401`, incluso si también falta `Idempotency-Key` o el cuerpo es inválido.
- Las entradas inválidas siguen devolviendo `400` y no consumen la clave.
- El conflicto `409` conserva el formato de error `{ status, code, message }` de la API.
- Dos peticiones simultáneas con la misma clave producen una única aceptación.
- Una transacción fallida no deja registros parciales ni una clave huérfana.
- La conservación de la clave persiste tras cerrar y volver a abrir conexiones o reiniciar la aplicación.
- Una aparición posterior de la misma oferta con una clave nueva conserva el comportamiento de deduplicación e historial de M2.
- Los clientes de pruebas existentes se actualizan para incluir la cabecera.
- La suite de pruebas, el typecheck y el build finalizan correctamente.

Las pruebas de persistencia utilizarán una base de datos de pruebas aislada. No deberán limpiar ni modificar accidentalmente la base de datos de desarrollo.

---

## M6.13 — Límites del alcance

M6 no introduce:

- La automatización completa de Gmail ni los flujos finales de n8n.
- El despliegue en producción.
- Una API paralela para fuentes específicas.
- Escrituras directas desde n8n a PostgreSQL.
- Una entidad `Email`.
- Una nueva política de deduplicación de ofertas.
- Cambios en filtros, Matching, Scoring, Coverage, Confidence o priorización.
- Cambios en los estados o en el ciclo de vida de las notificaciones de Telegram.
- El Dashboard, aplazado a un hito posterior.

La implementación de M6 sí incluye la ampliación de la transacción de aceptación, el esquema y migración de idempotencia, el contrato HTTP, la actualización de clientes y pruebas, y la documentación de uso de la API.

---

## Estado de las decisiones

**Estado del diseño e implementación: completados y validados.**

La hoja de ruta queda definida como:

```text
M6 — Contrato de entrada e idempotencia HTTP
M7 — Gmail → n8n → Job Hunter
M8 — Entorno y despliegue
M9 — Validación integral y estabilización
Dashboard — Hito posterior, pendiente de asignación
