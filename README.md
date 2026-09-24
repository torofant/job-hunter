# Job Hunter

## Desarrollo local

Node.js se ejecuta directamente en Windows y PostgreSQL 18.6 se inicia con Docker Compose.

```powershell
docker compose up -d
Copy-Item .env.example .env
npm ci
npm run db:migrate
npm run dev
```

## Migraciones en producción

Las migraciones no se ejecutan al iniciar la aplicación y la imagen final no incluye Drizzle Kit. Antes de desplegar una nueva imagen, desde el repositorio que contiene las migraciones versionadas y con `DATABASE_URL` configurada para la base de datos de destino, se ejecuta:

```powershell
npm ci
npm run db:migrate
```

Después se construye y despliega la imagen de aplicación. Este paso explícito debe completarse antes de iniciar la nueva versión del servicio.
