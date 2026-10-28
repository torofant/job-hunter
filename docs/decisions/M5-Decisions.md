# M5 — Decisiones técnicas

## Propósito

Definir el comportamiento de las notificaciones de ofertas de empleo mediante Telegram, incluyendo la formación de lotes, la priorización, el contenido de los mensajes, la gestión de errores y la recuperación tras reinicios.

`M5-Decisions` respeta las decisiones de `M0.11` y `M1–M4`. No modifica los filtros de elegibilidad, las reglas de deduplicación ni el cálculo de Score y Coverage.

## M5.1. Formación y envío de lotes

1. Cada mensaje físico de Telegram puede contener un máximo de cinco ofertas.
2. El temporizador comienza cuando aparece la primera notificación pendiente que corresponde al lote.
3. Cuando se alcanzan cinco ofertas, el lote se cierra y se envía inmediatamente.
4. Si transcurren tres horas desde el inicio del lote sin alcanzar cinco ofertas, se envían las disponibles, aunque solo haya una.
5. La llegada de nuevas ofertas no reinicia el temporizador.
6. Tras un reinicio, se conserva la fecha original de creación de las notificaciones. Si el plazo ya venció, el envío se procesa al recuperar el servicio.
7. Una vez cerrado el lote y reservadas sus notificaciones, su contenido es inmutable. Las ofertas que lleguen después pertenecen al siguiente lote.
8. Si hay más de cinco ofertas pendientes, se procesan lotes sucesivos de hasta cinco, sin pérdida ni duplicación de notificaciones.

No se introduce una entidad `NotificationBatch`. PostgreSQL será la fuente de verdad para seleccionar y reservar las notificaciones de cada envío. La agrupación física no tendrá un registro persistente independiente; los logs técnicos permitirán correlacionar las notificaciones de un mismo intento.

Sin una entidad de lote, la pertenencia al lote abierto se determina a partir de las notificaciones pendientes y queda fijada al reservarlas para el envío.

## M5.2. Priorización dentro de cada lote

La priorización se aplica exclusivamente a las ofertas del lote que se va a enviar. No se crea una entidad de prioridad ni un nuevo cálculo de puntuación.

Se utilizará la siguiente interpretación determinista de la regla de M4:

1. Se toma el Score más alto entre las ofertas que todavía no se han ordenado.
2. Se forma un grupo con las ofertas cuyo Score esté como máximo tres puntos por debajo del Score máximo del grupo.
3. Dentro de ese grupo se ordena por:
   - Coverage descendente.
   - Confidence descendente.
   - Fecha de detección descendente, primero la más reciente.
   - ID estable de la oferta como último desempate.
4. Se repite el proceso con las ofertas restantes.

**Ejemplo:** con Scores de 95, 93, 91 y 89, las ofertas con 95, 93 y 91 forman el primer grupo; la de 89 queda en el siguiente.

Esta interpretación concreta el desempate de M4 para los mensajes de Telegram. Puede situar una oferta con menor Score por delante de otra con mayor Score cuando ambas pertenezcan al mismo grupo. No modifica el Score almacenado ni el cálculo de Coverage.

## M5.3. Contenido del mensaje de Telegram

Los mensajes deben ser concisos, legibles en móvil y orientados a la acción.

Formato de referencia:

🔎 Nuevas ofertas relevantes

1. Backend Developer — Empresa A
   📍 Remote · España
   💰 24.000–30.000 €
   🎯 82/100 · GOOD MATCH
   📊 Cobertura: 91%
   🔗 Ver oferta

2. Full Stack Developer — Empresa B
   📍 Castellón · Híbrido
   🎯 78/100 · GOOD MATCH
   📊 Cobertura: 100%
   🔗 Ver oferta

Se conservarán los siguientes campos cuando estén disponibles:

- Título y empresa.
- Ubicación y modalidad.
- Salario.
- Score y clasificación.
- Coverage.
- Enlace directo a la oferta.

Score y Coverage se muestran ambos porque representan conceptos distintos: el ajuste de la oferta al perfil y la proporción de información utilizable disponible.

Confidence se utiliza para priorizar, pero no se muestra en el mensaje.

No se incluye una fecha de publicación, ya que no debe confundirse con la fecha de promoción o detección de una oferta.

Los campos opcionales que no estén disponibles se omiten o se muestran parcialmente, sin inventar datos.

## M5.4. Elegibilidad y datos incompletos

1. Solo pueden notificarse ofertas que hayan superado los filtros obligatorios existentes.
2. La oferta debe disponer de una URL utilizable para poder incluirse en Telegram.
3. Si el enlace no es utilizable, la oferta se excluye de la notificación y se registra el motivo.
4. La ausencia de salario, ubicación o modalidad no bloquea por sí sola la notificación.
5. Se mantienen las reglas de deduplicación existentes de M0.11 y M2. No se introduce un mecanismo nuevo.

## M5.5. Contenido persistido y estados

Se mantiene una notificación lógica por oferta. Una notificación lógica no equivale necesariamente a un mensaje físico de Telegram: un mensaje físico puede agrupar hasta cinco notificaciones.

`Notification.message` almacena el contenido individual de la oferta. El mensaje físico conjunto se construye al cerrar el lote para su envío.

Los estados acordados son:

- `PENDING`: notificación pendiente de envío.
- `SENDING`: notificación reservada para un intento de envío en curso.
- `SENT`: envío confirmado.
- `FAILED`: fallo confirmado.
- `UNKNOWN`: no se puede determinar si Telegram recibió el mensaje.

La secuencia habitual es:

`PENDING → SENDING → SENT / FAILED / UNKNOWN`

`SENDING` y `UNKNOWN` amplían los estados definidos en M0.11 y deberán documentarse como cambios de M5.

La implementación incorpora los estados `SENDING` y `UNKNOWN`, junto con la migración y los ajustes de persistencia necesarios. La compatibilidad del esquema, la reserva concurrente y las transiciones de estado se han validado mediante las pruebas automatizadas de M5.

## M5.6. Errores y resultados inciertos

1. Si Telegram confirma el envío, todas las notificaciones del intento pasan a `SENT`.
2. Si se confirma que el envío ha fallado, todas pasan a `FAILED`.
3. Si el resultado es ambiguo, todas pasan a `UNKNOWN`.
4. No se reintentan automáticamente las notificaciones `FAILED` ni `UNKNOWN`.
5. Si el servicio se reinicia y encuentra notificaciones abandonadas en `SENDING`, estas pasan a `UNKNOWN` y no se reenvían automáticamente.
6. Si Telegram recibió el mensaje, pero falla la actualización posterior de la base de datos, la recuperación conservadora puede terminar en `UNKNOWN`. Se acepta este resultado para evitar duplicados automáticos.
7. Los errores de Telegram no deben hacer fallar el procesamiento general de ofertas.
8. Cualquier mecanismo posterior de reintento o recuperación de `UNKNOWN` requerirá una decisión explícita.

La actualización de estados de un mismo intento deberá realizarse conjuntamente dentro de una transacción. La llamada de red a Telegram se realizará fuera de la transacción de reserva.

## M5.7. Transacciones, concurrencia y recuperación

PostgreSQL continúa siendo la fuente de verdad del estado operativo. No se incorpora Redis, RabbitMQ ni una cola distribuida.

El procedimiento previsto es:

1. Seleccionar atómicamente hasta cinco notificaciones `PENDING` en un orden determinista.
2. Reservarlas y marcarlas `SENDING` dentro de la misma transacción.
3. Confirmar la transacción antes de contactar con Telegram.
4. Construir el mensaje físico a partir de los contenidos individuales.
5. Ejecutar un único intento de envío.
6. Actualizar los estados de todas las notificaciones del intento en una transacción.
7. Registrar en los logs la correlación entre las notificaciones del mismo intento.

La implementación deberá impedir que dos procesos reserven la misma notificación, que una notificación se envíe dos veces por concurrencia o que un estado terminal vuelva automáticamente a `PENDING`.

No se garantiza entrega exactamente una vez frente a interrupciones entre el envío y la persistencia del resultado. En esos casos se prioriza evitar duplicados mediante `UNKNOWN` y la ausencia de reintentos automáticos.

## M5.8. Temporizador y cierre de lotes

El temporizador se deriva de la fecha persistida de creación de la notificación pendiente más antigua que corresponda al siguiente lote.

1. La fecha original no se reinicia al recuperar el servicio.
2. Si hay cinco notificaciones disponibles, se puede cerrar el lote inmediatamente.
3. Si han transcurrido tres horas y hay menos de cinco, se cierra con las disponibles.
4. La comprobación del vencimiento y la reserva deben coordinarse mediante PostgreSQL para evitar cierres concurrentes duplicados.
5. Las notificaciones que no se reservan permanecen pendientes para el siguiente lote.

`Notification.created_at` debe conservar su significado original. La implementación no deberá modificarlo durante la recuperación ni utilizarlo como sustituto de una fecha de asignación persistida a un lote.

Al no persistirse un objeto de lote abierto, la pertenencia exacta al lote se fija cuando se reservan las notificaciones. Esta es una simplificación aceptada en M5, no una garantía de que exista una agrupación persistente previa al envío.

## M5.9. Duplicados y ofertas modificadas

- Se mantienen las reglas de deduplicación de M2: `source + sourceJobId` cuando exista; en su defecto, URL normalizada.
- Una oferta duplicada no genera una nueva notificación.
- Una notificación pendiente no se duplica ni reinicia el temporizador por la reaparición de la misma oferta.
- Una oferta no puede asignarse a dos envíos.
- Los cambios en una oferta ya notificada no generan automáticamente una nueva notificación en el MVP.

## M5.10. Pruebas de aceptación

Las pruebas deberán verificar, como mínimo:

- Cierre inmediato al alcanzar cinco ofertas.
- Cierre por vencimiento de tres horas con menos de cinco ofertas.
- Conservación del temporizador tras un reinicio.
- Envíos sucesivos cuando existen más de cinco ofertas.
- Orden determinista, incluidos los grupos de Score y los desempates.
- Omisión de campos opcionales ausentes y exclusión de enlaces no utilizables.
- Ausencia de duplicados bajo concurrencia.
- Actualización conjunta de estados para un envío físico.
- Conversión de `SENDING` abandonado a `UNKNOWN`.
- Ausencia de reintentos automáticos para `FAILED` y `UNKNOWN`.
- Compatibilidad de los nuevos estados con el esquema de persistencia y sus consumidores.
- Coordinación entre el temporizador, la reserva y los procesos concurrentes.
- Compatibilidad con los filtros, la deduplicación y el modelo de Score/Coverage anteriores.

## M5.11. Límites del alcance

M5 no introduce:

- Una entidad `NotificationBatch`.
- Una nueva puntuación de prioridad.
- Cambios en el cálculo de Score o Coverage.
- Cambios en los filtros obligatorios o en la deduplicación.
- Reenvíos automáticos de notificaciones con resultado fallido o incierto.
- Un segundo canal de notificación.

## Estado final de las decisiones

**Alcance funcional aprobado. Validación técnica superada.**

La implementación de M5 ha superado las siguientes comprobaciones:

- Suite completa de pruebas automatizadas: **36 archivos y 326 tests superados**.
- `npm run typecheck`: correcto.
- `npm run build`: correcto.
- Pruebas de repositorio, concurrencia, priorización, formato de mensajes, cliente de Telegram y ciclo de vida del procesador.
- Envío controlado de prueba a Telegram confirmado previamente.

Las pruebas automatizadas se ejecutaron utilizando la base de datos aislada `job_hunter_test`, evitando limpiar o modificar accidentalmente los datos de desarrollo.

La validación cubre las reglas de reserva y vencimiento mediante pruebas controladas. No equivale a una prueba operativa continua de tres horas ni acredita por sí sola un despliegue en producción.

Las decisiones funcionales aprobadas permanecen cerradas. Cualquier cambio posterior en el alcance, los estados, la política de reintentos o la gestión de lotes deberá documentarse explícitamente.

**Estado de M5:** implementación y validación técnica completadas. La puesta en producción y su verificación operativa quedan fuera de esta validación.
