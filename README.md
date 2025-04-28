# Bot de Telegram para Registro de Cargas de Combustible

Un bot de Telegram que permite gestionar y dar seguimiento a las cargas de combustible de unidades de transporte. Registra operadores, unidades, cargas y genera reportes detallados.

## 🚀 Comandos de Plataformas Cloud

### Heroku

#### Gestión de Dynos

```bash
# Apagar la aplicación (escalar a 0)
heroku ps:scale web=0 --app cargas-gas

# Encender la aplicación (escalar a 1)
heroku ps:scale web=1 --app cargas-gas

# Ver estado actual de dynos
heroku ps --app cargas-gas
```

#### Reinicio y Mantenimiento

```bash
# Reiniciar la aplicación
heroku restart --app cargas-gas

# Ver logs en tiempo real
heroku logs --tail --app cargas-gas

# Abrir consola bash en el servidor
heroku run bash --app cargas-gas
```

#### Acceso y Autenticación

```bash
# Login en Heroku CLI
heroku login

# Verificar estado de la cuenta
heroku auth:whoami
```

#### GIT y Despliegue

```bash
# Guardar cambios y desplegar rápidamente
git add .
git commit -m "Actualización rápida: descripción breve"
git push heroku main

# Desplegar rama específica
git push heroku otra-rama:main
```

#### Variables de Entorno

```bash
# Ver todas las variables de entorno
heroku config --app cargas-gas

# Establecer una variable de entorno
heroku config:set NOMBRE_VARIABLE=valor --app cargas-gas

# Consultar una variable específica
heroku config:get MONGODB_URI --app cargas-gas
```

### Railway

#### Instalación y Autenticación

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Iniciar sesión en Railway
railway login

# Verificar estado de sesión
railway whoami
```

#### Gestión del Proyecto

```bash
# Listar proyectos disponibles
railway projects

# Enlazar con un proyecto existente
railway link

# Iniciar un nuevo proyecto
railway init
```

#### Despliegue y Actualización

```bash
# Desplegar aplicación actual
railway up

# Desplegar con variables de entorno locales
railway up --env-file .env.local

# Desplegar desde una rama git específica
railway up --detach
```

#### Variables de Entorno

```bash
# Ver variables de entorno
railway variables

# Agregar/actualizar variables
railway variables set NOMBRE_VARIABLE=valor

# Eliminar una variable
railway variables delete NOMBRE_VARIABLE
```

#### Monitoreo y Depuración

```bash
# Ver logs en tiempo real
railway logs

# Abrir panel de control en el navegador
railway open

# Ejecutar comando en la instancia remota
railway run <comando>
```

#### Base de Datos

```bash
# Conectar a bases de datos provisionales
railway connect

# Realizar backup de MongoDB
railway run mongodump --uri="$MONGODB_URI" --archive > backup_$(date +%Y%m%d).archive
```

## 💾 Scripts de Mantenimiento

### Backup Automático

Crea un backup completo del sistema (MongoDB + imágenes + reporte Excel):

```bash
# Crear backup completo
node scripts/backup-automatico.js
```

### Actualización Masiva desde Excel

Permite actualizar registros en la base de datos desde un archivo Excel:

```bash
# Modo simulación (no realiza cambios)
node scripts/actualizacion.js

# Modo real (modificar variable MODO_SIMULACION=false en el script)
node scripts/actualizacion.js
```

## 📋 Características Principales

- ✅ Gestión de operadores y unidades
- ⛽ Registro de cargas de combustible (gas/gasolina)
- 📷 Captura de fotos de tickets
- 💰 Control de pagos y saldos pendientes
- 📊 Reportes detallados en PDF y Excel
- 🔍 Filtros avanzados para análisis de datos
- 📅 Selección de fecha manual para registros retroactivos

## ⚙️ Requisitos Técnicos

- Node.js 18.x o superior
- MongoDB
- Token de Bot de Telegram (BotFather)
- Cuenta en Heroku o Railway (para despliegue)

## 🛠️ Instalación Local

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/cargas-gas.git
   cd cargas-gas
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Configurar variables de entorno (crear archivo `.env`):
   ```
   TELEGRAM_BOT_TOKEN=tu_token_aqui
   MONGODB_URI=mongodb+srv://usuario:contraseña@cluster.mongodb.net/database
   MONGODB_DB_NAME=cargas_gas_db
   NODE_ENV=development
   ```

4. Iniciar en desarrollo:
   ```bash
   npm run dev
   ```

## 🌐 Estructura del Proyecto

```
cargas-gas/
├── backups/                     # Backups generados
├── config/                      # Configuraciones
├── logs/                        # Logs generados
├── reports/                     # Reportes generados
├── scripts/                     # Scripts utilitarios
│   ├── actualizacion.js         # Actualización masiva
│   ├── backup-automatico.js     # Backup completo
│   └── setup.js                 # Configuración inicial
├── src/
│   ├── api/                     # API de Telegram
│   ├── commands/                # Comandos del bot
│   ├── controllers/             # Controladores
│   ├── db/                      # Conexión a MongoDB
│   ├── models/                  # Modelos de datos
│   ├── services/                # Servicios
│   ├── state/                   # Gestión de estados
│   ├── utils/                   # Utilidades
│   └── views/                   # Vistas y teclados
├── temp/                        # Archivos temporales
├── uploads/                     # Tickets/imágenes
├── .env                         # Variables de entorno
├── index.js                     # Punto de entrada
├── package.json                 # Dependencias
└── Procfile                     # Configuración Heroku
```

## ⚠️ Notas Importantes

### Sistema de Archivos en Plataformas Cloud

#### Heroku

Heroku tiene un sistema de archivos efímero. Los archivos subidos (como imágenes de tickets) se perderán en cada reinicio de dyno. Para producción:

1. Integrar almacenamiento en la nube (AWS S3, Cloudinary, Firebase)
2. Modificar `storageService` para utilizar este almacenamiento
3. Programar backups periódicos con el script proporcionado

#### Railway

Railway también tiene un sistema de archivos efímero, similar a Heroku. Sin embargo, ofrece volúmenes persistentes que pueden configurarse para almacenar archivos de forma permanente:

1. Crear un volumen persistente desde el panel de Railway
2. Montar el volumen en la ruta `/app/uploads`
3. Configurar la aplicación para utilizar esta ruta para almacenamiento

### MongoDB Atlas

Para gestionar la base de datos:
```bash
# Ver estadísticas de la base de datos
node scripts/db-stats.js

# Ver MongoDB connection string (Heroku)
heroku config:get MONGODB_URI --app cargas-gas

# Ver MongoDB connection string (Railway)
railway variables get MONGODB_URI
```

### Sincronización entre Entornos

Para mantener sincronizados los entornos de Heroku y Railway:

```bash
# Exportar variables de entorno de Heroku
heroku config --app cargas-gas -s > .env.heroku

# Importar variables a Railway (requiere procesamiento del archivo)
cat .env.heroku | grep -v '^#' | sed 's/^/railway variables set /' | sh
```

## 📄 Licencia

Este proyecto está licenciado bajo [MIT License](LICENSE).