# Bot de Telegram para Registro de Cargas de Combustible

Un bot de Telegram que permite gestionar y dar seguimiento a las cargas de combustible de unidades de transporte. Registra operadores, unidades, cargas y genera reportes detallados.

## 🚀 Comandos Rápidos (Heroku)

### Gestión de Dynos

```bash
# Apagar la aplicación (escalar a 0)
heroku ps:scale web=0 --app cargas-gas

# Encender la aplicación (escalar a 1)
heroku ps:scale web=1 --app cargas-gas

# Ver estado actual de dynos
heroku ps --app cargas-gas
```

### Reinicio y Mantenimiento

```bash
# Reiniciar la aplicación
heroku restart --app cargas-gas

# Ver logs en tiempo real
heroku logs --tail --app cargas-gas

# Abrir consola bash en el servidor
heroku run bash --app cargas-gas
```

### Acceso y Autenticación

```bash
# Login en Heroku CLI
heroku login

# Verificar estado de la cuenta
heroku auth:whoami
```

### GIT Commits

```bash
# Guardar cambios y desplegar rápidamente
git add .
git commit -m "Actualización rápida: descripción breve"
git push heroku main

# Desplegar rama específica
git push heroku otra-rama:main
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

## ⚙️ Requisitos Técnicos

- Node.js 18.x o superior
- MongoDB
- Token de Bot de Telegram (BotFather)
- Cuenta en Heroku (para despliegue)

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

### Sistema de Archivos en Heroku

Heroku tiene un sistema de archivos efímero. Los archivos subidos (como imágenes de tickets) se perderán en cada reinicio de dyno. Para producción:

1. Integrar almacenamiento en la nube (AWS S3, Cloudinary, Firebase)
2. Modificar `storageService` para utilizar este almacenamiento
3. Programar backups periódicos con el script proporcionado

### MongoDB Atlas

Para gestionar la base de datos:
```bash
# Ver estadísticas de la base de datos
heroku run node scripts/db-stats.js --app cargas-gas

# Ver MongoDB connection string
heroku config:get MONGODB_URI --app cargas-gas
```

## 📄 Licencia

Este proyecto está licenciado bajo [MIT License](LICENSE).