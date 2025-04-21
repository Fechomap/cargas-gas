# Bot de Telegram para Registro de Cargas de Combustible

Un bot de Telegram para empresas que necesitan gestionar y dar seguimiento a las cargas de combustible de sus unidades de transporte. Permite registrar operadores, unidades, cargas de combustible y generar reportes.

## 🚀 Comandos Rápidos (Heroku)

### Gestión de Dynos

```bash
# Escalar a 0 (apagar aplicación)
heroku ps:scale web=0 --app nombre-de-tu-app

# Escalar a 1 (encender aplicación)
heroku ps:scale web=1 --app nombre-de-tu-app

# Ver estado actual de dynos
heroku ps --app nombre-de-tu-app
```

### Reinicio Rápido

```bash
# Reiniciar la aplicación
heroku restart --app nombre-de-tu-app
```

### Login y Acceso

```bash
# Login en Heroku CLI
heroku login

# Abrir consola bash en servidor
heroku run bash --app nombre-de-tu-app

# Ver logs en tiempo real
heroku logs --tail --app nombre-de-tu-app
```

### JIT Commits (Just-In-Time)

```bash
# Guardar cambios y desplegar rápidamente
git add .
git commit -m "Actualización rápida: descripción breve"
git push heroku main

# Desplegar rama específica como master
git push heroku otra-rama:main
```

## 💾 Scripts de Mantenimiento

### Backup Automático

Crea un backup completo del sistema (MongoDB + imágenes + reporte Excel):

```bash
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

## 📋 Características

- ✅ Registro de operadores y unidades
- ⛽ Registro de cargas de combustible (gas/gasolina)
- 📷 Soporte para subir fotos de tickets
- 💰 Control de pagos (pagado/no pagado)
- 📊 Generación de reportes en PDF y Excel
- 🔍 Filtros para visualizar datos específicos

## ⚙️ Requisitos

- Node.js 18.x o superior
- MongoDB
- Token de Bot de Telegram (obtenido a través de BotFather)

## 🛠️ Instalación Local

1. Clona el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/telegram-gas-bot.git
   cd telegram-gas-bot
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:
   ```
   TELEGRAM_BOT_TOKEN=tu_token_aqui
   MONGODB_URI=mongodb+srv://usuario:contraseña@cluster.mongodb.net/database
   MONGODB_DB_NAME=telegram_gas_bot
   NODE_ENV=development
   ```

4. Inicia el bot en modo desarrollo:
   ```bash
   npm run dev
   ```

## 🌐 Estructura del proyecto

```
telegram-gas-bot/
├── backups/                     # Backups generados
├── config/                      # Configuraciones
├── logs/                        # Logs generados
├── reports/                     # Reportes generados
├── scripts/                     # Scripts utilitarios
│   ├── actualizacion.js         # Script de actualización masiva
│   ├── backup-automatico.js     # Script de backup completo
│   └── setup.js                 # Script de configuración inicial
├── src/
│   ├── api/                     # API de Telegram
│   ├── commands/                # Comandos del bot
│   ├── controllers/             # Controladores
│   ├── db/                      # Conexión a base de datos
│   ├── models/                  # Modelos de datos
│   ├── services/                # Servicios
│   ├── state/                   # Gestión de estados
│   ├── utils/                   # Utilidades
│   └── views/                   # Vistas (teclados y mensajes)
├── temp/                        # Archivos temporales
├── uploads/                     # Archivos subidos (tickets)
├── .env                         # Variables de entorno
├── index.js                     # Punto de entrada
├── package.json                 # Dependencias
└── Procfile                     # Configuración de Heroku
```

## ⚠️ Consideraciones en Producción (Heroku)

Heroku tiene un sistema de archivos efímero, lo que significa que los archivos subidos (como imágenes de tickets) se perderán en cada reinicio de dyno. Para un entorno de producción adecuado:

1. Configura un almacenamiento en la nube (S3, Cloudinary, Firebase Storage)
2. Modifica el servicio `storageService` para utilizar este almacenamiento
3. Programa backups periódicos con el script proporcionado

## 🤝 Contribuir

1. Haz un fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Realiza tus cambios y haz commit (`git commit -am 'Añade nueva funcionalidad'`)
4. Haz push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crea un nuevo Pull Request

## 📄 Licencia

Este proyecto está licenciado bajo [MIT License](LICENSE).