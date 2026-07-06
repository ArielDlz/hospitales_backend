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
| `BREVO_API_KEY` | API key de Brevo (Transactional → API keys) | Sí (para envío de correos) |
| `MAIL_FROM` | Remitente verificado en Brevo (ej: `registro@arieldelao.dev`) | No (default en código) |
| `MAIL_FROM_NAME` | Nombre visible del remitente | No |
| `ADMIN_NOTIFY_EMAIL` | Email para alertas si falla el envío al aspirante | No |
| `PRIMER_ACCESO_DOMAIN` | Dominio base de enlaces de activación (ej: `arieldelao.dev`) | Sí (para invitaciones) |
| `PRIMER_ACCESO_PLACEHOLDER` | Contraseña temporal hasta activación | No |

### Correo con Brevo

1. En [Brevo](https://app.brevo.com): autentica tu dominio (SPF/DKIM) y verifica el sender (`MAIL_FROM`).
2. Crea una API key en **Transactional** → **API keys**.
3. Configura `.env` con `BREVO_API_KEY`, `MAIL_FROM`, `PRIMER_ACCESO_DOMAIN` y opcionalmente `ADMIN_NOTIFY_EMAIL` para recibir alertas si falla un envío.
4. No subas la API key al repositorio.

Al crear un aspirante (`POST /aspirantes`), la respuesta incluye `emailEnviado: true|false` según si el correo de activación se entregó.

## Migraciones de base de datos

El esquema se gestiona manualmente con SQL. Ejecutar las migraciones en orden:

```bash
# Con psql
psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME -f database/migrations/001_create_users_schema.sql
psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME -f database/migrations/002_alter_aspirantes_add_fields.sql
psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME -f database/migrations/003_add_active_column.sql
psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME -f database/migrations/004_aspirante_primer_acceso.sql
psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME -f database/migrations/005_evaluation_flow_steps.sql
psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME -f database/migrations/006_pruebas_schema.sql
psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME -f database/migrations/007_pruebas_instrucciones_markdown.sql
psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME -f database/migrations/008_pruebas_tracking.sql
psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME -f database/migrations/009_evaluation_flow_steps_4_5.sql
```

### Flujo de evaluación (pasos automáticos)

El paso del aspirante se guarda en `aspirantes.evaluation_flow_id` (catálogo `evaluation_flow_steps.order_id`).

| Transición | Disparador | JWT |
|------------|------------|-----|
| 1 → 2 | Activar cuenta (`POST /auth/aspirante/activar-cuenta`) | Sí (nuevo token) |
| 3 → 4 | Primera respuesta guardada en un intento (`POST /pruebas/aspirantes/respuestas`) mientras `order_id = 3` | No |
| 4 → 5 | Tras `PATCH /pruebas/aspirantes/:id` con acción `"finalizada por el aspirante"`, cuando **todas** las pruebas habilitadas del hospital (`show=true`, prueba activa) tienen intento en `por_evaluar` o estado posterior | No |

Los pasos 3→4 y 4→5 no reemiten JWT: el token del aspirante puede quedar con un `evaluationFlowOrderId` anterior; la fuente de verdad para reportes y listados admin es la base de datos (`GET /aspirantes` expone `evaluationFlowId` y `evaluationFlowDescripcion`).

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

**Aspirantes** (JWT admin o evaluador):

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/aspirantes` | Listar aspirantes. Requiere `tenantId` o `slug`. Por defecto **solo activos** (`includeInactive` omitido o distinto de `true`). Evaluador con `slug=admin` ve aspirantes de sus hospitales asignados. |
| POST | `/aspirantes` | Crear aspirante e enviar correo de activación |

Ejemplo para tabla de evaluador (solo activos, todos sus hospitales):

```http
GET /aspirantes?slug=admin
Authorization: Bearer <token evaluador>
```

Campos útiles en cada ítem del listado:

| Columna UI | Campo API |
|------------|-----------|
| Nombre completo | `nombreCompleto` |
| Hospital | `hospitalNombre` |
| Folio | `registroHospital` |
| Status | `evaluationFlowDescripcion` |
| Acciones → Evaluar | Habilitar si `canEvaluar === true` y (`evaluadorAsignadoEmail` es null o coincide con el evaluador logueado) |
| Evaluador asignado | `evaluadorAsignadoEmail` (null si nadie abrió el workspace aún) |

**Evaluaciones** (JWT admin o evaluador):

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/evaluaciones/veredictos` | Catálogo de veredictos para el informe final |
| GET | `/evaluaciones/aspirantes/:aspiranteId` | Workspace: intentos, respuestas e informe. **Asigna evaluador y avanza paso 5→6** al abrir (evaluador) |
| PUT | `/evaluaciones/intentos/:idPruebaAspirante` | **Deprecado (410)** — comentarios por prueba ya no soportados |
| POST | `/evaluaciones/aspirantes/:aspiranteId/informe` | Informe final + veredicto (solo evaluador asignado, paso 6) |
| POST | `/evaluaciones/aspirantes/:aspiranteId/confirmar` | Confirmar evaluación → paso 7 y `pruebas_aspirantes.status=evaluada` |

**Bloqueo por evaluador:** al abrir el workspace, el primer evaluador queda asignado en `aspirantes.id_evaluador_asignado`. Otros evaluadores reciben **403**. El administrador puede **ver** el workspace (`readOnly: true`) pero no editar. La asignación se conserva como historial tras confirmar.

Campos extra en workspace: `readOnly`, `evaluadorAsignadoEmail`.

Flujo evaluador:

1. Listar aspirantes con `canEvaluar === true` (pasos 5–6).
2. Abrir workspace con `GET /evaluaciones/aspirantes/:id` (asigna evaluador y avanza **5 → 6**).
3. Revisar respuestas de las pruebas (sin comentarios por intento).
4. Enviar informe con `POST .../informe`.
5. Confirmar con `POST .../confirmar` (habilitar en UI si `canConfirmarEvaluacion === true` en el workspace).

**Pruebas** (JWT admin/evaluador para lectura; crear/editar/borrado lógico solo **administrador** — ver Swagger):

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/pruebas` | Listar pruebas (`?includeInactive=true` opcional) |
| GET | `/pruebas/id/:idPrueba` | Detalle por `id_prueba` |
| POST | `/pruebas` | Crear prueba |
| PATCH | `/pruebas/id/:idPrueba` | Actualizar |
| DELETE | `/pruebas/id/:idPrueba` | Baja lógica (`active=false`) |
| GET | `/pruebas/hospitales` | Listar asignaciones prueba-hospital (incluye `show` true/false) |
| GET | `/pruebas/hospitales/by-tenant/:slug` | Listar pruebas disponibles para un tenant por slug |
| POST | `/pruebas/hospitales` | Crear asignación (`idPrueba`, `tenantId`, `show=true`) |
| PATCH | `/pruebas/hospitales/:idPruebaHospital` | Actualizar `show` |
| POST | `/pruebas/aspirantes` | Iniciar prueba para el aspirante autenticado (`status=iniciada`) |
| GET | `/pruebas/aspirantes` | Ver pruebas iniciadas del aspirante con estado actual |
| PATCH | `/pruebas/aspirantes/:idPruebaAspirante` | Acción de cierre del aspirante (iniciada -> por_evaluar) |
| POST | `/pruebas/aspirantes/uploads/imagen` | Subir imagen a S3 (`uploads/{id_aspirante}/{filename}`) |
| POST | `/pruebas/aspirantes/respuestas` | Guardar respuesta de una pregunta de la prueba en curso |
| PATCH | `/pruebas/aspirantes/respuestas/:idPruebaRespuesta` | Actualizar respuesta de una pregunta |
| GET | `/pruebas/aspirantes/:idPruebaAspirante/respuestas` | Respuestas guardadas de un intento (continuar prueba) |
| GET | `/pruebas/aspirantes/:idPrueba/preguntas` | Preguntas activas de una prueba iniciada por el aspirante |

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
│   ├── pruebas/      # Catálogo de pruebas
│   ├── evaluaciones/ # Evaluación de aspirantes por evaluador
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
