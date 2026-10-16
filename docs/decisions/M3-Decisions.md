# M3 — Decisiones técnicas

## Propósito

Este documento registra las decisiones técnicas cerradas durante M3 del proyecto Job Hunter.

`M0.11_Implementation_Spec.md` continúa siendo la especificación base del proyecto. `M1-Decisions.md` y `M2-Decisions.md` registran las decisiones concretas de sus respectivos hitos. Este documento concreta el diseño de M3 y registra únicamente las ampliaciones o decisiones nuevas necesarias para implementarlo.

Cuando una decisión ya estaba definida en M0.11 y no se modifica, se indica como concreción de esa definición en lugar de repetirla como una decisión nueva.

---

## M3.1 — Modelo de `UserProfile`

### Decisión

El `UserProfile` se implementará como una entidad principal que agrupa la información necesaria para Matching.

```text
user_profiles
├── id
├── location_preferences
├── employment_preferences
└── salary_preferences

target_roles
├── id
├── user_profile_id
├── family
├── role
└── priority_order

technology_profiles
├── id
├── user_profile_id
├── name
├── level
└── context

experiences
├── id
├── user_profile_id
├── role
├── area
├── context
├── start
├── end
├── technologies
├── responsibilities
├── description
└── context_type

language_profiles
├── id
├── user_profile_id
├── language
└── level
```

M3 utilizará un único `UserProfile` para el MVP. Las relaciones quedan preparadas mediante claves foráneas, pero no se introduce autenticación ni soporte multiusuario.

`location_preferences`, `employment_preferences` y `salary_preferences` se almacenarán como `JSONB`.

### Motivo

Separar las dimensiones que Matching necesita consultar directamente sin convertir el perfil en una única estructura JSON.

### Relación con M0.11

Concreta el modelo `UserProfile` definido en M0.11. No modifica su alcance funcional.

---

## M3.2 — `TargetRole`, `TechnologyProfile` y `LanguageProfile`

### Decisión

`TargetRole` reutilizará los catálogos conceptuales de `JobFamily` y `JobRole`.

```text
TargetRole
├── family
├── role
└── priorityOrder
```

Un valor menor de `priorityOrder` representa una prioridad mayor.

`TechnologyProfile` almacenará `name`, `level` y `context`. `level` y `context` serán opcionales. M3 no define una escala cerrada para `level` ni utilizará ese nivel para determinar un MATCH tecnológico simple.

`LanguageProfile` almacenará `language` y `level`, utilizando:

```text
A1 < A2 < B1 < B2 < C1 < C2
```

Los nombres de tecnologías e idiomas se normalizarán de forma determinista.

### Motivo

Mantener el modelo sencillo y reutilizar los conceptos ya definidos para las ofertas.

### Relación con M0.11

Concreta las estructuras `TargetRole`, `TechnologyProfile` y `LanguageProfile` definidas conceptualmente en M0.11.

---

## M3.3 — Modelo de `Experience`

### Decisión

`Experience` será una entidad persistente independiente:

```text
Experience
├── id
├── userProfileId
├── role
├── area
├── context
├── start
├── end
├── technologies
├── responsibilities
├── description
└── contextType
```

`role` utilizará el mismo vocabulario conceptual que `JobRole`.

`area` será un área explícita y controlada. No se derivará automáticamente.

`start` será obligatorio. `end` será nullable; `end = null` representa una experiencia activa.

`contextType` podrá ser:

```text
professional
academic
personal
```

Las experiencias profesionales y académicas podrán aportar años de experiencia relevante. Las personales se conservarán como información y evidencia, pero no aportarán años.

Las tecnologías asociadas a una experiencia se consideran presentes durante todo su intervalo.

No se realizará doble conteo de períodos solapados.

### Motivo

Permite calcular experiencia relevante según tecnología, rol o área sin reducir el perfil a un único número de años.

### Relación con M0.11

Concreta el modelo de experiencia y la regla de valorar la experiencia según tarea, tecnología y contexto.

`area` es una ampliación necesaria porque M0.11 permite requisitos cuyo target sea un área, pero el modelo conceptual original de experiencia no definía un campo explícito para almacenarla.

---

## M3.4 — Validación temporal de experiencia

### Decisión

Una experiencia con `end < start` será inválida y producirá un error de validación.

No se corregirán automáticamente fechas inválidas.

Para experiencias activas, el cálculo utilizará la fecha de referencia del análisis.

La duración se calculará mediante intervalos de calendario y unión de períodos, no mediante una aproximación fija de días/365.

### Motivo

Evita errores silenciosos en una dimensión que afecta directamente a Matching.

### Relación con M0.11

Es una concreción técnica necesaria para implementar de forma determinista la experiencia acumulada.

---

## M3.5 — Modelo de `Requirement`

### Decisión

`Requirement` será una entidad propia y pertenecerá a `JobOffer`:

```text
JobOffer 1:N Requirement
```

```text
requirements
├── id
├── job_offer_id
├── category
├── type
├── importance
├── data
└── active
```

`data` será `JSONB NOT NULL`.

Las categorías matcheables serán:

```text
technology
experience
language
```

Los tipos serán:

```text
single
alternative
group
```

La importancia será:

```text
required
preferred
```

El esquema semántico de `data` será validado con Zod.

### Motivo

Una entidad independiente permite reutilizar requisitos entre análisis y conservar referencias históricas desde `RequirementMatch`.

### Relación con M0.11

Concreta el modelo `Requirement` de M0.11.

M0.11 contemplaba también `other`. M3 elimina `other` como categoría matcheable y no introduce un mecanismo genérico para requisitos fuera de tecnología, experiencia e idioma.

---

## M3.6 — Estructura semántica de `Requirement.data`

### Decisión

Los requisitos se representarán mediante estructuras tipadas según categoría y tipo.

Tecnología:

```text
single:
{ technology }

alternative:
{ options: TechnologyItem[] }

group:
{ components: TechnologyItem[] }
```

Experiencia:

```text
single:
{
  target: {
    type: technology | role | area
    value
  }
  minimumYears
}

alternative:
{ options: ExperienceItem[] }

group:
{ components: ExperienceItem[] }
```

Idioma:

```text
single:
{
  language
  minimumLevel
}

alternative:
{ options: LanguageItem[] }

group:
{ components: LanguageItem[] }
```

`alternative` y `group` requieren como mínimo dos elementos.

Los schemas de dominio no incluirán `id`, `jobOfferId` ni campos de persistencia.

### Motivo

Separar el modelo de dominio del modelo físico permite validar la semántica antes de persistirla.

### Relación con M0.11

Concreta la representación estructurada que M0.11 exige para `Requirement.data`.

---

## M3.7 — Inmutabilidad e histórico de `Requirement`

### Decisión

Un `Requirement` utilizado por un análisis no se modificará.

Si una nueva extracción produce el mismo conjunto normalizado que los Requirements activos:

```text
→ reutilizar Requirements activos
```

Si cambia:

```text
Requirements anteriores → active = false
Requirements nuevos      → active = true
```

No se añadirá un campo `version` a `Requirement`.

### Motivo

Mantener histórico sin duplicar requisitos idénticos y sin modificar referencias utilizadas por análisis anteriores.

### Relación con M0.11

Es una concreción necesaria para compatibilizar requisitos actuales con análisis históricos.

---

## M3.8 — `RequirementMatch` y `Evidence`

### Decisión

```text
requirement_matches
├── id
├── job_analysis_id
├── requirement_id
├── result
└── evidence
```

Existirá una restricción de unicidad sobre `(job_analysis_id, requirement_id)`.

`result` será:

```text
MATCH
PARTIAL
MISSING
UNKNOWN
N/A
```

`evidence` será `JSONB NOT NULL` y se validará con Zod.

No se crearán tablas independientes para `AlternativeMatch`, `GroupMatch` o `Evidence`.

En alternativas y grupos, `evidence` conservará todos los elementos evaluados mediante índices de opción o componente.

### Motivo

Mantiene el modelo físico sencillo y conserva información suficiente para reproducibilidad.

### Relación con M0.11

Concreta `RequirementMatch` y `Evidence` definidos en M0.11.

---

## M3.9 — Información suficiente y `UNKNOWN`

### Decisión

Regla transversal:

```text
información suficiente + ausencia
→ MISSING

información insuficiente
→ UNKNOWN
```

No se introducirá una métrica general de completitud del perfil.

Para tecnología, existe información suficiente si el perfil dispone de tecnologías declaradas mediante `TechnologyProfile` o `Experience.technologies`.

Para idiomas, si existen `LanguageProfile`, la ausencia del idioma requerido será `MISSING`. Si no existe información de idiomas, será `UNKNOWN`.

Para experiencia, si no existe información suficiente para evaluar el target, será `UNKNOWN`.

### Motivo

Evita convertir ausencia de información en una penalización falsa.

### Relación con M0.11

Concreta la semántica de `UNKNOWN` definida para Matching.

---

## M3.10 — Matching tecnológico

### Decisión

Para un requisito tecnológico simple:

```text
tecnología presente
→ MATCH

información suficiente + tecnología ausente
→ MISSING

información insuficiente
→ UNKNOWN
```

Una tecnología se considera presente si aparece en `UserProfile.technologies` o en `Experience.technologies`.

`TechnologyProfile.level` no modifica el resultado de un requisito tecnológico simple.

Las tecnologías se compararán después de su normalización determinista.

Ejemplos:

```text
JS / JavaScript → javascript
Node / Node.js  → nodejs
```

No se tratarán como equivalentes conceptos diferentes como:

```text
Java ≠ JavaScript
React ≠ React Native
```

### Motivo

Mantener Matching tecnológico determinista y comprensible.

### Relación con M0.11

Concreta el Matching de tecnologías previsto en M0.11.

---

## M3.11 — Matching de experiencia

### Decisión

Los requisitos de experiencia podrán apuntar a:

```text
technology
role
area
```

La relevancia será explícita:

```text
technology → Experience.technologies
role       → Experience.role
area       → Experience.area
```

No se aplicarán jerarquías implícitas entre roles.

Solo `professional` y `academic` aportarán años.

Los períodos solapados se unirán antes de calcular la duración acumulada.

```text
accumulatedYears >= minimumYears
→ MATCH

accumulatedYears < minimumYears
→ MISSING

información insuficiente
→ UNKNOWN
```

Un requisito de experiencia simple no generará `PARTIAL`.

### Motivo

Evita considerar toda la experiencia profesional como equivalente a experiencia específica.

### Relación con M0.11

Concreta la regla de valorar experiencia por tecnología, tarea, rol y contexto.

---

## M3.12 — Matching de idiomas

### Decisión

```text
A1 < A2 < B1 < B2 < C1 < C2
```

Para un requisito:

```text
profileLevel >= requiredLevel → MATCH
profileLevel < requiredLevel  → MISSING
idioma presente sin nivel      → UNKNOWN
sin información de idiomas     → UNKNOWN
idioma ausente con información → MISSING
```

Los requisitos de idioma simples no generarán `PARTIAL`.

### Motivo

CEFR proporciona una escala ordinal explícita y permite comparación determinista.

### Relación con M0.11

Concreta el Matching de idiomas y los niveles mínimos definidos en el modelo conceptual.

---

## M3.13 — Requisitos `alternative` y `group`

### Decisión

`alternative` representa:

```text
A OR B OR C
```

```text
alguna MATCH
→ MATCH

todas MISSING
→ MISSING

ninguna MATCH + alguna UNKNOWN
→ UNKNOWN
```

Nunca produce `PARTIAL`.

`group` representa:

```text
A AND B AND C
```

```text
todas MATCH
→ MATCH

MISSING + MATCH + ningún UNKNOWN
→ PARTIAL

MISSING + UNKNOWN
→ MISSING

ningún MISSING + algún UNKNOWN
→ UNKNOWN

todas MISSING
→ MISSING
```

Todos los componentes evaluados permanecen en la evidencia.

### Motivo

Conservar la semántica AND/OR sin perder información sobre las opciones o componentes evaluados.

### Relación con M0.11

Concreta `AlternativeMatch` y `GroupMatch` sin crear tablas adicionales.

---

## M3.14 — `MatchingSummary`

### Decisión

El resumen de Matching se almacenará dentro de `JobAnalysis` como `JSONB`.

```text
required
├── total
├── evaluated
├── match
├── partial
├── missing
├── unknown
├── notApplicable
├── compliance
└── hasMissing

preferred
├── total
├── evaluated
├── match
├── partial
├── missing
├── unknown
├── notApplicable
└── compliance
```

```text
evaluated = match + partial + missing
```

```text
compliance =
(match * 1.0 + partial * 0.7 + missing * 0.0)
/
evaluated
```

Si `evaluated = 0`, `compliance = null`.

`UNKNOWN` y `N/A` no entran en el denominador.

`required.hasMissing` será `true` si existe algún `MISSING` requerido.

El resumen se construirá exclusivamente a partir de `RequirementMatch`.

### Motivo

Mantener el resumen como resultado derivado y evitar duplicar reglas de Matching.

### Relación con M0.11

Concreta la semántica `MATCH = 1.0`, `PARTIAL = 0.7`, `MISSING = 0.0` y la exclusión de `UNKNOWN`/`N/A`.

---

## M3.15 — Separación entre Matching y Scoring

### Decisión

Matching responde exclusivamente:

```text
¿En qué medida cumple el perfil los requisitos de la oferta?
```

No evaluará salario, ubicación, modalidad, condiciones laborales, prioridad, atractivo, ranking ni recomendación.

Scoring podrá utilizar Matching como entrada, pero Matching no dependerá de Scoring.

### Motivo

Mantener separadas las responsabilidades de cumplimiento y valoración global.

### Relación con M0.11

Respeta el flujo:

```text
Filtering
→ Matching
→ Scoring
```

definido en M0.11.

---

## M3.16 — Modelo de `JobAnalysis`

### Decisión

```text
job_analyses
├── id
├── job_offer_id
├── processing_run_id
├── version
├── matching_summary
├── requirement_extraction_status
└── created_at
```

`requirement_extraction_status` será:

```text
PENDING
COMPLETED
FAILED
```

Un `JobAnalysis` se crea cuando una oferta aceptada alcanza la fase de análisis, antes de la extracción.

`COMPLETED + []` significa extracción correcta sin requisitos.

`FAILED + []` significa que no se obtuvo información fiable.

No se añadirá un `analysis_status` general porque `ProcessingRun` ya representa el estado operativo global.

### Motivo

Distinguir correctamente una oferta sin requisitos extraíbles de una extracción fallida y conservar el histórico.

### Relación con M0.11

Concreta `JobAnalysis` y la conservación de análisis históricos definida en M0.11.

---

## M3.17 — Extracción de Requirements mediante Claude

### Decisión

Claude se utilizará únicamente para extraer Requirements de una oferta aceptada.

```text
JobOffer
  ↓
Requirement Extraction
  ↓
RequirementExtractionResult
```

Claude no podrá comparar contra `UserProfile`, generar `RequirementMatch`, calcular `MatchingSummary`, puntuar, recomendar, modificar `JobOffer` ni deduplicar Requirements.

El resultado será:

```text
RequirementExtractionResult
└── requirements: Requirement[]
```

La lista puede estar vacía.

Solo se creará un requisito cuando exista evidencia suficientemente concreta.

Ejemplos:

```text
"advanced English"
→ no crear automáticamente un requisito CEFR

"English B2"
→ crear language requirement B2

"modern technologies"
→ no crear technology requirement

"experience working with APIs"
→ no convertir automáticamente "APIs" en una tecnología
```

La importancia será `required` o `preferred`.

### Motivo

Claude interpreta texto no estructurado; las decisiones posteriores permanecen en código determinista.

### Relación con M0.11

Concreta el papel auxiliar de Claude definido en M0.11 y mantiene las decisiones de Matching en la aplicación.

---

## M3.18 — Composición durante la extracción

### Decisión

Claude podrá detectar `single`, `alternative` y `group` solo cuando exista evidencia suficiente.

Una alternativa requiere al menos dos opciones.

Un grupo requiere al menos dos componentes.

No se asumirá que varios elementos listados juntos forman necesariamente un grupo o una alternativa.

Si varios elementos son requisitos independientes y pueden identificarse individualmente, se representarán como `single`.

Si la relación AND/OR no puede determinarse con suficiente evidencia, no se inventará una composición.

### Motivo

Evitar introducir semántica que la oferta no expresa claramente.

---

## M3.19 — Normalización y deduplicación de Requirements

### Decisión

La salida de Claude seguirá:

```text
Claude
→ Zod
→ normalización determinista
→ deduplicación determinista
→ persistencia
```

La normalización incluirá tecnologías, idiomas, roles y áreas.

La identidad lógica será:

```text
category
+ type
+ importance
+ normalized data
```

`required` y `preferred` no son duplicados aunque compartan contenido.

Tampoco se resolverán automáticamente conflictos como:

```text
JavaScript >= 2 años
JavaScript >= 3 años
```

si no son idénticos según la identidad lógica.

Las opciones/componentes se normalizarán de forma canónica para comparar alternativas y grupos sin alterar su semántica.

### Motivo

Mantener la deduplicación determinista y evitar que una capa heurística modifique silenciosamente los requisitos.

---

## M3.20 — Requisitos activos y análisis históricos

### Decisión

Solo `active = true` participa en análisis nuevos.

Un `RequirementMatch` referencia siempre el `Requirement` exacto utilizado por su análisis.

Si una nueva detección resulta `REJECTED`:

```text
→ se conserva la detección
→ no se crea un nuevo JobAnalysis
→ los análisis anteriores permanecen intactos
```

Si resulta `ACCEPTED`:

```text
→ se crea un nuevo JobAnalysis
```

Los análisis completados son históricos e inmutables.

### Motivo

Preservar trazabilidad completa entre oferta, requisitos utilizados y resultados de Matching.

### Relación con M0.11

Concreta la conservación de análisis anteriores y el reprocesamiento mediante nuevos análisis.

---

## M3.21 — Integración con `ProcessingRun`

### Decisión

```text
RawJobInput
    ↓
Normalization + Claude
    ↓
JobOffer
    ↓
Filtering
    ↓
REJECTED ─────────────→ ProcessingRun COMPLETED

ACCEPTED
    ↓
JobAnalysis PENDING
    ↓
Requirement Extraction
    ↓
Requirements
    ↓
Matching
    ↓
RequirementMatches
    ↓
MatchingSummary
    ↓
JobAnalysis COMPLETED
    ↓
ProcessingRun COMPLETED
```

Las ofertas rechazadas no generan extracción ni Matching.

Un fallo de extracción de Claude produce:

```text
JobAnalysis → FAILED
```

sin Requirements inventados y sin ejecutar Matching.

Un fallo determinista de Matching, persistencia o código provoca el error del procesamiento y permite el mecanismo de retry/fail de `ProcessingRun`.

No se transforma un error interno en `UNKNOWN`.

### Motivo

Mantener fases claramente separadas y utilizar `ProcessingRun` como estado operativo general.

### Relación con M0.11

Concreta el flujo `Filtering → Matching → Scoring` y utiliza la estrategia de `ProcessingRun` definida previamente.

---

## M3.22 — `AIUsage` para Requirement Extraction

### Decisión

Se reutilizará `ai_usage`.

Se añadirán:

```text
purpose
prompt_version
```

`purpose` será:

```text
ENRICHMENT
REQUIREMENT_EXTRACTION
```

La relación seguirá siendo:

```text
JobDetection 1:N AIUsage
```

Para Requirement Extraction se utilizará inicialmente:

```text
provider = anthropic
model = claude-haiku-4-5
purpose = REQUIREMENT_EXTRACTION
promptVersion = 1.0.0
```

No se creará una nueva tabla.

### Motivo

Una detección puede consumir IA en distintas fases. Registrar el propósito permite atribuir tokens y costes sin duplicar el modelo de persistencia.

### Relación con M0.11

Concreta el `AIUsage` definido en M0.11 y amplía el modelo implementado durante M2.

---

## M3.23 — Versión de `JobAnalysis`

### Decisión

`JobAnalysis.version` será un entero que representa la versión de las reglas deterministas del análisis.

La primera implementación utilizará:

```text
version = 1
```

Aumentará cuando cambien de forma relevante las reglas del análisis, por ejemplo:

- reglas de Matching;
- cálculo de experiencia;
- composición;
- interpretación de resultados.

No aumentará por:

- nuevo `ProcessingRun`;
- nuevo análisis de la misma oferta;
- cambios de tests;
- cambios de infraestructura;
- cambios exclusivos del prompt de Claude.

La versión del prompt se registra independientemente mediante `AIUsage.promptVersion`.

### Motivo

Permite interpretar históricamente un análisis sin confundir versión de reglas con número de procesamientos.

### Relación con M0.11

M0.11 ya contempla `version` dentro de `JobAnalysis`. M3 concreta ahora su semántica.

---

## M3.24 — Persistencia transaccional del análisis

### Decisión

La extracción, normalización y Matching se ejecutarán fuera de una transacción de base de datos.

Una vez calculados completamente:

```text
Requirement[]
RequirementMatch[]
MatchingSummary
```

se realizará una única transacción corta para persistir el resultado.

Dentro de la transacción:

```text
Requirements
RequirementMatches
MatchingSummary
JobAnalysis → COMPLETED
```

Flujo:

```text
JobAnalysis = PENDING
        ↓
Requirement Extraction
        ↓
Validation
        ↓
Normalization
        ↓
Deduplication
        ↓
Matching
        ↓
Build Matches
        ↓
Build Summary
        ↓
BEGIN
        ↓
Persist final result
        ↓
COMMIT
```

Claude no se ejecutará dentro de la transacción.

Si la transacción falla:

```text
ROLLBACK
```

No se acepta un análisis parcialmente persistido.

### Motivo

Equilibra consistencia y simplicidad: protege la escritura final sin mantener una transacción abierta durante llamadas externas o procesamiento.

---

## M3.25 — Invariantes principales

### Decisión

`JobAnalysis`:

```text
- pertenece a un JobOffer;
- pertenece a un ProcessingRun;
- un análisis completado es inmutable;
- un nuevo procesamiento aceptado crea un nuevo análisis;
- una detección REJECTED no crea un análisis nuevo.
```

`Requirement`:

```text
- pertenece a un JobOffer;
- solo active=true participa en nuevos análisis;
- un Requirement utilizado por un análisis no se modifica;
- los cambios generan Requirements nuevos;
- no existen categorías matcheables fuera de technology, experience y language.
```

`RequirementMatch`:

```text
- pertenece a un JobAnalysis;
- referencia un Requirement concreto;
- es único por (jobAnalysisId, requirementId);
- siempre tiene evidence;
- utiliza únicamente resultados definidos.
```

`MatchingSummary`:

```text
- deriva de RequirementMatch;
- UNKNOWN y N/A no penalizan el denominador;
- compliance = null si no hay resultados evaluables;
- required.hasMissing refleja la existencia de MISSING required.
```

### Motivo

Estos invariantes permiten detectar errores de implementación y proporcionan una base directa para las pruebas.

---

## M3.26 — Testing de Matching

### Decisión

M3 mantendrá pruebas unitarias para las reglas deterministas y pruebas de integración con PostgreSQL real para persistencia.

Se cubrirán como mínimo:

- schema de `Requirement`;
- `single`, `alternative` y `group`;
- categorías no soportadas;
- normalización de tecnologías;
- normalización de idiomas;
- tecnología MATCH/MISSING/UNKNOWN;
- experiencia por tecnología;
- experiencia por rol;
- experiencia por área;
- contextos professional/academic/personal;
- intervalos solapados;
- experiencias activas;
- fechas inválidas;
- idiomas y CEFR;
- alternativas;
- grupos;
- `PARTIAL`;
- `UNKNOWN`;
- `N/A`;
- `MatchingSummary`;
- ausencia de requisitos;
- extracción Claude correcta;
- extracción Claude fallida;
- deduplicación de Requirements;
- reutilización de Requirements activos;
- desactivación y creación de Requirements cuando cambian;
- histórico de `JobAnalysis`;
- reprocesamiento de ofertas aceptadas;
- detecciones REJECTED sin nuevo análisis;
- persistencia transaccional;
- errores y reintentos de `ProcessingRun`;
- `AIUsage` de Requirement Extraction.

Claude se mockeará en las pruebas automatizadas.

### Motivo

Concreta la estrategia de testing de M0.11 para las reglas específicas de Matching.

---

# M3 STATUS

**M3 — Matching: DISEÑO COMPLETO**

Todas las decisiones de arquitectura y comportamiento necesarias para implementar M3 quedan cerradas.

La implementación podrá comenzar a partir de este documento sin introducir decisiones funcionales adicionales salvo que aparezca durante la implementación un problema real que obligue a modificar una decisión cerrada.

Cualquier cambio de una decisión de M3 deberá documentarse explícitamente antes de modificar el código.
