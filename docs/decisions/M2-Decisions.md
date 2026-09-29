# M2 — Decisiones técnicas

## Propósito

Este documento registra las decisiones técnicas cerradas durante M2 del proyecto Job Hunter.

`M0.11_Implementation_Spec.md` continúa siendo la especificación base del proyecto y `M1-Decisions.md` mantiene las decisiones cerradas de M1.

Este documento concreta las decisiones tomadas durante la implementación de M2 que no estaban completamente definidas en M0.11 o que requieren una concreción específica para llevarlas a código.

Las decisiones de este documento no deben cambiarse silenciosamente. Si durante la implementación aparece un problema que requiere modificar una decisión cerrada, deberá documentarse explícitamente.

---

## M2.1 — Modelo interno `JobOffer`

### Decisión

M2 introduce `JobOffer` como entidad normalizada y deduplicada que representa una oferta de empleo dentro del sistema.

La información de `JobOffer` se divide conceptualmente en:

```text
JobOffer
├── Identification
│   ├── id
│   ├── source
│   ├── sourceJobId
│   ├── normalizedUrl
│   ├── title
│   └── company
│
├── Classification
│   ├── jobFamily
│   └── role
│
├── Location
│   ├── country
│   ├── city
│   ├── modality
│   └── distanceKm
│
└── Conditions
    ├── contract
    ├── employmentType
    └── workingHours
```

Los campos que todavía no se procesan en M2 mediante el modelo definitivo de requirements, matching o scoring permanecen fuera de esta primera implementación.

Los valores desconocidos se representan explícitamente mediante `UNKNOWN` cuando el campo utiliza un enum.

### Motivo

M1 trabaja sobre `RawJobInput`, `JobDetection` y `ProcessingRun`. M2 necesita una representación interna estable sobre la que puedan ejecutarse deduplicación y filtrado.

### Relación con M0.11 / M1

M0.11 define `JobOffer` como la entidad normalizada y establece la relación:

```text
JobDetection N:1 JobOffer
```

M1 había pospuesto la deduplicación hasta disponer de este modelo.

---

## M2.2 — Clasificación de ofertas

### Decisión

`JobOffer` utilizará valores controlados para clasificar familia y rol.

Las familias son:

```text
WEB
SOFTWARE
AUTOMATION
SYSTEMS
SUPPORT
OTHER
UNKNOWN
```

Los roles se representan mediante un enum específico, incluyendo los roles relevantes para el perfil objetivo y los necesarios para aplicar filtros, entre ellos:

```text
FULL_STACK_DEVELOPER
FRONTEND_DEVELOPER
BACKEND_DEVELOPER
WEB_DEVELOPER
SOFTWARE_DEVELOPER
AUTOMATION_DEVELOPER
INTEGRATION_DEVELOPER
PROCESS_AUTOMATION_DEVELOPER
SYSTEM_ADMINISTRATOR
DEVOPS
INFRASTRUCTURE_ENGINEER
APPLICATION_SUPPORT
TECHNICAL_SUPPORT
TECHNICAL_CONSULTANT
HARDWARE_TECHNICIAN
OTHER
UNKNOWN
```

### Motivo

El filtrado necesita distinguir categorías relevantes de categorías que deben rechazarse directamente, especialmente soporte hardware.

`UNKNOWN` representa ausencia de información suficiente y no debe interpretarse como una clasificación negativa.

---

## M2.3 — Normalización determinista inicial

### Decisión

La normalización comienza construyendo un `JobOffer` candidato de forma determinista a partir de `RawJobInput`.

La aplicación genera el identificador interno y normaliza la URL.

La normalización de URL:

- elimina espacios exteriores;
- utiliza `URL`;
- normaliza el hostname a minúsculas;
- conserva path y query;
- no elimina parámetros arbitrariamente.

Los campos semánticos que no pueden determinarse de forma fiable inicialmente permanecen en `UNKNOWN` o `null`.

### Motivo

La aplicación debe disponer siempre de un candidato válido antes de utilizar servicios externos.

La normalización determinista evita depender de Claude para información estructural o trivial.

---

## M2.4 — Enriquecimiento mediante Claude

### Decisión

Claude se utiliza como servicio auxiliar de enriquecimiento semántico durante la normalización.

El flujo es:

```text
RawJobInput
    ↓
normalización determinista
    ↓
JobOffer candidate
    ↓
Claude enrichment
    ↓
merge
    ↓
JobOffer
```

Claude puede completar o mejorar:

```text
jobFamily
role
country
city
modality
contract
employmentType
workingHours
```

Claude no puede modificar:

```text
id
source
sourceJobId
normalizedUrl
title
company
```

Claude tampoco decide:

```text
filtering
matching
scoring
prioritization
deduplication
```

### Motivo

Claude aporta valor en la interpretación semántica de títulos, descripciones y localizaciones, pero las reglas de negocio deben permanecer en la aplicación.

### Relación con M0.11

M0.11 define Claude como servicio auxiliar de normalización/enriquecimiento y establece expresamente que no controla las decisiones de filtrado, matching, scoring ni prioridad.

---

## M2.5 — Evidencia utilizada por Claude

### Decisión

Claude recibe únicamente la información relevante para interpretar la oferta.

La evidencia principal es:

```text
title
company
description
location
```

La información auxiliar puede incluir:

```text
source
sourceJobId
url
raw_metadata seleccionado
```

`raw_metadata` se limita a campos relevantes para el enriquecimiento, como salario, contrato, modalidad, ciudad o país.

Source, URL y source job ID no se consideran por sí mismos evidencia semántica para decidir la clasificación.

### Motivo

Evitar enviar información innecesaria y reducir interpretaciones basadas en datos que no describen realmente el puesto.

---

## M2.6 — Valores desconocidos en el enriquecimiento

### Decisión

Claude debe devolver `UNKNOWN` o `null` cuando la evidencia disponible no sea suficiente.

No se permiten inferencias sin evidencia suficiente.

Durante el merge:

- un valor `UNKNOWN` de Claude no sustituye un valor determinista conocido;
- un `null` de Claude no elimina un valor determinista conocido;
- los valores conocidos conservan prioridad sobre información desconocida.

### Motivo

La ausencia de información no debe convertirse artificialmente en una clasificación negativa ni borrar información fiable.

---

## M2.7 — Fallo de Claude

### Decisión

Un fallo de Claude no debe detener el procesamiento de una oferta.

Cuando Claude falla:

1. se conserva el candidato determinista;
2. no se crea un registro `AIUsage` para esa llamada fallida;
3. el procesamiento continúa;
4. el filtrado se ejecuta sobre la información disponible.

La pérdida de información provocada por el fallo podrá reflejarse posteriormente mediante Coverage/Confidence.

### Motivo

Claude es un servicio auxiliar y no debe convertirse en un punto único de fallo del pipeline.

---

## M2.8 — Registro de consumo de IA

### Decisión

Cada enriquecimiento realizado correctamente mediante Claude genera un registro `AIUsage` asociado a `JobDetection`.

Se almacenan:

```text
id
detectionId
provider
model
inputTokens
outputTokens
estimatedCost
createdAt
```

La relación es:

```text
JobDetection 1:N AIUsage
```

El coste estimado puede permanecer `null` cuando todavía no se calcula en el punto de ejecución.

### Motivo

Permitir conocer el consumo de IA por detección sin introducir todavía sistemas de facturación o agregación complejos.

### Relación con M0.11

M0.11 ya contempla `AIUsage` como entidad relacionada 1:N con `JobDetection`.

---

## M2.9 — Modelo de Claude

### Decisión

El proveedor inicial es Anthropic y el modelo utilizado para el enriquecimiento es:

```text
claude-haiku-4-5
```

La configuración inicial utiliza:

- una llamada por oferta;
- thinking desactivado;
- Structured Outputs;
- validación mediante Zod;
- SDK oficial de Anthropic;
- prompt almacenado en el repositorio;
- versión explícita del prompt.

No se introduce en M2:

- abstracción multi-provider;
- model router;
- caching;
- batch processing;
- sistema externo de gestión de prompts.

### Motivo

Mantener la integración simple y suficiente para el volumen previsto del MVP.

---

## M2.10 — Deduplicación de `JobOffer`

### Decisión

La deduplicación utiliza únicamente señales deterministas.

Orden de comprobación:

1. `source + sourceJobId`, cuando `sourceJobId` existe;
2. `normalizedUrl`.

No se implementan embeddings, fuzzy matching ni algoritmos complejos de similitud.

Cuando existe una oferta duplicada:

```text
JobDetection nueva
        ↓
JobOffer existente
```

La detección se conserva y se asocia a la oferta existente.

No se crea un nuevo `JobOffer`.

### Motivo

Mantener una única representación de la oferta sin perder el historial de detecciones.

### Relación con M1

M1 dejó explícitamente la deduplicación fuera de su alcance hasta disponer de `JobOffer`.

---

## M2.11 — Actualización de ofertas existentes

### Decisión

Cuando una detección corresponde a un `JobOffer` existente, la información nueva conocida puede actualizar la oferta.

Reglas:

- un valor nuevo no nulo puede actualizar el existente;
- `null` o `undefined` no borran información existente;
- el merge no intenta resolver conflictos semánticos;
- `id` nunca se modifica.

### Motivo

Una misma oferta puede aparecer en diferentes detecciones con distinta cantidad de información.

Se prioriza conservar información conocida sin introducir un sistema complejo de resolución de conflictos.

---

## M2.12 — Persistencia de la detección

### Decisión

`JobDetection` mantiene la referencia al `JobOffer` normalizado:

```text
JobDetection.jobOfferId → JobOffer.id
```

El flujo de procesamiento es:

```text
RawJobInput
 ↓
JobDetection
 ↓
Normalization
 ↓
Claude enrichment
 ↓
merge + validation
 ↓
Deduplication
 ↓
JobOffer
 ↓
JobDetection.jobOfferId
 ↓
Filtering
```

### Motivo

`JobOffer` representa la oferta normalizada y deduplicada, mientras que `JobDetection` representa una detección concreta durante un procesamiento.

---

## M2.13 — Filtrado determinista

### Decisión

El filtrado se ejecuta después de obtener el `JobOffer` y antes de cualquier matching o scoring posterior.

El filtrado es completamente determinista.

Se recopilan todos los motivos aplicables en lugar de detenerse en el primero.

Los motivos implementados son:

```text
INTERNSHIP
SCHOLARSHIP
TRAINEE
TEMPORARY_CONTRACT
IRRELEVANT_JOB_FAMILY
HARDWARE_SUPPORT
ONSITE_TOO_FAR
```

### Motivo

Las condiciones de rechazo son reglas de negocio deterministas y no deben depender de Claude.

---

## M2.14 — Tipos de empleo permitidos

### Decisión

Los siguientes tipos se permiten en el filtrado de M2:

```text
EMPLOYEE
FREELANCE
SELF_EMPLOYED
UNKNOWN
```

Los siguientes provocan rechazo:

```text
INTERNSHIP
SCHOLARSHIP
TRAINEE
```

Un contrato `TEMPORARY` provoca rechazo independientemente del tipo de empleo.

### Motivo

La preferencia del usuario permite freelance y autónomo. Por tanto, no deben tratarse como motivos de rechazo.

Esta decisión concreta y modifica la interpretación inicial de M0.11 sobre `SELF_EMPLOYED`.

---

## M2.15 — Familias y roles irrelevantes

### Decisión

Las familias:

```text
WEB
SOFTWARE
AUTOMATION
SYSTEMS
SUPPORT
UNKNOWN
```

continúan el procesamiento.

`OTHER` provoca:

```text
IRRELEVANT_JOB_FAMILY
```

y rechazo.

El rol:

```text
HARDWARE_TECHNICIAN
```

provoca:

```text
HARDWARE_SUPPORT
```

y rechazo.

### Motivo

El sistema debe excluir trabajos claramente alejados del perfil objetivo, especialmente reparación o soporte de hardware.

La información `UNKNOWN` no se interpreta como irrelevante.

---

## M2.16 — Filtrado de ubicación

### Decisión

M2 no calcula distancias mediante geocoding, routing ni APIs externas.

Para ofertas `ONSITE`, se utiliza una tabla local parcial de ciudades españolas para derivar la provincia únicamente con finalidad de filtrado.

La regla es:

```text
ONSITE
├── Castellón conocida → continuar
├── Valencia conocida  → continuar
├── otra provincia conocida → REJECT
└── ciudad desconocida → continuar
```

Las modalidades `REMOTE` y `HYBRID` no son rechazadas por esta regla.

`distanceKm` permanece en el modelo, pero M2 no lo calcula ni lo utiliza para este filtrado.

### Motivo

La implementación evita introducir una infraestructura geográfica innecesaria para el MVP.

Cuando la ciudad no puede clasificarse con suficiente seguridad, se conserva como desconocida y no se genera un rechazo automático.

### Nota

La tabla de ciudades es deliberadamente parcial y no constituye un sistema general de geografía española.

---

## M2.17 — Normalización de ciudades

### Decisión

La identificación local de ciudades normaliza:

- espacios exteriores;
- minúsculas;
- acentos y diacríticos;
- aliases conocidos.

Ejemplos:

```text
Valencia
València

Castellón
Castellon

Burriana
Borriana
```

se consideran equivalentes cuando están contemplados en la tabla local.

### Motivo

Permitir el filtrado provincial sin introducir geocoding externo.

---

## M2.18 — Persistencia del resultado del filtrado

### Decisión

El resultado del filtrado se almacena en `JobDetection`, no en `JobOffer`.

Se utilizan:

```text
filterStatus
filterReasons
```

con:

```text
filterStatus:
ACCEPTED
REJECTED
null
```

y `filterReasons` como lista JSON.

Invariantes:

```text
ACCEPTED → []
REJECTED → al menos un motivo
```

Antes de ejecutar el filtrado ambos campos pueden permanecer `null`.

### Motivo

El resultado del filtrado pertenece a una detección/procesamiento concreto, mientras que `JobOffer` representa la entidad normalizada y deduplicada.

No se crea una entidad o tabla independiente para el resultado del filtrado.

---

## M2.19 — Unknown no implica rechazo

### Decisión

Los valores desconocidos no generan automáticamente motivos de rechazo.

Esto aplica especialmente a:

```text
employmentType
jobFamily
role
city
modality
contract
workingHours
```

Una oferta solo se rechaza cuando una regla de hard filtering dispone de evidencia suficiente para aplicar un motivo concreto.

### Motivo

El proyecto establece que la información desconocida no debe convertirse automáticamente en un resultado negativo.

---

## M2.20 — Integración del filtrado en el procesador

### Decisión

El procesador ejecuta el flujo completo:

```text
Detection
 ↓
Normalization + Claude
 ↓
AIUsage
 ↓
Deduplication
 ↓
JobOffer
 ↓
JobDetection.jobOfferId
 ↓
Filtering
 ↓
JobDetection.filterStatus/filterReasons
 ↓
ProcessingRun = COMPLETED
```

Un fallo de enriquecimiento de Claude no impide completar el flujo cuando existe suficiente información para continuar.

Los errores posteriores del procesamiento siguen utilizando el mecanismo de reintentos definido en M1.

### Motivo

Integrar M2 en el procesador existente sin introducir otro sistema de ejecución.

---

## M2.21 — Testing

### Decisión

Las nuevas reglas de M2 deben probarse mediante:

- tests unitarios para reglas deterministas;
- tests de integración para persistencia y flujo del procesador;
- mocks de Claude en tests automatizados.

Se cubren especialmente:

- normalización;
- enriquecimiento correcto;
- fallback cuando Claude falla;
- deduplicación;
- actualización de ofertas;
- filtrado;
- acumulación de motivos;
- ubicación;
- persistencia de `AIUsage`;
- asociación `JobDetection → JobOffer`;
- resultado `ACCEPTED` / `REJECTED`.

### Motivo

Las decisiones de M2 deben verificarse mediante comportamiento real y no únicamente mediante tests de implementación interna.

---

## Resumen de decisiones M2

| ID | Decisión |
|---|---|
| M2.1 | Introducción de `JobOffer` como entidad normalizada y deduplicada |
| M2.2 | Clasificación mediante `JobFamily` y `JobRole` |
| M2.3 | Normalización determinista inicial |
| M2.4 | Claude como enriquecimiento semántico |
| M2.5 | Evidencia limitada y seleccionada para Claude |
| M2.6 | `UNKNOWN/null` no sustituye información conocida |
| M2.7 | Fallo de Claude no detiene el procesamiento |
| M2.8 | Registro de consumo mediante `AIUsage` |
| M2.9 | Anthropic + Claude Haiku 4.5 |
| M2.10 | Deduplicación por `source + sourceJobId` y URL normalizada |
| M2.11 | Actualización controlada de ofertas existentes |
| M2.12 | `JobDetection` referencia al `JobOffer` |
| M2.13 | Filtrado determinista antes de matching/scoring |
| M2.14 | Freelance y self-employed permitidos |
| M2.15 | Filtrado por familia/rol irrelevante y hardware |
| M2.16 | Filtrado onsite mediante provincia local, sin cálculo de distancia |
| M2.17 | Normalización local de nombres de ciudades |
| M2.18 | Resultado del filtrado persistido en `JobDetection` |
| M2.19 | Información desconocida no implica rechazo |
| M2.20 | Integración completa en el procesador interno |
| M2.21 | Cobertura de tests para las decisiones de M2 |
