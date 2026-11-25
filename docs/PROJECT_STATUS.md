# Estado del proyecto y hoja de ruta

## Situación actual

Los hitos M1–M9 están implementados y cerrados. El estado de referencia está
en la rama `main`, commit `e0468b2`.

| Hito | Alcance | Estado |
|---|---|---|
| M1 | Job Collector y ciclo básico de procesamiento | Completado |
| M2 | Normalización, deduplicación y filtrado | Completado |
| M3 | Perfil, requisitos y Matching | Completado |
| M4 | Scoring, Coverage, Confidence y priorización | Completado |
| M5 | Notificaciones por Telegram | Completado |
| M6 | Contrato HTTP e idempotencia | Completado |
| M7 | Gmail, n8n e ingesta de ofertas | Completado |
| M8 | Entorno local con Docker | Completado |
| M9 | Validación integral y estabilización | Completado |
| Futuro | Dashboard | Aplazado; alcance pendiente de definir |

## Validación de M9

- Pruebas unitarias: 305 correctas.
- Pruebas de integración: 43 correctas.
- Pruebas E2E: 15 correctas.
- Typecheck y build: correctos.
- Benchmark real con Claude y prompt `1.4.0`: completado.
- Oferta del benchmark: LinkedIn `4489974174`, Programador full stack,
  Codigames.
- Resultado: score `47.84722`, Coverage `62.63158`, Confidence `MEDIUM`.
- La notificación real de Telegram llegó con el resultado esperado.

Los detalles del benchmark y sus decisiones están en
[`M9-Decisions.md`](decisions/M9-Decisions.md).

## Entorno operativo

Job Hunter está preparado para ejecutarse en el ordenador Windows del
propietario: API y PostgreSQL con Docker Compose, y n8n self-hosted en un
contenedor separado. La API y PostgreSQL no se exponen fuera del ordenador.

El workflow de Gmail quedó desactivado mientras se completaban M8 y M9.
M9 ya está validado; volver a activarlo requiere una decisión operativa del
propietario. Este documento no confirma el estado actual del workflow en n8n.

Las copias de seguridad son manuales y semanales. No se exige una prueba de
restauración; esa decisión queda bajo responsabilidad del propietario.

## Documentos de referencia

`M0.11_Implementation_Spec.md` conserva las decisiones iniciales del proyecto.
Las decisiones de hitos posteriores concretan o reemplazan las partes que
cambiaron:

- M4 concreta scoring y excluye `OTHER` como categoría matcheable.
- M6 actualiza la secuencia de hitos y aplaza el Dashboard.
- M8 establece el despliegue local en Docker como destino actual.
- M9 registra la validación integral y el benchmark final.