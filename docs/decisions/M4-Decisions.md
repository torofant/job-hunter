# M4 — Decisiones técnicas

## Propósito

Este documento registra las decisiones técnicas cerradas para M4 del proyecto Job Hunter.

`M0.11_Implementation_Spec.md` continúa siendo la especificación base del proyecto. `M1-Decisions.md`, `M2-Decisions.md` y `M3-Decisions.md` registran las decisiones concretas de sus respectivos hitos. Este documento concreta el diseño de M4 y registra únicamente las ampliaciones o decisiones nuevas necesarias para implementarlo.

Cuando una decisión ya estaba definida en M0.11 y no se modifica, se indica como concreción de esa definición en lugar de repetirla como una decisión nueva.

M4 se implementará en cuatro subfases:

1. **M4.1 — Requirements `OTHER`**
2. **M4.2 — Scoring**
3. **M4.3 — Coverage y Confidence**
4. **M4.4 — Persistencia y priorización**

Cada subfase deberá probarse y validarse antes de avanzar a la siguiente. Las decisiones de este documento no autorizan cambios silenciosos en decisiones cerradas de M1, M2 o M3.

---

## M4.1 — Categoría de Requirement `OTHER`

### Decisión

Se ampliará el enum de categorías de `Requirement` para admitir `OTHER`, además de las categorías existentes:

```text
TECHNOLOGY
EXPERIENCE
LANGUAGE
OTHER
```

`OTHER` se evaluará mediante lógica determinista. Cuando no exista evidencia estructurada suficiente en `UserProfile` para determinar si se cumple un requisito `OTHER`, el resultado será `UNKNOWN`, no `MISSING`.

No se añadirá un campo genérico `otherRequirements` a `UserProfile`.

La ausencia de evidencia suficiente no se interpretará como prueba de incumplimiento. Tampoco se añadirá una comparación semántica nueva delegada a Claude.

### Motivo

M0.11 reserva un 5 % del Scoring para otros requisitos. Excluir `OTHER` dejaría incompleto el alcance definido para el scoring. Sin embargo, la ausencia de un campo de perfil que represente un requisito genérico no demuestra que la persona no lo cumpla. Añadir ese campo ampliaría el modelo de `UserProfile` sin una decisión aprobada.

### Relación con M0.11

M0.11 contempla la categoría `other`. M3 la dejó fuera de las categorías matcheables durante su alcance inicial. M4 revierte esa limitación de forma explícita para completar el alcance de Scoring de M0.11, conservando la semántica transversal de `UNKNOWN` definida en M3.9.

---

## M4.2 — Scoring determinista

### Decisión

Scoring será una responsabilidad determinista separada de Matching.

Matching podrá utilizarse como entrada de Scoring, pero Matching no dependerá del score ni incorporará evaluaciones de salario, ubicación, modalidad, condiciones laborales, prioridad, atractivo o recomendación.

Se aplicarán los pesos y criterios de M0.11:

| Categoría | Peso |
|---|---:|
| Familia y rol | 20 % |
| Tecnologías | 25 % |
| Experiencia | 20 % |
| Ubicación y modalidad | 15 % |
| Condiciones laborales | 10 % |
| Idiomas | 5 % |
| Otros requisitos | 5 % |
| **Total** | **100 %** |

Desglose:

- Familia y rol: familia 8 %, rol 12 %.
- Tecnologías: requeridas 17,5 %, preferidas 7,5 %.
- Experiencia: general 10 %, específica 10 %.
- Ubicación y modalidad: modalidad 10 %, localidad 5 %.
- Condiciones laborales: salario 5 %, contrato 3 %, jornada 2 %.
- Seniority no se puntúa.

Las bandas serán:

| Score | Clasificación |
|---:|---|
| 80–100 | `HIGH MATCH` |
| 65–79 | `GOOD MATCH` |
| 50–64 | `POSSIBLE MATCH` |
| 0–49 | `LOW MATCH` |

No existe una categoría de rechazo basada en el score. El rechazo corresponde únicamente a los hard filters definidos en la especificación y en las decisiones previas.

#### Salario

Se aplicarán las preferencias de referencia de M0.11: mínimo 20.000 EUR y deseado 24.000 EUR.

- Por debajo de 20.000 EUR: `MISSING`.
- De 20.000 a 23.999 EUR: `PARTIAL`.
- 24.000 EUR o más: `MATCH`.
- Salario desconocido: `UNKNOWN` y excluido del denominador correspondiente.

No se normalizará el salario por FTE para ofertas a tiempo parcial.

#### Ubicación y modalidad

La categoría tiene un máximo de 15 puntos.

- Modalidad: remoto 10; híbrido 8; presencial 5; desconocida `UNKNOWN`.
- Localidad: remoto dentro de España 5; Castellón 5; híbrido en Valencia 4; hasta 25 km 4; 26–50 km 3; 51–75 km 2; más de 75 km: rechazo por hard filter.

Ejemplos definidos en M0.11:

| Caso | Puntos |
|---|---:|
| Remoto dentro de España | 15/15 |
| Híbrido en Castellón | 13/15 |
| Híbrido en Valencia | 12/15 |
| Presencial en Castellón | 10/15 |
| Presencial a 20 km | 9/15 |
| Presencial a 40 km | 8/15 |
| Presencial a 70 km | 7/15 |

Una ubicación desconocida no se convertirá artificialmente en cero.

#### Condiciones laborales

- Tiempo completo: `MATCH`.
- Tiempo parcial: `PARTIAL`.
- Desconocido: `UNKNOWN`.
- Temporal, prácticas, beca, trainee y autónomo por cuenta propia: rechazo conforme a M0.11.
- Freelance: permitido.

Los filtros ya implementados que difieran de M0.11 no se modificarán silenciosamente como parte de M4. La discrepancia deberá identificarse y resolverse explícitamente antes de alterar el comportamiento de un filtro cerrado en M1/M2.

#### Valores desconocidos y denominador

Se respetarán las reglas de M0.11 para `UNKNOWN` y `N/A`.

**Aclaración de implementación aprobada para M4:** el score global se calculará renormalizando los pesos de las subcategorías evaluables.

- `MATCH` aporta el 100 % del peso evaluable.
- `PARTIAL` aporta el 70 % del peso evaluable.
- `MISSING` aporta el 0 % del peso evaluable.
- `UNKNOWN` y `N/A` se excluyen tanto de la contribución al numerador como del denominador.
- Los pesos de las subcategorías evaluables se renormalizan proporcionalmente para obtener un score de 0 a 100.
- Si no existe ninguna subcategoría evaluable, el score será `null` y la categoría de scoring también será `null`.
- La renormalización no modifica los pesos relativos definidos para las subcategorías ni utiliza Coverage como multiplicador o factor de penalización.

Esta aclaración concreta el tratamiento matemático del score global cuando falta información. No modifica las categorías, los pesos originales, las bandas de clasificación, los hard filters ni las reglas de Matching definidas en M0.11 y en las decisiones previas.

### Motivo

La puntuación debe ser reproducible, comprobable mediante tests y coherente con los criterios funcionales ya aprobados. Separarla de Matching evita mezclar cumplimiento de requisitos con adecuación global. Mantener los pesos y las bandas de M0.11 evita introducir un cambio funcional no aprobado.

### Relación con M0.11

M0.11 ya define las categorías, ponderaciones, bandas, tratamiento del salario, ubicación, modalidad y condiciones laborales. M4 concreta su implementación determinista; no redefine esos criterios. La separación entre Matching y Scoring se conserva conforme a M3.15.

---

### Reglas operativas de Scoring aprobadas

#### Familia y rol independientes

Familia y rol se evaluarán como criterios independientes, conservando los pesos definidos en M0.11: 8 puntos para familia y 12 para rol. Una coincidencia de familia no implica una coincidencia de rol. Cada criterio se evaluará mediante reglas deterministas sobre los datos normalizados de la oferta y `UserProfile.targetRoles`. La información insuficiente producirá `UNKNOWN`, no `MISSING`.

#### Clasificación y evaluación de experiencia

Los requisitos de experiencia se clasificarán mediante reglas deterministas en:

- **General:** experiencia amplia relacionada con un rol, área profesional o tipo de actividad.
- **Específica:** experiencia que exige una tecnología, plataforma, función o dominio concreto identificable en el requisito.

Se conservarán los pesos de M0.11: 10 puntos para experiencia general y 10 para específica. La evaluación utilizará la información disponible en `UserProfile.experiences`, incluidos rol, área, contexto, tecnologías, responsabilidades y descripción cuando sean pertinentes.

Cuando no exista evidencia suficiente para evaluar el cumplimiento o no pueda determinarse con seguridad la clasificación del requisito, se utilizará `UNKNOWN`. No se inferirá experiencia práctica por la mera presencia de una tecnología en el perfil.

#### Agregación de requisitos

Dentro de cada subcategoría, los requisitos evaluables tendrán el mismo peso relativo y se agregará su resultado mediante una media simple.

Se aplicarán las conversiones ya aprobadas en M4.2: `MATCH` = 1, `PARTIAL` = 0,7 y `MISSING` = 0. Los resultados `UNKNOWN` y `N/A` se excluirán tanto del numerador como del denominador.

La media se calculará solo con los requisitos evaluables. Si no hay ninguno, la subcategoría será no evaluable (`null`). En tecnologías se conservarán separadamente los pesos de M0.11 para requisitos obligatorios (17,5 puntos) y preferidos (7,5 puntos); la media simple se aplicará dentro de cada grupo. En experiencia, idiomas y otros requisitos no se introducirán ponderaciones adicionales por `required` o `preferred`.

#### Prioridad de los roles objetivo

`UserProfile.targetRoles.priorityOrder` no influirá en el score ni se utilizará como criterio adicional de priorización de ofertas. Se conservará íntegramente la regla de priorización dinámica definida en M4.4.3, sin introducir nuevos factores de ordenación.

#### Desglose original y score global

Los componentes del desglose conservarán sus contribuciones sobre los pesos originales de M0.11. El score global se calculará mediante la renormalización de los pesos de las subcategorías evaluables, conforme a las reglas ya aprobadas en M4.2.

En consecuencia, la suma de las contribuciones del desglose original puede diferir del score global renormalizado. Las subcategorías no evaluables se representarán como `null`, no como cero. Si no hay ninguna subcategoría evaluable, tanto el score como su categoría serán `null`.

Esta renormalización no altera los pesos relativos originales, no utiliza Coverage como multiplicador y no introduce rechazo basado en el score.

#### Limitación de disponibilidad del salario

El esquema de `JobOffer` revisado durante el diseño de M4.2 no contiene un campo salarial. Por tanto, la contribución salarial de 5 puntos no podrá calcularse a partir de dicho esquema hasta que se determine y documente la fuente del salario y su disponibilidad en el flujo de análisis.

Hasta resolverlo, no se inventarán valores ni se interpretará un salario ausente como incumplimiento. Cuando el salario sea realmente desconocido, se aplicará la regla ya aprobada: `UNKNOWN`, excluido del denominador correspondiente. Los umbrales salariales definidos en M0.11 se mantienen sin cambios.

#### Conservación de decisiones anteriores

Estas reglas concretan el cálculo de Scoring y no autorizan cambios en los filtros cerrados de M1/M2, en las reglas de Matching, en los pesos o bandas de M0.11 ni en las responsabilidades asignadas a Claude. Cualquier discrepancia que requiera modificar una decisión anterior deberá resolverse y documentarse explícitamente antes de cambiar el comportamiento existente.

## M4.3 — Coverage y Confidence

### M4.3.1 — Coverage

#### Decisión

Coverage medirá la disponibilidad de información utilizable para evaluar una oferta. No medirá la adecuación de la oferta y no se utilizará como multiplicador ni factor de penalización del score.

Los valores serán:

```text
FULL    = 100
LIMITED = 50
UNKNOWN = 0
N/A     = excluido del cálculo
```

Se conservarán las ponderaciones internas definidas en M0.11:

- Familia/rol: 40/60.
- Tecnología/experiencia/idiomas/otros: 70/30.

La implementación deberá mantener la interpretación y el desglose de la especificación fuente.

#### Motivo

Coverage y Scoring responden preguntas distintas: Coverage indica cuánta información está disponible; Scoring indica la adecuación estimada. Usar Coverage para multiplicar el score mezclaría ambos conceptos y cambiaría la regla de puntuación.

#### Relación con M0.11

Concreta los valores y ponderaciones de Coverage definidos en M0.11 sin convertirlo en un factor de Scoring.

### M4.3.2 — Confidence

#### Decisión

Confidence representará la fiabilidad del análisis, no la adecuación de la oferta. Tendrá tres niveles:

```text
HIGH
MEDIUM
LOW
```

Se calculará mediante reglas deterministas. Claude no seleccionará el nivel.

Criterios acordados:

- **HIGH:** extracción y procesamiento satisfactorios; datos suficientes y coherentes en las categorías relevantes; ausencia de contradicciones importantes.
- **MEDIUM:** análisis válido, pero existe información relevante incompleta o algunos resultados importantes dependen de datos parciales o de fallback.
- **LOW:** la información es insuficiente para una evaluación fiable o se produce una degradación significativa por fallos de enriquecimiento.

La ausencia de un único campo no obligará automáticamente a usar `LOW`. Por ejemplo, un salario desconocido afecta al tratamiento de ese dato y a la cobertura de la información salarial, pero no necesariamente a la confianza global del análisis.

Coverage y Confidence se calcularán como métricas independientes.

Los criterios anteriores deberán traducirse en condiciones deterministas explícitas y pruebas; no se implementarán como una decisión subjetiva del modelo.

#### Reglas operativas iniciales

La primera implementación utilizará reglas conservadoras basadas en señales
explícitas del procesamiento. No se asignará `HIGH` cuando no existan señales
suficientes para verificar sus condiciones.

Se aplicarán las siguientes reglas:

- **HIGH:** el procesamiento y la extracción han terminado satisfactoriamente,
  el enriquecimiento se ha completado y existen señales verificables que
  respaldan la suficiencia y fiabilidad de la información disponible.
- **MEDIUM:** el análisis es válido, pero existen señales de información
  relevante incompleta o de dependencia de datos parciales o de fallback,
  sin evidencia suficiente para clasificar el análisis como `LOW`.
- **LOW:** existen señales deterministas de que la información disponible es
  insuficiente para una evaluación fiable o de que la degradación del
  procesamiento afecta significativamente a dicha evaluación.
- **Extracción fallida:** no se asignará una confianza final como si el análisis
  estuviera completado. Se conservará el tratamiento de error existente.
- La ausencia de un único campo no determinará automáticamente `LOW`.
  `Coverage` y `Confidence` se calcularán de forma independiente.

#### Señales disponibles y limitaciones

La implementación inicial podrá utilizar el resultado del enriquecimiento
(`COMPLETED` o `FALLBACK`), el estado de extracción, la descripción original
y los campos normalizados disponibles.

Estas señales no demuestran por sí solas que los datos sean semánticamente
suficientes, coherentes o libres de contradicciones importantes. En esta
primera versión no se afirmará que esas propiedades se han verificado si no
existe una comprobación determinista que las respalde.

No se utilizará únicamente el número de requisitos extraídos ni la ausencia
aislada de un campo como medida de fiabilidad global. Las condiciones
operativas deberán probarse con casos representativos y podrán precisarse
documentalmente si la implementación revela limitaciones o ambigüedades.


#### Motivo

La confianza debe ser reproducible y auditable. No es equivalente a Coverage: una oferta puede tener campos ausentes sin que todo el análisis sea poco fiable, y disponer de muchos datos tampoco garantiza por sí solo que el procesamiento haya sido correcto.

#### Relación con M0.11

Concreta los niveles de Confidence previstos en M0.11 y fija criterios operativos para su implementación. M0.11 no delega a Claude la decisión de confianza.

---

## M4.4 — Persistencia y priorización

### M4.4.1 — Persistencia de resultados en `JobAnalysis`

#### Decisión

Se ampliará `JobAnalysis` para persistir los resultados de M4:

```text
job_analyses
├── id
├── job_offer_id
├── processing_run_id
├── version
├── matching_summary
├── score
├── coverage
├── confidence
├── requirement_extraction_status
└── created_at
```

Se conservarán `matchingSummary` y los resultados de Matching definidos en M3.

Los resultados de M4 pertenecerán al `JobAnalysis` concreto que los produjo. Los análisis completados seguirán siendo históricos e inmutables. La persistencia final mantendrá el enfoque transaccional establecido en M3.24.

Se definirán los tipos, schemas y migraciones de base de datos siguiendo las convenciones existentes del repositorio. Se añadirán pruebas de creación, lectura, integridad y preservación del histórico.

No se añadirá una entidad o tabla para la priorización.

#### Motivo

Persistir los resultados junto al análisis permite consultarlos posteriormente y mantiene la trazabilidad entre la oferta, las reglas utilizadas y sus resultados. Conservar la inmutabilidad evita que un nuevo procesamiento reescriba resultados históricos.

#### Relación con M0.11

Concreta la persistencia de resultados de análisis prevista en M0.11 y amplía el modelo `JobAnalysis` definido en M3.16, sin sustituir `matchingSummary` ni alterar la estrategia transaccional de M3.24.

### M4.4.2 — Versión de `JobAnalysis`

#### Decisión

Se aplicará la semántica definida en M3.23: `JobAnalysis.version` representa la versión de las reglas deterministas de análisis.

Como M4 incorpora reglas deterministas nuevas de Scoring, Coverage y Confidence, deberá documentarse explícitamente cómo se refleja esta ampliación en la versión de reglas antes de cerrar la implementación. No se incrementará la versión por inercia ni se dejará esta decisión implícita.

No se incrementará por un nuevo `ProcessingRun`, por volver a analizar una oferta, por cambios de tests o infraestructura, ni por cambios exclusivos del prompt de Claude. La versión del prompt seguirá siendo independiente.

#### Motivo

La versión debe permitir interpretar los resultados históricos conociendo las reglas deterministas que los generaron. Incorporar nuevas reglas de análisis requiere tratar el versionado de forma explícita y coherente con M3.23.

#### Relación con M0.11

M0.11 incluye `version` en `JobAnalysis`; M3.23 concreta su semántica. M4 debe aplicar esa decisión existente y documentar el efecto de las nuevas reglas deterministas.

### M4.4.3 — Priorización dinámica

#### Decisión

La priorización se calculará dinámicamente al ordenar los resultados. No constituirá un score adicional ni se persistirá como entidad independiente.

El orden será:

1. Score descendente.
2. Cuando la diferencia de score sea de 3 puntos o menos, Coverage descendente.
3. Confidence descendente.
4. Si el score es igual, oferta detectada más recientemente primero.

Las razones de ordenación serán:

```text
higher_score
similar_score_higher_coverage
similar_score_higher_confidence
same_score_newer_offer
```

No se añadirán factores de priorización no aprobados ni se delegará el orden a Claude.

#### Motivo

La prioridad es una regla de ordenación derivada de resultados ya calculados. No persistirla evita duplicar estado que podría quedar desactualizado y mantiene la responsabilidad en la lógica determinista de Job Hunter.

#### Relación con M0.11

Concreta las reglas de priorización definidas en M0.11. No introduce una puntuación ni una entidad adicional.

---

## M4.5 — Límites de responsabilidad de Claude

### Decisión

Claude seguirá siendo un servicio auxiliar para normalización, enriquecimiento y extracción semántica. No podrá:

- comparar requisitos contra `UserProfile`;
- generar `RequirementMatch`;
- calcular `MatchingSummary`;
- calcular Scoring, Coverage o Confidence;
- recomendar o priorizar ofertas;
- modificar `JobOffer`;
- deduplicar Requirements.

Las decisiones de negocio permanecerán en lógica determinista de Job Hunter.

### Motivo

Mantener estas responsabilidades fuera de Claude permite reproducir resultados, probar reglas de negocio y conservar la trazabilidad del análisis.

### Relación con M0.11

Concreta los límites de responsabilidad establecidos en M0.11 y mantiene las decisiones de M3.17: Claude extrae información, pero no decide Matching ni sus resultados derivados.

---

## M4.6 — Testing e invariantes de aceptación

### Decisión

Cada subfase se implementará y validará antes de comenzar la siguiente.

Las pruebas cubrirán como mínimo:

- `OTHER` se admite en el schema y la persistencia de `Requirement`.
- `OTHER` sin evidencia estructurada suficiente produce `UNKNOWN`, no `MISSING`.
- Las categorías de Matching existentes conservan su comportamiento.
- Scoring respeta los pesos, bandas y reglas de M0.11.
- Los valores `UNKNOWN` y `N/A` se tratan conforme a M0.11.
- Coverage no modifica ni multiplica el score.
- Confidence tiene casos deterministas para `HIGH`, `MEDIUM` y `LOW`.
- `JobAnalysis` persiste `score`, `coverage` y `confidence` sin perder `matchingSummary`.
- Los análisis históricos completados permanecen inmutables.
- La versión de las reglas queda documentada.
- La priorización respeta el orden y los desempates definidos.
- Claude no ejecuta las decisiones de negocio enumeradas en M4.5.
- Se ejecutan typecheck, pruebas unitarias, integración y E2E según corresponda.

Los tests automatizados no dependerán de llamadas reales a Claude.

### Motivo

Una fase no se considerará terminada únicamente porque compile. Las pruebas deben demostrar tanto el comportamiento nuevo como la conservación de las decisiones previas.

### Relación con M0.11

Concreta los criterios de validación de M0.11 y extiende la estrategia de testing establecida en M3.26 a las responsabilidades de M4.

---

# M4 STATUS

**M4 — DISEÑO DOCUMENTADO; IMPLEMENTACIÓN PENDIENTE**

La implementación se realizará en este orden:

1. M4.1 — Requirements `OTHER`.
2. M4.2 — Scoring.
3. M4.3 — Coverage y Confidence.
4. M4.4 — Persistencia y priorización.

M4.5 y M4.6 establecen límites e invariantes transversales aplicables a todas las subfases.

La implementación podrá comenzar a partir de este documento. Si aparece un problema real que obligue a cambiar una decisión cerrada o si M0.11 no determina un detalle imprescindible, deberá documentarse y resolverse explícitamente antes de modificar el comportamiento.
