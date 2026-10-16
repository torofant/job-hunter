# Backlog — Mejoras pendientes

Este documento recoge mejoras identificadas durante el desarrollo que se aplazan a fases posteriores. Estas tareas no bloquean el cierre de las fases actuales, salvo que se indique expresamente.

---

## BL-001 — Recuperación idempotente de la extracción de requisitos

- **Estado:** Pendiente
- **Prioridad:** Por reevaluar tras las primeras semanas de producción
- **Área:** Procesamiento de ofertas, extracción de requisitos y costes de IA
- **Fase de origen:** M3

### Contexto

Si Claude extrae correctamente los requisitos de una oferta, pero falla la persistencia posterior del análisis, el reintento del procesamiento puede volver a ejecutar la extracción. Esto puede generar llamadas adicionales al modelo y aumentar el coste de procesamiento.

Además, cada llamada real debe quedar reflejada correctamente en `AIUsage`, sin ocultar consumos duplicados.

### Decisión actual

No ampliar el alcance de M3 para resolver este caso. Durante las primeras semanas de producción se observarán el volumen de ofertas procesadas, los reintentos y el coste real de Claude.

### Trabajo pendiente

- [ ] Definir una estrategia para persistir el resultado de la extracción como estado intermedio recuperable.
- [ ] Reutilizar el resultado persistido cuando se reintente el procesamiento.
- [ ] Mantener `AIUsage` como registro fiel de las llamadas reales y sus costes.
- [ ] Añadir pruebas de integración para verificar la recuperación tras fallos de persistencia.

### Criterios para reevaluar la prioridad

Revisar esta mejora si se detectan reintentos frecuentes o un coste adicional relevante debido a llamadas repetidas a Claude.

### Restricciones

- No deduplicar registros de `AIUsage` únicamente por detección y propósito, ya que podría ocultar llamadas reales.
- Definir la estrategia de persistencia y recuperación antes de modificar el esquema de la base de datos.
- Mantener la extracción de requisitos y la persistencia final separadas, sin introducir llamadas a Claude dentro de la transacción de persistencia final.

---