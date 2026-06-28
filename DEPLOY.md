# Manual de Despliegue — ClínicaPro
## Neon (Base de datos) + Render (Backend + Frontend)

---

## Resumen del flujo

```
Tu código (GitHub)
       │
       ├──► Render  ──► Backend Node.js  (clinica-backend.onrender.com)
       │                    │
       │                  Neon (PostgreSQL)
       │
       └──► Render  ──► Frontend React   (clinica-frontend.onrender.com)
```

> **Por qué Neon:** su plan gratuito **no caduca** (a diferencia de las bases PostgreSQL gratuitas de Render, que se suspenden a los 30 días). El backend crea las tablas automáticamente al arrancar, así que no hay que ejecutar SQL a mano.

---

## Requisitos previos

- Cuenta en [github.com](https://github.com)
- Cuenta en [neon.tech](https://neon.tech) — registro con GitHub, sin tarjeta
- Cuenta en [render.com](https://render.com) — registro con GitHub, sin tarjeta

---

## PASO 1 — Subir el código a GitHub

### 1.1 Crear el repositorio

1. Ve a [github.com/new](https://github.com/new)
2. Nombre: `clinica-pro`
3. Visibilidad: **Private**
4. **No** marques ninguna opción de inicialización
5. Clic en **Create repository**

### 1.2 Inicializar y subir desde la terminal

Abre la terminal en la carpeta raíz del proyecto:

```bash
cd insigne-pro

git init
git add .
git commit -m "Initial commit - ClínicaPro"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/clinica-pro.git
git push -u origin main
```

> Reemplaza `TU_USUARIO` con tu nombre de usuario de GitHub.

Verifica en GitHub que ves las carpetas `backend/` y `frontend/` en el repositorio.

---

## PASO 2 — Configurar Neon (Base de datos)

### 2.1 Crear el proyecto

1. Ve a [console.neon.tech](https://console.neon.tech) → **New Project**
2. Completa:
   - **Project name:** `clinica-pro`
   - **Postgres version:** la más reciente (por defecto)
   - **Region:** `AWS US East (N. Virginia)` u otra cercana a tus usuarios
3. Clic en **Create project**

### 2.2 Obtener la cadena de conexión

1. En el panel de Neon → **Connect** (o **Connection Details** en el dashboard del proyecto)
2. Selecciona la rama **production** y la base **neondb**
3. Copia la **connection string**. Luce así:
   ```
   postgresql://neondb_owner:XXXXXXXX@ep-nombre-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

> **Guarda este string como `DATABASE_URL`** — lo usarás en el paso 3.

### 2.3 Las tablas se crean solas

**No necesitas ejecutar SQL manualmente.** Al arrancar, el backend ejecuta `initDB()` (ver `backend/src/database.ts`), que crea de forma idempotente las 10 tablas del sistema y aplica las migraciones:

`users`, `doctors`, `appointments`, `medical_info`, `clinical_records`, `inventory`, `reminders`, `accounts`, `invitations`, `activity_log`.

También registra automáticamente al **superusuario** definido en `SUPERUSER_EMAIL` (paso 3.2).

---

## PASO 3 — Desplegar el Backend en Render

### 3.1 Crear el Web Service

1. Ve a [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**
2. Conecta tu cuenta de GitHub si aún no lo has hecho
3. Selecciona el repositorio `clinica-pro`
4. Configura:

| Campo | Valor |
|-------|-------|
| **Name** | `clinica-backend` |
| **Region** | Oregon (US West) |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

### 3.2 Agregar variables de entorno

En la sección **Environment Variables** (antes de crear el servicio):

| Key | Value |
|-----|-------|
| `DATABASE_URL` | El string de conexión de Neon del paso 2.2 |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | (déjalo vacío por ahora — lo actualizas en el paso 4.3) |
| `GOOGLE_CLIENT_ID` | Tu Client ID de Google OAuth (`xxxx.apps.googleusercontent.com`) |
| `JWT_SECRET` | Una clave larga y secreta para firmar sesiones |
| `SUPERUSER_EMAIL` | El email del administrador (acceso total, sin invitación) |

5. Clic en **Create Web Service**

### 3.3 Esperar el deploy y verificar

El primer deploy toma 3-5 minutos. Cuando diga **Live** en verde:

1. Anota la URL de tu servicio. Luce así:
   ```
   https://clinica-backend.onrender.com
   ```
2. Ábrela en el navegador agregando `/api/health`:
   ```
   https://clinica-backend.onrender.com/api/health
   ```
3. Debes ver: `{"status":"ok"}`

> **Nota:** En el plan gratuito de Render, el backend se duerme tras 15 minutos sin tráfico. La primera petición después de inactividad puede tardar hasta 30 segundos en responder mientras "despierta".

---

## PASO 4 — Desplegar el Frontend en Render

### 4.1 Crear el Static Site

1. En Render → **New +** → **Static Site**
2. Selecciona el mismo repositorio `clinica-pro`
3. Configura:

| Campo | Valor |
|-------|-------|
| **Name** | `clinica-frontend` |
| **Branch** | `main` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

### 4.2 Agregar variable de entorno

En **Environment Variables**:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://clinica-backend.onrender.com` (URL del paso 3.3, **sin `/` al final**) |

4. Clic en **Create Static Site**

Cuando termine (~2 minutos), anota tu URL del frontend:
```
https://clinica-frontend.onrender.com
```

> Los Static Sites en Render son **siempre gratuitos y nunca se duermen**.

### 4.3 Actualizar CORS en el backend

1. En Render → tu servicio `clinica-backend`
2. → **Environment** → edita la variable `FRONTEND_URL`:
   ```
   https://clinica-frontend.onrender.com
   ```
3. Clic en **Save Changes** — Render redesplegará el backend automáticamente

---

## PASO 5 — Verificación final

1. Abre `https://clinica-frontend.onrender.com` en tu navegador
   - Si el backend está dormido, espera 30 segundos y recarga la página
2. Ve a **Médicos** → crea un médico de prueba
3. Ve a **Pacientes** → crea un paciente de prueba
4. Ve a **Citas** → agenda una cita
5. En Neon → **Tables** (en el panel del proyecto) → verifica que los datos aparecen en las tablas

---

## Cómo actualizar la aplicación después del deploy

```bash
git add .
git commit -m "descripción del cambio"
git push
```

Render detecta el push y redespliega frontend y backend automáticamente.

---

## Migrar datos a una nueva base PostgreSQL

Como la app usa PostgreSQL estándar (driver `pg`) conectado por una sola variable `DATABASE_URL`, cambiar de proveedor es solo copiar los datos y actualizar esa URL.

**Con `pg_dump` / `psql`** (si los tienes instalados):

```bash
# 1. Exportar la base actual (usa la connection string EXTERNA si es de Render)
pg_dump "URL_VIEJA" > respaldo.sql

# 2. Importar a la nueva base (Neon)
psql "URL_NUEVA_DE_NEON" < respaldo.sql
```

Luego actualiza `DATABASE_URL` en Render → **Environment** con la nueva URL y guarda (redespliega solo).

> **Nota Render:** la base PostgreSQL de Render tiene dos URLs. La **Internal** (`@dpg-xxxx-a/...`, sin dominio) solo funciona dentro de Render; para copiar desde tu máquina usa la **External** (`@dpg-xxxx-a.oregon-postgres.render.com/...`).

---

## Límites del plan gratuito

| Servicio | Límite gratuito | Caduca | Se duerme |
|----------|----------------|--------|-----------|
| **Neon** | 0.5 GB almacenamiento | **No** (se pausa tras ~5 min de inactividad y reanuda solo) | No |
| **Render Web Service** | 750 hrs/mes, 512 MB RAM | No | **Sí** (15 min sin tráfico) |
| **Render Static Site** | Bandwidth ilimitado | No | No |

> ⚠️ **Evita la base PostgreSQL gratuita de Render:** se suspende a los 30 días. Por eso este proyecto usa Neon.

---

## Solución de problemas frecuentes

### La app carga lento la primera vez del día
→ Normal en el plan gratuito. El backend se durmió por inactividad y tarda ~30 segundos en despertar. Recarga la página.

### `/api/health` devuelve error
→ Verifica que `DATABASE_URL` está correctamente copiado en Render (sin espacios) y que **termina en `?sslmode=require`** (Neon exige SSL).
→ Revisa los logs en Render → tu servicio → pestaña **Logs**.

### El frontend carga pero no muestra datos
→ Verifica que `VITE_API_URL` apunta exactamente a la URL del backend (sin `/` al final).
→ Verifica que `FRONTEND_URL` en el backend coincide con la URL del frontend.

### No puedo iniciar sesión / "no autorizado"
→ Verifica que `GOOGLE_CLIENT_ID`, `JWT_SECRET` y `SUPERUSER_EMAIL` están configurados en Render.
→ El email con el que inicias sesión debe ser el `SUPERUSER_EMAIL`, o tener una invitación aceptada.

### Error 409 al crear registros
→ Estás intentando registrar un email que ya existe. Usa un email diferente.

### "relation does not exist" en los logs
→ El backend no alcanzó a crear las tablas. Reinicia el servicio en Render (**Manual Deploy → Clear build cache & deploy**) para que `initDB()` corra de nuevo.

### Render muestra "Build failed"
→ Verifica que **Root Directory** está configurado como `backend` para el Web Service y `frontend` para el Static Site.
