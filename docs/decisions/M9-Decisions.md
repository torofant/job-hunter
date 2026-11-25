# M9 — Validación integral y estabilización

## Propósito

M9 valida el comportamiento integral de Job Hunter antes de considerar
cerrado el proyecto. Este hito no cambia el contrato de entrada ni introduce
nuevas categorías de requisitos.

## M9.1 — Normalización de niveles de idioma

La extracción acepta niveles CEFR explícitos y expresiones reconocidas por
la aplicación. El modelo conserva las expresiones originales y la aplicación
las normaliza de forma determinista:

| Expresión | Nivel normalizado |
|---|---|
| Nativo, nativa, bilingüe | C2 |
| Alto, nivel alto | B2 |
| Intermedio, conversación, conversacional | B1 |
| Básico, leer documentación | A2 |

Un código CEFR explícito tiene prioridad. Si una expresión no está reconocida,
el requisito se omite; no se inventa un nivel.

## M9.2 — Extracción de tecnologías y alternativas

Los asistentes concretos de programación con IA, como Claude, Codex y
Copilot, se consideran tecnologías. Si la oferta los presenta como opciones,
se extraen como un requisito `ALTERNATIVE`, conservando su importancia.

La extracción conserva por separado requisitos diferentes sobre las mismas
tecnologías. Por ejemplo, “AWS o Google Cloud” puede ser un requisito
obligatorio `ALTERNATIVE`, mientras que preferir experiencia con ambas nubes
se representa como un requisito `GROUP` preferido.

La normalización equipara `REST API` y `REST APIs` con `REST`, para poder
compararlas con el perfil del usuario.

## M9.3 — Prompt y salida estructurada

La versión final del prompt de extracción es `1.4.0`. El límite de salida de
Claude se aumentó de 1.024 a 2.048 tokens tras observar una respuesta
estructurada truncada durante las pruebas.

La aplicación normaliza los niveles de idioma reconocidos y omite los que no
puede interpretar con seguridad.

## M9.4 — Comprobaciones automatizadas

Resultados registrados:

- Pruebas unitarias: 305 correctas.
- Pruebas de integración: 43 correctas.
- Pruebas E2E: 15 correctas.
- Typecheck: correcto.
- Build: correcto.

## M9.5 — Benchmark real con Claude

Se validó la oferta de LinkedIn **Programador full stack — Codigames**,
`source_job_id` `4489974174`.

La detección `711ca3ef-0375-42b7-bdfe-8d80a202d23b` registró uso de Claude
con el prompt `1.4.0`. El procesamiento terminó como `COMPLETED` y la
extracción de requisitos como `COMPLETED`.

Resultado del análisis:

- Score: `47.84722`.
- Coverage: `62.63158`.
- Confidence: `MEDIUM`.
- Requisitos obligatorios: 5 `MATCH` de 11.
- Requisitos preferidos: 0 `MATCH` de 7.
- La notificación llegó a Telegram con el resultado esperado, sin el falso
  `100/100 HIGH MATCH`.

La oferta pide dos años de experiencia como programador. El perfil contiene
cinco meses de experiencia como desarrollador web y otra experiencia en
soporte técnico e infraestructura. El usuario confirmó que esa experiencia
de soporte no debe contarse como experiencia profesional de programación;
por ello, el resultado `MISSING` es correcto.

El nivel de español C2 coincide con el requisito de español nativo o bilingüe.
El inglés B1 no alcanza el nivel B2 preferido de la oferta.

## Estado

La revisión de código, las comprobaciones automatizadas y el benchmark real
de M9 están validados. La incorporación de este documento y el commit de los
cambios locales quedan pendientes para cerrar formalmente el hito.