# Guía para configurar PostgreSQL

## Opción 1: PostgreSQL en la nube (recomendado para pruebas)

### Railway.app (Opción gratuita para desarrollo)
1. Ve a [Railway.app](https://railway.app/) y crea una cuenta
2. Crea un nuevo proyecto
3. Añade un servicio de PostgreSQL
4. En la pestaña "Connect", copia la URL de conexión
5. Actualiza tu archivo `.env` con esta URL en la variable `DATABASE_URL`

### Supabase (Opción gratuita con GUI)
1. Ve a [Supabase](https://supabase.com/) y crea una cuenta
2. Crea un nuevo proyecto
3. Ve a "Settings" > "Database" > "Connection string"
4. Copia la cadena de conexión y reemplaza `[YOUR-PASSWORD]` con tu contraseña
5. Actualiza tu archivo `.env` con esta URL en la variable `DATABASE_URL`

### ElephantSQL (Plan gratuito simple)
1. Ve a [ElephantSQL](https://www.elephantsql.com/) y crea una cuenta
2. Crea una nueva instancia (plan "Tiny Turtle" gratuito)
3. Una vez creada, ve a "Details" y copia la URL
4. Actualiza tu archivo `.env` con esta URL en la variable `DATABASE_URL`

## Opción 2: PostgreSQL local

### Instalación en Mac
```bash
brew install postgresql
brew services start postgresql
```

### Crear base de datos local
```bash
psql postgres
CREATE ROLE gas_bot_user WITH LOGIN PASSWORD 'tu_contraseña';
CREATE DATABASE gas_bot OWNER gas_bot_user;
\q
```

### Actualizar .env
```
DATABASE_URL=postgresql://gas_bot_user:tu_contraseña@localhost:5432/gas_bot
```

## Después de configurar la base de datos

Una vez que tengas la URL de conexión en tu archivo `.env`, ejecuta:

```bash
npx prisma migrate dev --name init
```

Esto creará las tablas en tu base de datos según el esquema definido.
