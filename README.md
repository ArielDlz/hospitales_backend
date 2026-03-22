# Hospitales API

API backend para gestión de hospitales y evaluaciones de aspirantes a puestos en hospitales públicos y privados. Construido con [NestJS](https://nestjs.com/), TypeORM y PostgreSQL.

## Características

- **Multi-tenant:** Cada hospital es un tenant identificado por slug
- **Autenticación JWT:** Dos flujos (administradores y aspirantes) con enfoque en seguridad
- **Usuarios administrativos:** Administradores (superusers) y evaluadores (con scope por tenant)
- **Aspirantes:** Únicos por hospital (tenant + email + registro_hospital)
- **CORS configurable:** Dominios permitidos vía variable de entorno
- **Documentación Swagger:** API documentada en `/api`

## Requisitos

- Node.js 18+
- PostgreSQL 14+
- npm o yarn

## Instalación

```bash
npm install
```

## Configuración

Copiar `.env.example` a `.env` y configurar las variables:

```bash
cp .env.example .env
```

### Variables de entorno

| Variable      | Descripción                            | Requerido |
|---------------|----------------------------------------|-----------|
| `DB_HOST`     | Host de PostgreSQL                     | Sí        |
| `DB_PORT`     | Puerto de PostgreSQL (default: 5432)   | No        |
| `DB_USERNAME` | Usuario de la base de datos            | Sí        |
| `DB_PASSWORD` | Contraseña de la base de datos         | Sí        |
| `DB_NAME`     | Nombre de la base de datos             | Sí        |
| `PORT`        | Puerto de la API (default: 3000)       | No        |
| `NODE_ENV`    | Entorno (development/production)       | No        |
| `CORS_ORIGINS`| Dominios CORS permitidos (comma-separated, soporta `*.dominio.com`) | No |
| `JWT_SECRET`  | Clave secreta para JWT (mínimo 32 caracteres) | Sí  |
| `JWT_EXPIRES_IN` | Expiración del token (ej: `7d`, `24h`) | No    |

## Migraciones de base de datos

El esquema se gestiona manualmente con SQL. Ejecutar las migraciones en orden:

```bash
# Con psql
psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME -f database/migrations/001_create_users_schema.sql
psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME -f database/migrations/002_alter_aspirantes_add_fields.sql
```

**Nota:** Antes de `001`, asegurar que la tabla `hospitales` exista y que `hospitales.uuid` tenga constraint UNIQUE. Si no existe, agregar:

```sql
ALTER TABLE hospitales ADD CONSTRAINT uk_hospitales_uuid UNIQUE (uuid);
```

## Crear primer administrador

Después de ejecutar las migraciones:

```bash
npm run create-admin -- admin@ejemplo.com MiPasswordSegura123
```

O directamente:

```bash
node scripts/create-admin.js admin@ejemplo.com MiPasswordSegura123
```

## Ejecución

```bash
# Desarrollo (watch mode)
npm run start:dev

# Producción
npm run build
npm run start:prod
```

## API

### Documentación Swagger

Con el servidor en ejecución:

- **Swagger UI:** http://localhost:3000/api
- **OpenAPI JSON:** http://localhost:3000/api-json

### Endpoints públicos

| Método | Ruta                     | Descripción                    |
|--------|---------------------------|--------------------------------|
| GET    | `/`                       | Health check                   |
| GET    | `/hospitales`             | Listar hospitales              |
| GET    | `/hospitales/by-slug/:slug` | Obtener tenant por slug      |
| GET    | `/hospitales/:id`         | Obtener hospital por ID        |
| POST   | `/auth/admin/login`       | Login administradores          |
| POST   | `/auth/aspirante/login`   | Login aspirantes               |

### Autenticación

**Login admin** (`POST /auth/admin/login`):
```json
{ "email": "admin@ejemplo.com", "password": "********" }
```

**Login aspirante** (`POST /auth/aspirante/login`):
```json
{
  "slug": "hospital-general",
  "email": "aspirante@ejemplo.com",
  "registroHospital": "REG-2024-001",
  "password": "********"
}
```

Respuesta exitosa:
```json
{ "accessToken": "eyJhbGciOiJIUzI1NiIs...", "expiresIn": "7d" }
```

Rutas protegidas requieren el header: `Authorization: Bearer <accessToken>`

## Modelo de datos

### Hospitales (tenants)
- `id`, `uuid`, `nombre`, `slug`, `logo_url`

### Aspirantes (por tenant)
- `id`, `tenant_id`, `email`, `registro_hospital`, `password_hash`
- `apellidos`, `nombre`, `telefono`, `modalidad`, `documento`
- Único: `(tenant_id, email, registro_hospital)`

### Usuarios administrativos
- **Administradores:** Acceso a todos los tenants
- **Evaluadores:** Acceso global o restringido a tenants asignados en `evaluador_tenant`

## Estructura del proyecto

```
src/
├── common/           # Entidades base, enums, interfaces
├── modules/
│   ├── auth/         # JWT, login, guards
│   ├── aspirante/    # Módulo aspirantes
│   ├── hospital/     # Módulo hospitales
│   └── usuario-administrativo/
database/
└── migrations/       # Scripts SQL
scripts/
├── create-admin.js   # Crear usuario administrador
```

## Scripts disponibles

| Comando              | Descripción                    |
|----------------------|--------------------------------|
| `npm run start:dev`  | Servidor en modo desarrollo    |
| `npm run build`      | Compilar proyecto              |
| `npm run start:prod` | Ejecutar en producción         |
| `npm run create-admin` | Crear usuario administrador  |
| `npm run lint`       | Ejecutar ESLint                |
| `npm run test`       | Tests unitarios                |

## Seguridad

- Contraseñas hasheadas con bcrypt (cost 10)
- Mensajes genéricos en login (`"Credenciales inválidas"`) para evitar fugas de información
- JWT con payload mínimo (sin PII)
- Guards para aislamiento por tenant (aspirantes) y por rol (admin/evaluador)
- CORS configurable por dominio

## Licencia

UNLICENSED
