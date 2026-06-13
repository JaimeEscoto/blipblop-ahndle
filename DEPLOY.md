# Manual de Despliegue — ClínicaPro
## Supabase (Base de datos) + Render (Backend + Frontend)

---

## Resumen del flujo

```
Tu código (GitHub)
       │
       ├──► Render  ──► Backend Node.js  (clinica-backend.onrender.com)
       │                    │
       │               Supabase (PostgreSQL)
       │
       └──► Render  ──► Frontend React   (clinica-frontend.onrender.com)
```

---

## Requisitos previos

- Cuenta en [github.com](https://github.com)
- Cuenta en [supabase.com](https://supabase.com)
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

## PASO 2 — Configurar Supabase (Base de datos)

### 2.1 Crear el proyecto

1. Ve a [app.supabase.com](https://app.supabase.com) → **New project**
2. Completa:
   - **Name:** `clinica-pro`
   - **Database Password:** elige una contraseña fuerte y **guárdala**
   - **Region:** `South America (São Paulo)` para menor latencia
3. Clic en **Create new project** — espera 1-2 minutos

### 2.2 Crear las tablas

1. En el panel → **SQL Editor** (ícono de terminal en la barra lateral)
2. Clic en **New query**
3. Pega el siguiente SQL y clic en **Run**:

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  document_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  license_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TIME NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK(status IN ('scheduled','completed','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Debes ver **"Success. No rows returned"** en verde.

### 2.3 Obtener la cadena de conexión

1. Panel de Supabase → **Project Settings** (engranaje) → **Database**
2. Baja hasta **Connection string** → pestaña **URI**
3. Copia el string. Luce así:
   ```
   postgresql://postgres:[PASSWORD]@db.xxxxxxxxxx.supabase.co:5432/postgres
   ```
4. Reemplaza `[PASSWORD]` con la contraseña que definiste en el paso 2.1

> **Guarda este string como `DATABASE_URL`** — lo usarás en el paso 3.

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
| `DATABASE_URL` | El string de conexión de Supabase del paso 2.3 |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | (déjalo vacío por ahora — lo actualizas en el paso 4.3) |

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
5. En Supabase → **Table Editor** → verifica que los datos aparecen en las tablas

---

## Cómo actualizar la aplicación después del deploy

```bash
git add .
git commit -m "descripción del cambio"
git push
```

Render detecta el push y redespliega frontend y backend automáticamente.

---

## Límites del plan gratuito

| Servicio | Límite gratuito | Se duerme |
|----------|----------------|-----------|
| **Supabase** | 500 MB DB, 2 GB transferencia/mes | No |
| **Render Web Service** | 750 hrs/mes, 512 MB RAM | **Sí** (15 min sin tráfico) |
| **Render Static Site** | Bandwidth ilimitado | No |

---

## Solución de problemas frecuentes

### La app carga lento la primera vez del día
→ Normal en el plan gratuito. El backend se durmió por inactividad y tarda ~30 segundos en despertar. Recarga la página.

### `/api/health` devuelve error
→ Verifica que `DATABASE_URL` está correctamente copiado en Render (sin espacios).
→ Revisa los logs en Render → tu servicio → pestaña **Logs**.

### El frontend carga pero no muestra datos
→ Verifica que `VITE_API_URL` apunta exactamente a la URL del backend (sin `/` al final).
→ Verifica que `FRONTEND_URL` en el backend coincide con la URL del frontend.

### Error 409 al crear registros
→ Estás intentando registrar un email que ya existe. Usa un email diferente.

### "relation does not exist" en los logs
→ Repite el paso 2.2: ejecuta el SQL en el SQL Editor de Supabase.

### Render muestra "Build failed"
→ Verifica que **Root Directory** está configurado como `backend` para el Web Service y `frontend` para el Static Site.
