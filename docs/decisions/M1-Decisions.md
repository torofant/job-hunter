# M1 — Decisiones técnicas

## Propósito

Este documento registra las decisiones técnicas cerradas durante M1 del proyecto Job Hunter.

`M0.11_Implementation_Spec.md` continúa siendo la especificación base del proyecto. Este documento no la sustituye: concreta decisiones de implementación de M1 y deja trazabilidad de las pequeñas ampliaciones necesarias para llevarlas a código.

---

## M1.1 — Stack técnico del servicio

### Decisión

El servicio de Job Hunter utilizará:

- TypeScript.
- Fastify como framework HTTP.
- Zod para validación.
- PostgreSQL 18.6 como base de datos.
- `pg` como driver de PostgreSQL.
- Drizzle ORM y Drizzle Kit para acceso a datos, esquema y migraciones.
- Vitest para pruebas.

Durante el desarrollo local, Node.js se ejecutará directamente en Windows. PostgreSQL se ejecutará mediante Docker.

En producción, los componentes se ejecutarán mediante Docker.

### Motivo

Es un stack sencillo y coherente con la experiencia del proyecto, suficiente para el MVP y sin introducir infraestructura o abstracciones innecesarias.

### Relación con M0.11

Esta decisión concreta las tecnologías de implementación de M1. No cambia la arquitectura general definida en M0.11.

---

## M1.2 — Relación entre `ProcessingRun` y `JobDetection`

### Decisión

`JobDetection` tendrá una referencia directa a `ProcessingRun`:

```text
JobDetection.processing_run_id -> ProcessingRun.id
```

La relación utilizada en M1 será:

```text
ProcessingRun 1 ─── N JobDetection
```

### Motivo

Es la forma más sencilla de materializar en la base de datos la relación definida conceptualmente en M0.11.

M1 no necesita todavía representar múltiples ejecuciones históricas de una misma detección. Si el reprocesamiento posterior requiere un modelo diferente, se documentará como una nueva decisión.

### Relación con M0.11

Concreta una relación ya definida en M0.11.

---

## M1.3 — Finalización de un `ProcessingRun`

### Decisión

En M1, un `ProcessingRun` se considera completado cuando se ha validado y persistido correctamente la entrada y su `JobDetection`.

Flujo:

```text
POST /api/jobs
    ↓
Validación
    ↓
RawJobInput
    ↓
ProcessingRun
    ↓
Procesamiento básico
    ↓
JobDetection
    ↓
ProcessingRun = COMPLETED
```

M1 no incluye todavía filtrado, matching, scoring ni procesamiento mediante IA.

### Estados

- `PENDING`: ejecución creada pero todavía no procesada.
- `PROCESSING`: ejecución en curso.
- `COMPLETED`: procesamiento básico completado correctamente.
- `FAILED`: procesamiento no completado después de agotar los reintentos permitidos.

### Relación con M0.11

Concreta el alcance de procesamiento de M1 sin cambiar las fases posteriores definidas en el proyecto.

---

## M1.4 — Procesamiento interno y recuperación

### Decisión

El procesamiento será gestionado por un procesador interno del servicio.

No se utilizarán Redis, RabbitMQ ni otras colas externas en M1.

PostgreSQL será la fuente de estado de los `ProcessingRun` y se utilizará un mecanismo seguro para evitar que dos ejecuciones procesen simultáneamente el mismo registro.

### Reintentos

Cada `ProcessingRun` tendrá:

- `attempt`: número de intento.
- `last_error`: último error registrado, cuando exista.

Se realizará:

1. un intento inicial;
2. hasta 2 reintentos adicionales;
3. si todos fallan, el estado será `FAILED`.

### Relación con M0.11

Esta decisión concreta la estrategia de ejecución de M1 y añade dos campos operativos a `ProcessingRun` que no estaban definidos inicialmente en el modelo conceptual de M0.11:

```text
attempt
last_error
```

La ampliación es necesaria para persistir el estado de recuperación y los errores.

---

## M1.5 — Deduplicación

### Decisión

La deduplicación no se implementará en M1.

Se pospone hasta disponer del modelo `JobOffer`, momento en el que se definirán las reglas concretas de identificación de ofertas duplicadas y las restricciones de base de datos necesarias.

### Motivo

No se implementará una solución provisional sobre los modelos iniciales si todavía no están definidos los datos definitivos sobre los que se aplicará la deduplicación.

### Relación con M0.11

Mantiene la decisión funcional de incluir deduplicación en el flujo general, pero la deja fuera del alcance de M1.

---

## M1.6 — `raw_metadata` y `source`

### Decisión

`raw_metadata` se almacenará como `JSONB` nullable.

En la API será un objeto JSON opcional y podrá tener valor `null`.

No se establece en M1 un límite artificial de tamaño para `raw_metadata`.

`source` será inicialmente un `string` no vacío y no un `enum`.

### Motivo

Permite conservar metadatos específicos de las distintas fuentes sin modificar el esquema cada vez que se incorpore una nueva fuente.

### Relación con M0.11

Concreta el almacenamiento de los datos originales recibidos y mantiene abierta la integración de futuras fuentes.

---

## M1.7 — Autenticación de la API

### Decisión

La API utilizará una única clave configurada mediante variable de entorno:

```text
API_KEY=...
```

Las peticiones autenticadas utilizarán:

```http
Authorization: Bearer <API_KEY>
```

### Alcance

M1 no incluye:

- usuarios;
- JWT;
- OAuth;
- múltiples API keys;
- rotación automática de claves.

Si posteriormente aparece una necesidad real de estos mecanismos, se documentará como una nueva decisión.

### Relación con M0.11

Concreta el mecanismo de autenticación entre n8n y Job Hunter para el MVP.

---

## Resumen de decisiones M1

| ID | Decisión |
|---|---|
| M1.1 | TypeScript + Fastify + Zod + PostgreSQL 18.6 + `pg` + Drizzle + Vitest |
| M1.2 | `JobDetection.processing_run_id -> ProcessingRun.id` |
| M1.3 | `ProcessingRun` termina al persistir correctamente la detección |
| M1.4 | Procesador interno, PostgreSQL como estado y 2 reintentos adicionales |
| M1.5 | Deduplicación fuera del alcance de M1 |
| M1.6 | `raw_metadata` como `JSONB NULL` y `source` como string no vacío |
| M1.7 | Una `API_KEY` mediante Bearer Token |

Estas decisiones quedan cerradas para la implementación de M1. Cualquier modificación posterior deberá documentarse como una nueva decisión o como una modificación explícita de una decisión existente.

## M1.8 — Creación inicial de `JobDetection`

### Decisión

`RawJobInput`, `ProcessingRun` y `JobDetection` se crearán de forma atómica durante la aceptación inicial de la petición.

El flujo será:

```text
POST /api/jobs
    ↓
Validación
    ↓
RawJobInput
ProcessingRun = PENDING
JobDetection
    ↓
202 Accepted + detection_id
    ↓
Procesador interno
    ↓
PROCESSING
    ↓
COMPLETED / FAILED
```

La creación de las tres entidades será atómica: si alguna falla, la petición no se considera aceptada.

### Motivo

El contrato de M0.11 requiere devolver `detection_id` junto con la respuesta `202 Accepted`. Por tanto, `JobDetection` debe existir antes de responder.

### Relación con M0.11

Concreta el orden de persistencia necesario para cumplir el contrato HTTP.

---

## M1.9 — Reserva segura de `ProcessingRun`

### Decisión

La reserva de ejecuciones pendientes se realizará utilizando PostgreSQL mediante:

```sql
SELECT ... FOR UPDATE SKIP LOCKED
```

La fila se bloqueará dentro de una transacción, se marcará como `PROCESSING` y posteriormente se procesará fuera de esa transacción.

### Motivo

Permite evitar que dos procesos procesen simultáneamente el mismo `ProcessingRun` sin introducir Redis, RabbitMQ u otra infraestructura.

### Relación con M0.11

Concreta el mecanismo de concurrencia del procesador interno definido para M1.

---

## M1.10 — Recuperación de ejecuciones `PROCESSING`

### Decisión

Se utilizará la variable:

```text
PROCESSING_RECOVERY_TIMEOUT_MS
```

Una ejecución se considerará abandonada cuando:

```text
status = PROCESSING
AND
started_at < ahora - timeout
```

La ejecución volverá a `PENDING` para poder ser procesada de nuevo.

No se añadirá `heartbeat_at` en M1.

### Motivo

Permite recuperar ejecuciones que quedaron en `PROCESSING` después de una caída del servicio sin añadir un mecanismo adicional de seguimiento.

### Relación con M0.11

Concreta la recuperación de ejecuciones interrumpidas.

---

## M1.11 — Reintentos

### Decisión

Cada procesamiento tendrá un máximo de tres intentos:

- un intento inicial;
- dos reintentos adicionales.

Los reintentos serán inmediatos.

No se utilizará:

- exponential backoff;
- `next_retry_at`;
- scheduler adicional;
- cola de retraso.

`PROCESSING_RECOVERY_TIMEOUT_MS` se utiliza únicamente para recuperar ejecuciones abandonadas.

### Motivo

El procesamiento básico de M1 no necesita una estrategia de reintentos más compleja.

### Relación con M0.11

Concreta la estrategia de recuperación definida en M1.4.

---

## M1.12 — Versión de Node.js

### Decisión

M1 utilizará:

```text
Node.js 24.13.0
```

La misma versión se utilizará durante el desarrollo y en la imagen Docker de producción.

No se introduce ningún gestor adicional de versiones de Node.js.

### Motivo

Mantener una única versión entre desarrollo y ejecución evita diferencias innecesarias de entorno.

### Relación con M0.11

Concreta la versión del runtime utilizada durante M1.

---

## M1.13 — Contrato HTTP y validación Zod

### Decisión

La validación de `POST /api/jobs` será sencilla y explícita:

- `source`, `title` y `company`: strings no vacíos.
- `url`: URL válida.
- `detected_at`: fecha/hora ISO 8601 válida.
- No se realizará normalización de contenido en M1.
- Las propiedades desconocidas serán rechazadas.
- Los errores HTTP utilizarán un formato JSON sencillo y consistente.

Ejemplo:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "La entrada no es válida"
}
```

No se introduce un sistema de errores complejo.

### Motivo

Cubrir las necesidades del contrato de M1 sin introducir reglas de negocio o abstracciones innecesarias.

### Relación con M0.11

Concreta las reglas de validación del contrato de entrada.

---

## M1.14 — Docker Compose de desarrollo

### Decisión

El `docker-compose.yml` de M1 gestionará únicamente PostgreSQL 18.6 para el entorno local.

La arquitectura de desarrollo será:

```text
Windows
└── Node.js 24.13.0
        │
        └── PostgreSQL 18.6
                └── Docker Compose
```

Node.js se ejecutará directamente en Windows.

n8n no formará parte del Compose de desarrollo de M1.

### Motivo

M1 solo necesita PostgreSQL como infraestructura externa. Añadir Node o n8n al Compose introduciría configuración que todavía no es necesaria.

### Relación con M0.11

Concreta la estrategia de desarrollo local para M1. La integración con n8n se abordará en el hito correspondiente.
