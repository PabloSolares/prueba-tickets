# Club CashIn Tickets

Sistema interno para registrar solicitudes de soporte técnico, asignarlas a
agentes y darles seguimiento hasta su cierre. Los empleados pueden consultar y
comentar sus propias solicitudes. Los agentes pueden consultar todos los
tickets, tomar los que están libres y revisar las métricas del equipo.

**Tecnologías:** React, Vite, TanStack Router y Tailwind CSS en el frontend;
Bun, Hono, Better Auth, Drizzle ORM y PostgreSQL en el backend.

## Instalación y ejecución local

Se necesita **Git** y **Docker Desktop** o **Docker Engine con Docker Compose**.
Docker instala las dependencias y ejecuta el frontend, la API y PostgreSQL.
No hace falta instalar Bun, Node.js ni PostgreSQL en la máquina anfitriona.

### 1. Clonar el repositorio

```sh
git clone https://github.com/PabloSolares/prueba-tickets.git
cd prueba-tickets
```

### 2. Configurar el entorno


| Variable | Configuración |
| --- | --- |
| `POSTGRES_PASSWORD` | Contraseña que compartirán PostgreSQL y la API. Para una instalación local, usa un valor aleatorio alfanumérico. |
| `BETTER_AUTH_SECRET` | Secreto aleatorio de al menos 32 caracteres para Better Auth. |
| `AGENT_SIGNUP_CODE` | Código de 16 a 128 caracteres que se solicita al registrar un agente. |
| `APP_ORIGIN` | Dirección desde la que se abre la aplicación. Conserva `http://127.0.0.1:5173` para la configuración incluida. |
| `POSTGRES_HOST_PORT` | Puerto de PostgreSQL en la máquina anfitriona. El valor por defecto es `54329`. |

### 3. Levantar los servicios

```sh
docker compose up -d --build
docker compose ps
```

Abre [la aplicación](http://127.0.0.1:5173). Usa `127.0.0.1` para que
la dirección coincida con `APP_ORIGIN`.

La API aplica automáticamente las migraciones de Drizzle antes de empezar
a escuchar. Para comprobar que el frontend puede llegar a la API y que esta
puede consultar PostgreSQL, abre
[`/api/health`](http://127.0.0.1:5173/api/health). La respuesta esperada es
`{"data":{"status":"ok"}}`.

Si un servicio no arranca, consulta `docker compose logs db api web`.
Para detener el entorno y conservar los datos, ejecuta `docker compose down`.

## Cómo usar la aplicación

La primera instalación comienza sin usuarios ni tickets precargados.

1. En **Registrarme**, crea una cuenta de **Empleado**. Abre un ticket con
   un título, una descripción, una categoría y una prioridad. Puedes
   editarlo mientras esté abierto y agregar comentarios desde el detalle.
2. Abre otra sesión del navegador y registra una cuenta de **Agente**. Usa
   el código que configuraste en `AGENT_SIGNUP_CODE`. Busca el ticket por
   título o descripción, o aplica los filtros de estado, prioridad y categoría.
3. Desde el detalle, pulsa **Asignarme**. Agrega un comentario y avanza el
   ticket por el flujo **Abierto → En progreso → Resuelto → Cerrado**.
   El historial muestra quién hizo cada cambio y cuándo.
4. En **Dashboard**, consulta los totales por estado y prioridad, el tiempo
   promedio de resolución, los tickets abiertos sin asignar desde hace más
   de 48 horas y los cinco tickets más recientes. En una base nueva es normal
   que no haya tickets con más de 48 horas.

## Estructura del proyecto

| Ruta | Responsabilidad |
| --- | --- |
| `web/src/` | Rutas de TanStack Router, pantallas, formularios y cliente HTTP. |
| `server/src/auth/` | Registro, configuración de Better Auth y comprobación de sesión. |
| `server/src/tickets/` | Validación de solicitudes, operaciones sobre tickets y dashboard. |
| `server/src/db/` y `server/drizzle/` | Conexión, esquema y migraciones versionadas de PostgreSQL. |
| `server/tests/` | Pruebas de integración de la API. |
| `.github/workflows/ci.yml` | Verificación automática de pruebas, tipado y compilación. |

## Decisiones técnicas

- **Organización.** La interfaz presenta los datos y guía las acciones
  disponibles. La API valida las entradas y aplica las reglas del negocio.
  Dentro de la API, separar autenticación, tickets y acceso a datos permite
  cambiar un flujo sin mezclarlo con la gestión de sesiones o el esquema.
- **Modelo de datos.** Cada ticket referencia al empleado que lo creó y,
  si ya fue tomado, al agente asignado. La asignación admite un valor nulo
  porque un ticket puede existir antes de que alguien lo atienda. Los
  comentarios y el historial registran el ticket, el autor y la fecha.
  PostgreSQL restringe los valores de categoría, prioridad y estado.
- **Autenticación y permisos.** Better Auth gestiona las credenciales y las
  sesiones en sus propias tablas. El rol se valida en el servidor y el
  registro de un agente requiere un código de incorporación. La API también
  comprueba los permisos en cada acción protegida.
- **Asignación e historial.** La actualización solo asigna un ticket si
  todavía está abierto y libre. Esto impide que dos solicitudes simultáneas
  lo asignen dos veces. El cambio de estado y su entrada de historial se
  guardan en la misma transacción.
- **Tiempo de resolución.** El promedio se calcula desde la creación hasta
  la fecha de resolución. Cerrar un ticket conserva esa fecha, de modo que
  el tiempo entre resolverlo y cerrarlo no altera la métrica.
- **Integración local.** Vite reenvía las solicitudes a `/api` dentro de
  Docker. Así, para el navegador, la aplicación y la API comparten un
  origen y las solicitudes autenticadas pueden usar la cookie de sesión.

## Pruebas

Las pruebas de integración cubren creación y validación de tickets, acceso
entre empleados, asignación, transiciones de estado, historial y acceso al
dashboard. GitHub Actions las ejecuta con un PostgreSQL separado y comprueba
el tipado y la compilación del proyecto.

Para ejecutarlas localmente, levanta primero la aplicación. Crea la base
de pruebas **una sola vez**:

```sh
docker compose exec -T db createdb -U tickets tickets_test
```

Después, aplica las migraciones y ejecuta la suite:

```sh
docker compose run --rm --build -e POSTGRES_DB=tickets_test api bun run db:migrate
docker compose run --rm -e POSTGRES_DB=tickets_test api bun test ./tests/tickets.test.ts
```

La suite usa `tickets_test`, separada de la base `tickets` de la aplicación.