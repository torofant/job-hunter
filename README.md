# Job Hunter

Estado y hoja de ruta del proyecto: [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## Desarrollo local

Node.js se ejecuta directamente en Windows y PostgreSQL 18.6 se inicia con Docker Compose.

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose up -d postgres
docker compose ps
npm ci
npm run db:migrate
npm run dev
```

## Entorno operativo local con Docker

La ejecución operativa local utiliza Docker Compose para la API y PostgreSQL. n8n se ejecuta en un contenedor independiente.

Los puertos publicados de la API (`3000`) y PostgreSQL (`5432`) están limitados a `127.0.0.1`. n8n accede a la API mediante `api:3000` en la red interna de Docker.

PostgreSQL conserva sus datos en el volumen persistente  `job-hunter_postgres_data` —definido en Compose como `postgres_data`—, montado en `/var/lib/postgresql`. Recrear los contenedores conserva el volumen. No ejecutar `docker compose down -v` si se quieren conservar los datos.

### Copias de seguridad manuales

El propietario realizará una copia manual semanal de PostgreSQL en formato custom. El archivo se guarda fuera del repositorio, en la carpeta Documentos\Job Hunter Backups. El nombre incluye la fecha y hora de creación. No se automatiza el proceso ni se requiere probar una restauración en M8; la restauración queda bajo responsabilidad del propietario.

```powershell
$backupDir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Job Hunter Backups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$backupName = "job-hunter-db-$(Get-Date -Format 'yyyyMMdd-HHmmss').dump"

docker exec job-hunter-postgres-1 pg_dump -U job_hunter -d job_hunter -F c -f "/tmp/$backupName"
if ($LASTEXITCODE -ne 0) { throw "Falló la creación de la copia de PostgreSQL." }

docker cp "job-hunter-postgres-1:/tmp/$backupName" (Join-Path $backupDir $backupName)
if ($LASTEXITCODE -ne 0) { throw "Falló la copia del archivo a Documentos." }

docker exec job-hunter-postgres-1 rm "/tmp/$backupName"
Get-Item (Join-Path $backupDir $backupName) | Select-Object FullName, Length, LastWriteTime
```

La API y PostgreSQL usan la política `unless-stopped`: Docker las reinicia cuando vuelve a estar disponible, siempre que no se hayan detenido manualmente.

### Inicio habitual
```powershell
docker compose up -d
docker compose ps
```

### Actualización de la API

Si el cambio incluye migraciones de base de datos, ejecutarlas antes de desplegar la nueva imagen, según la sección **Migraciones en producción**. Después:

```powershell
docker compose build api
docker compose up -d api
```

### Parada temporal

```powershell
docker compose stop
```

Esto detiene los contenedores y conserva el volumen de PostgreSQL.

## Migraciones en producción

Las migraciones no se ejecutan al iniciar la aplicación y la imagen final no incluye Drizzle Kit. Antes de desplegar una nueva imagen, desde el repositorio que contiene las migraciones versionadas y con `DATABASE_URL` configurada para la base de datos de destino, se ejecuta:

```powershell
npm ci
npm run db:migrate
```

Después se construye y despliega la imagen de aplicación. Este paso explícito debe completarse antes de iniciar la nueva versión del servicio.
