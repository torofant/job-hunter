# M7 — Decisiones técnicas

## Propósito

Definir la integración entre Gmail, n8n y Job Hunter para recibir alertas de empleo de LinkedIn e InfoJobs, extraer las ofertas y enviarlas a la API de Job Hunter.

n8n actuará como adaptador de entrada. Job Hunter conservará la responsabilidad sobre la validación, persistencia, normalización, deduplicación, filtrado, matching, scoring, priorización y notificación de ofertas.

La integración deberá garantizar la trazabilidad de los correos, la idempotencia de los envíos, la recuperación ante errores y el procesamiento independiente de cada oferta.

## M7.1. Arquitectura y responsabilidades

La integración estará formada por tres componentes:

**Gmail**
- Recibe las alertas de empleo.
- Proporciona el identificador del mensaje, remitente, asunto, fecha de recepción y contenido.

**n8n**
- Detecta los correos relevantes.
- Identifica el portal y el tipo de notificación.
- Extrae las ofertas.
- Construye las peticiones compatibles con la API.
- Genera y persiste las claves de idempotencia.
- Gestiona los envíos, reintentos, estados e incidencias.
- Comunica las incidencias operativas mediante Telegram.

**Job Hunter**
- Expone `POST /api/jobs`.
- Valida y persiste las entradas.
- Gestiona la normalización y deduplicación.
- Ejecuta Filtering y el resto del procesamiento de dominio.
- Gestiona las notificaciones de ofertas.

n8n no escribirá directamente en PostgreSQL de Job Hunter ni replicará sus reglas de negocio.

Se realizará una petición HTTP independiente por cada oferta válida extraída del correo.

Una respuesta HTTP `202` significa que Job Hunter ha aceptado la entrada, no que haya terminado su procesamiento interno.

## M7.2. Identificación y clasificación de correos

La integración admitirá inicialmente alertas de LinkedIn e InfoJobs.

La identificación combinará:
- Remitente del correo.
- Asunto.
- Contenido.
- Características del formato de notificación.
- Reglas de clasificación y extracción específicas del portal.

No se dependerá exclusivamente de coincidencias exactas de asunto o plantillas rígidas.

Se utilizará extracción determinista y flexible, sin depender de servicios de IA generativa de pago.

Se contemplarán los siguientes resultados de clasificación:

- `SUPPORTED`: formato reconocido; se procesan las ofertas extraídas.
- `UNSUPPORTED_FORMAT`: correo de un portal admitido, pero con un formato que no se puede procesar.
- `NO_VALID_OFFERS`: alerta reconocida, pero no se ha podido extraer ninguna oferta que cumpla los requisitos obligatorios.
- `NOT_JOB_ALERT`: correo que no corresponde a una alerta de empleo; se ignora sin generar incidencia operativa.
- `EXTRACTION_PARTIAL`: se han extraído algunas ofertas válidas, pero otras no se han podido procesar.

Cuando se extraigan algunas ofertas válidas y otras tarjetas fallen, las ofertas válidas conservarán la clasificación `SUPPORTED`. El workflow registrará en el `raw_metadata` de cada oferta válida los campos `extraction_warning` e `invalid_offer_positions`. Así las ofertas válidas pueden continuar sin que una tarjeta defectuosa detenga el lote. Cuando sus peticiones alcancen un estado final, el cálculo global marcará el correo como `PARTIAL`.

Si no se extrae ninguna oferta válida, el resultado será `NO_VALID_OFFERS` y el correo quedará `FAILED`.

Se aplicarán estas reglas:

- Si una oferta contiene los campos obligatorios, se enviará a Job Hunter.
- No se descartarán ofertas por ausencia de campos opcionales.
- No se intentará reproducir en n8n la lógica de Filtering.
- Si faltan campos obligatorios, la oferta no se enviará y se registrará una incidencia de extracción.
- Si se extraen correctamente varias ofertas y alguna falla, se procesarán independientemente las demás.
- Se realizarán comprobaciones básicas para evitar enviar datos estructuralmente incorrectos o extraídos de forma manifiestamente defectuosa.

Estas comprobaciones no sustituirán la validación ni las reglas de negocio de Job Hunter.

## M7.3. Estado y persistencia de la integración

Se utilizará n8n self-hosted, ejecutado en infraestructura propia mediante Docker o servidor equivalente.

La persistencia operativa se realizará mediante n8n Data Tables, sin acceder directamente a la base de datos de Job Hunter.

Se conservarán los datos necesarios para gestionar:

- Estado de cada correo.
- Estado de cada oferta.
- Payload original preparado para la API.
- Clave de idempotencia.
- Identidad y huella de la oferta.
- Índice de ocurrencia.
- Historial de intentos.
- Incidencias operativas.
- Estado de las notificaciones de incidencias.
- Fecha del siguiente intento, cuando corresponda.

Antes del primer envío a `POST /api/jobs`, n8n deberá persistir el `RawJobInput` completo que se enviará y la `Idempotency-Key` generada.

Los reintentos y recuperaciones reutilizarán exactamente el mismo payload y la misma clave. No se volverá a extraer ni reconstruir una petición que ya haya sido preparada.

Data Tables almacenará exclusivamente el estado operativo de la integración. PostgreSQL seguirá siendo la fuente de verdad del dominio de Job Hunter.

### Estados globales

Cada correo tendrá uno de estos estados:

- `PENDING`: pendiente de procesamiento.
- `PROCESSING`: procesamiento en curso.
- `COMPLETED`: todas las ofertas válidas han sido aceptadas por la API.
- `PARTIAL`: algunas ofertas han sido aceptadas y otras han fallado.
- `FAILED`: ninguna oferta ha sido aceptada o existe un error general que impide completar el procesamiento.

El estado global se calculará a partir de los resultados individuales de las ofertas.

### Etiquetas de Gmail

El workflow aplicará estas etiquetas terminales:

- `JobHunter/Procesado`: todas las ofertas válidas del correo fueron aceptadas por la API.
- `JobHunter/Error`: el correo terminó en `PARTIAL` o `FAILED`.

Los estados intermedios `PENDING` y `PROCESSING` se conservarán en n8n Data Tables; el workflow no aplicará las etiquetas `JobHunter/Pendiente` ni `JobHunter/Procesando`.

También se utilizará `JobHunter_M7_Registrado` como etiqueta técnica interna. No representa un estado funcional: evita que el correo vuelva a entrar mientras está registrado o procesándose. La búsqueda de entrada excluirá `JobHunter_M7_Registrado`, `JobHunter/Procesado` y `JobHunter/Error`.

Al terminar, se retirará la etiqueta interna y se conservará la terminal correspondiente. Los correos `NOT_JOB_ALERT` conservarán la etiqueta interna para excluirlos de búsquedas futuras.

`JobHunter/Procesado` indica que todas las ofertas válidas fueron aceptadas por la API; no significa que Job Hunter haya terminado su procesamiento interno.

### Recuperación

Se contemplará la recuperación automática de correos que lleven más de 15 minutos sin actividad, siempre que no exista una ejecución activa que los esté procesando.

La recuperación utilizará el estado persistido y no reconstruirá las peticiones ya preparadas.

La concurrencia de producción se limitará mediante:

```env
N8N_CONCURRENCY_PRODUCTION_LIMIT=1
```

Esta configuración no garantiza exclusión mutua para ejecuciones manuales, subworkflows u otros tipos de ejecución. Se evitará ejecutar manualmente el workflow de producción mientras se esté procesando automáticamente.

No se asumirá que Data Tables proporciona bloqueos transaccionales o garantías de exclusión mutua. La implementación deberá comprobar y gestionar los posibles conflictos de concurrencia mediante el estado persistido y las pruebas correspondientes.

Se utilizará un volumen persistente para los datos de n8n y se establecerá un procedimiento de copias de seguridad.

El límite predeterminado de almacenamiento de Data Tables deberá tenerse en cuenta y verificarse durante la validación técnica.

## M7.4. Portales y contrato de entrada

Los únicos portales admitidos inicialmente serán:

- LinkedIn.
- InfoJobs.

El campo `source` identificará el portal de origen:

- `linkedin`
- `infojobs`

Ambos se adaptarán al contrato existente de `POST /api/jobs`.

Los campos obligatorios serán exactamente los establecidos por M1 y M6:

- `source`
- `title`
- `company`
- `url`
- `detected_at`

Los campos opcionales serán:

- `source_job_id`
- `description`
- `location`
- `raw_metadata`

Se incluirán únicamente cuando estén disponibles. La ausencia de información opcional no será motivo para descartar una oferta.

Si falta alguno de los campos obligatorios, n8n no enviará esa oferta y registrará una incidencia de extracción.

La API y Job Hunter conservarán la responsabilidad sobre la validación y el procesamiento de dominio.

## M7.5. Identidad e idempotencia

Se mantendrá la separación entre:

- La identidad utilizada por n8n para garantizar la idempotencia de un envío.
- La identidad utilizada por Job Hunter para deduplicar ofertas.

La deduplicación de Job Hunter seguirá las reglas de M2:

1. `source + sourceJobId`, cuando exista.
2. `normalizedUrl`, cuando no exista `sourceJobId`.

Para la clave de idempotencia se utilizará una representación canónica y determinista que incorpore:

- Versión de identidad: `v2`.
- `gmail_message_id`.
- `source`.
- Identidad primaria de la oferta.
- Huella de contenido.
- Índice de ocurrencia.

La identidad primaria será `source_job_id` cuando exista y sea estable; en caso contrario, será la URL normalizada de acuerdo con los principios establecidos en M2 y M6.5.

La huella de contenido se calculará a partir de:

- Título.
- Empresa.
- URL normalizada.

El índice de ocurrencia permitirá distinguir varias apariciones de una misma identidad primaria con la misma huella dentro de un mismo correo.

El índice se calculará agrupando por identidad primaria y huella de contenido. No se utilizará la posición global de la oferta dentro del correo.

La clave se generará mediante SHA-256 de una representación JSON canónica codificada en UTF-8. La representación deberá ser determinista, ordenar las propiedades y no depender de espacios ni del orden de extracción.

La versión `v2` formará parte de la representación canónica utilizada para calcular el hash. La clave resultante seguirá siendo un digest hexadecimal en minúsculas de 64 caracteres, compatible con el formato exigido por M6.4.

La misma oferta dentro de un mismo correo generará siempre la misma clave. Una nueva detección en otro correo podrá generar una clave diferente.

La idempotencia HTTP y la deduplicación de ofertas seguirán siendo mecanismos independientes.

## M7.6. Fecha de detección y metadatos

`detected_at` corresponderá a la fecha de recepción del mensaje de Gmail.

Se normalizará a ISO 8601 UTC.

No se utilizará:
- La fecha de ejecución de n8n.
- La fecha de publicación de la oferta.
- La fecha de extracción.

El campo `raw_metadata` incluirá:

- `gmail_message_id`
- `source`
- `notification_type`
- `email_subject`
- `email_sender`
- `email_received_at`
- `offer_position`
- `offer_fingerprint`

Los valores de `notification_type` serán:

- `job_alert`
- `similar_jobs`
- `recommended_jobs`

No se almacenará el cuerpo completo del correo ni información personal innecesaria.

Los metadatos serán estables durante los reintentos de una misma petición.

## M7.7. Gestión de errores e incidencias

Las incidencias operativas se comunicarán exclusivamente mediante Telegram, reutilizando el bot y canal existentes.

Se distinguirán de las notificaciones de ofertas gestionadas por Job Hunter.

Las incidencias incluirán, cuando estén disponibles:

- Portal de origen.
- Asunto del correo.
- Remitente.
- Fecha de recepción.
- Tipo de error.
- Descripción.
- Referencia al mensaje de Gmail.

Cada incidencia se persistirá en n8n.

Se conservará el estado de notificación para evitar reenviar incidencias cuyo estado sea `SENT`.

Si el envío a Telegram falla, la notificación permanecerá en `PENDING` y el workflow volverá a intentarlo en la siguiente ejecución programada, actualmente cada 15 minutos. No hay un límite de intentos para estas notificaciones.

El envío a Telegram y la actualización de Data Tables no son atómicos. Si Telegram acepta el mensaje pero falla la actualización a `SENT`, una recuperación posterior puede enviarlo de nuevo. Por tanto, la entrega es al menos una vez y puede haber duplicados en ese caso.

## M7.8. Reintentos e historial de peticiones

Se realizarán un máximo de tres intentos por oferta:

- Intento inicial.
- Primer reintento tras un minuto.
- Segundo reintento tras cinco minutos.

Se reintentará ante:

- Errores de red.
- Timeouts.
- Respuestas HTTP 5xx.
- Respuestas HTTP 429.

Para HTTP 429 se respetará `Retry-After`, cuando esté presente.

Si no existe `Retry-After`, se utilizarán los tiempos de espera establecidos para los reintentos.

Si el tiempo indicado por `Retry-After` supera el máximo que pueda gestionar una ejecución del workflow, la oferta permanecerá pendiente para una recuperación posterior. No se adelantará el reintento.

Se persistirá `next_attempt_at` para evitar que una recuperación envíe la petición antes del momento permitido.

No se reintentará automáticamente ante:

- HTTP 400.
- HTTP 401.
- HTTP 409.

Cada intento tendrá un registro independiente con:

- `gmail_message_id`
- `idempotency_key`
- `attempt_number`
- `attempted_at`
- `http_status`
- `outcome`
- `details`

`outcome` guardará el estado de la oferta tras el intento, por ejemplo `ACCEPTED`, `RETRY_WAIT` o `FAILED`. `details` guardará un resumen del error sanitizado o, si la petición fue aceptada, el `detection_id`. No se almacenarán cabeceras de autorización ni la configuración completa de Axios.

El historial será inmutable y acumulativo. El estado actual de la oferta se almacenará por separado.

Todos los reintentos utilizarán el payload y la clave de idempotencia persistidos antes del primer envío.

Una respuesta HTTP `202` se considerará una aceptación correcta de la petición.

Los reintentos de n8n se limitarán a la aceptación HTTP. La recuperación del procesamiento interno posterior a una aceptación corresponderá a Job Hunter, de acuerdo con M6.10.

## M7.9. Procesamiento parcial y recuperación de ofertas

Cada oferta se procesará independientemente de las demás.

El estado global del correo se calculará a partir de los estados individuales.

Se aplicarán las siguientes reglas:

- Si todas las ofertas válidas han sido aceptadas y no hubo errores de extracción, el correo será `COMPLETED`.
- Si se aceptó al menos una oferta, pero otra oferta falló o hubo una extracción parcial, será `PARTIAL`.
- Si ninguna oferta fue aceptada, será `FAILED`.
- Si no se extrajo ninguna oferta válida de una alerta reconocida, se registrará como `FAILED`.
- Los correos que no sean alertas de empleo se ignorarán sin generar una incidencia operativa.

Durante una recuperación:

- Las ofertas ya aceptadas no se enviarán como nuevas detecciones.
- Se recuperarán únicamente las ofertas pendientes o que deban reintentarse.
- Se reutilizarán sus payloads y claves persistidos.
- Se respetará `next_attempt_at`.
- Se actualizará el estado global del correo.

Un correo `PARTIAL` podrá convertirse en `COMPLETED` cuando todas sus ofertas válidas hayan sido aceptadas.

Un correo `FAILED` también podrá convertirse en `PARTIAL` o `COMPLETED` después de una recuperación satisfactoria.

Las ofertas que no pudieron extraerse por falta de campos obligatorios quedarán registradas como incidencias de extracción. No se inventarán datos ni se enviarán peticiones incompletas.

Los estados de este apartado pertenecen exclusivamente a la integración n8n. No modificarán los estados de `JobDetection`, `ProcessingRun` ni el ciclo de vida de las notificaciones de Job Hunter.

## M7.10. Pruebas de aceptación

La integración se considerará validada cuando se comprueben, como mínimo, los siguientes escenarios.

**Identificación y extracción**
- Reconocimiento de alertas de LinkedIn.
- Reconocimiento de alertas de InfoJobs.
- Identificación de formatos admitidos.
- Identificación de formatos no admitidos.
- Ignorar correos que no sean alertas de empleo.
- Extracción de varias ofertas de un mismo correo.
- Extracción parcial de ofertas.
- Registro de ofertas que no contienen todos los campos obligatorios.

**Contrato e idempotencia**
- Envío correcto de los campos obligatorios.
- Omisión de campos opcionales ausentes.
- Generación determinista de la clave `v2`.
- Diferenciación de ofertas repetidas dentro del mismo correo mediante el índice de ocurrencia.
- Diferenciación de la misma oferta en correos distintos.
- Persistencia del payload y de la clave antes del primer envío.
- Reutilización exacta de ambos en todos los reintentos y recuperaciones.
- Compatibilidad del digest generado con el formato de 64 caracteres hexadecimales de M6.4.

**Respuestas HTTP**
- Tratamiento correcto de HTTP 202.
- Tratamiento de HTTP 400, 401 y 409 sin reintentos automáticos.
- Reintentos ante errores de red, timeout y HTTP 5xx.
- Tratamiento de HTTP 429 y respeto de `Retry-After`.
- Recuperación posterior cuando el tiempo de espera excede la capacidad de una ejecución.

**Persistencia y recuperación**
- Conservación de los estados tras reiniciar n8n.
- Recuperación de ejecuciones interrumpidas.
- Recuperación de correos en estado `PROCESSING` sin actividad.
- Ausencia de reenvíos innecesarios de ofertas aceptadas.
- Recalculo correcto de los estados globales.
- Pruebas de concurrencia para detectar procesamientos simultáneos no deseados.
- Verificación de que una recuperación no adelanta un reintento programado.

**Telegram e incidencias**
- Registro persistente de incidencias.
- Notificación de incidencias mediante Telegram.
- Las incidencias con `notification_status = SENT` no se reenvían durante una recuperación.
- Las incidencias que continúan en `PENDING` se reintentan; si Telegram aceptó el mensaje pero no se persistió `SENT`, puede producirse un duplicado.
- Recuperación de fallos de notificación.
- Independencia entre fallos de Telegram y procesamiento de ofertas.

**Infraestructura**
- Persistencia mediante volumen Docker.
- Verificación de Data Tables y sus límites.
- La copia de seguridad de n8n será manual y semanal, a cargo del propietario.
- La restauración de prueba no será un criterio de cierre de M7; su ejecución queda bajo responsabilidad del propietario cuando lo considere necesario.
- Validación de la configuración de concurrencia.

## M7.11. Límites del alcance

Quedan fuera de M7:

- Incorporar nuevos portales de empleo.
- Modificar el esquema de PostgreSQL de Job Hunter.
- Modificar el contrato de entrada de `POST /api/jobs`.
- Modificar la lógica de idempotencia de M6.
- Modificar las reglas de deduplicación de M2.
- Modificar Filtering, matching, scoring o confidence.
- Modificar la lógica de notificaciones de ofertas.
- Escribir directamente en PostgreSQL desde n8n.
- Realizar scraping de las páginas de las ofertas.
- Implementar un extractor universal basado en IA generativa.
- Desarrollar el dashboard.
- Realizar el despliegue definitivo de producción, correspondiente a M8.

**Excepción aprobada — descripción pública de LinkedIn:** la API puede realizar una petición GET de mejor esfuerzo a la URL pública de una oferta de LinkedIn para extraer su descripción cuando el payload no la incluya. Esta excepción se limita a ese campo y no autoriza scraping general de páginas de ofertas. Si la descripción no puede obtenerse, el procesamiento continúa sin ella.

La implementación de M7 deberá utilizar la infraestructura y las capacidades existentes sin introducir cambios de dominio innecesarios.

## Estado final de las decisiones

Las decisiones funcionales y técnicas de M7 quedan consolidadas en este documento.

La implementación deberá respetar el contrato de M6, las responsabilidades de Job Hunter y las limitaciones de n8n self-hosted.

La validación técnica de Data Tables, concurrencia, recuperación, almacenamiento y copias de seguridad se realizará durante las pruebas de aceptación.