# M8 — Decisiones técnicas

## Propósito y alcance

M8 prepara el entorno operativo y el despliegue local de Job Hunter. El destino acordado es el ordenador Windows del propietario, mediante Docker Desktop. M8 no incluye un VPS ni la exposición pública de la aplicación.

La API y PostgreSQL se ejecutan con Docker Compose. n8n self-hosted se ejecuta en un contenedor separado. El workflow de Gmail permanece inactivo hasta que se complete la validación posterior y el propietario decida activarlo.

## M8.1 — Red local

Los puertos publicados de la API (`3000`) y PostgreSQL (`5432`) se enlazan a `127.0.0.1`. Solo el propio ordenador accede a ellos mediante esos puertos.

n8n accede a la API mediante `api:3000` en la red interna compartida de Docker.

## M8.2 — Persistencia y copias

PostgreSQL conserva sus datos en el volumen de Compose `postgres_data`, que Docker muestra como `job-hunter_postgres_data`. El volumen se monta en `/var/lib/postgresql`.

n8n conserva sus datos en el volumen `n8n_data`.

El propietario realiza manualmente una copia semanal de PostgreSQL en formato custom y mantiene la copia manual semanal de n8n acordada en M7. La copia de PostgreSQL se guarda fuera del repositorio en `Documentos\Job Hunter Backups`. En el ordenador actual, Documentos está sincronizado con OneDrive.

No se automatizan las copias ni se exige una prueba de restauración en M8. La restauración queda bajo responsabilidad del propietario.

## M8.3 — Ciclo de vida de los servicios

API, PostgreSQL y n8n utilizan la política `unless-stopped`. Docker reinicia esos contenedores cuando el motor Docker vuelve a estar disponible, salvo que se hayan detenido manualmente.

Inicio habitual de API y PostgreSQL:

```powershell
docker compose up -d
docker compose ps
```

Actualización de la API:

```powershell
docker compose build api
docker compose up -d api
```

Si el cambio requiere una migración de base de datos, se ejecuta antes del despliegue según las instrucciones del README.

Parada temporal:

```powershell
docker compose stop
```

No se debe utilizar `docker compose down -v` si se quieren conservar los volúmenes.

## M8.4 — Comprobaciones realizadas

- Los puertos publicados de API y PostgreSQL aparecen enlazados a `127.0.0.1`.
- PostgreSQL aparece como `healthy`.
- Se confirmó el montaje del volumen persistente de PostgreSQL.
- Windows conecta con la API en el puerto `3000`.
- n8n resuelve `api` y establece una conexión TCP con la API.
- La imagen actual de la API se construyó y se desplegó correctamente.
- `.env` está ignorado por Git y no está versionado.
- Se generó una copia manual de PostgreSQL de 85.312 bytes.

## Estado

La configuración y las comprobaciones del entorno local de M8 están realizadas. El cambio de `README.md`, `docker-compose.yml` y este documento debe revisarse y confirmarse en un commit antes de considerar M8 cerrado.

M9, validación integral y estabilización, permanece como hito posterior.