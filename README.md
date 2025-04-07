# Bot de Telegram para Registro de Cargas de Combustible

Un bot de Telegram para empresas que necesitan gestionar y dar seguimiento a las cargas de combustible de sus unidades de transporte. Permite registrar operadores, unidades, cargas de combustible y generar reportes.

## Características

- ✅ Registro de operadores y unidades
- ⛽ Registro de cargas de combustible (gas/gasolina)
- 📷 Soporte para subir fotos de tickets
- 💰 Control de pagos (pagado/no pagado)
- 📊 Generación de reportes en PDF y Excel
- 🔍 Filtros para visualizar datos específicos

## Comandos disponibles

- `/start` - Inicia el bot y muestra el menú principal
- `/registrar` - Registra una nueva unidad
- `/saldo` - Consulta el saldo pendiente total
- `/reporte` - Genera reportes según filtros
- `/ayuda` - Muestra instrucciones de uso

## Requisitos

- Node.js 18.x o superior
- MongoDB
- Token de Bot de Telegram (obtenido a través de BotFather)

## Instalación local

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

## Despliegue en Heroku

### Preparación para Heroku

1. Instala Heroku CLI:
   ```bash
   npm install -g heroku
   ```

2. Inicia sesión en Heroku:
   ```bash
   heroku login
   ```

3. Crea una aplicación en Heroku:
   ```bash
   heroku create nombre-de-tu-bot
   ```

### Configuración de variables de entorno

```bash
heroku config:set TELEGRAM_BOT_TOKEN=tu_token_aqui
heroku config:set MONGODB_URI=tu_uri_de_mongodb_aqui
heroku config:set MONGODB_DB_NAME=nombre_db
heroku config:set NODE_ENV=production
heroku config:set APP_URL=$(heroku info -s | grep web_url | cut -d= -f2 | sed 's/\/$//g')
```

### Despliegue

```bash
git push heroku main
```

### Monitoreo y mantenimiento

- Ver logs:
  ```bash
  heroku logs --tail
  ```

- Reiniciar el bot:
  ```bash
  heroku restart
  ```

- Escalar dyno:
  ```bash
  heroku ps:scale web=1:basic
  ```

## Comandos útiles de Heroku

### Despliegue

- Desplegar a Heroku:
  ```bash
  git push heroku main
  ```

- Desplegar desde una rama diferente:
  ```bash
  git push heroku otra-rama:main
  ```

### Configuración

- Ver configuración actual:
  ```bash
  heroku config
  ```

- Establecer variable de entorno:
  ```bash
  heroku config:set NOMBRE_VARIABLE=valor
  ```

- Eliminar variable de entorno:
  ```bash
  heroku config:unset NOMBRE_VARIABLE
  ```

### Gestión

- Ver estado de los dynos:
  ```bash
  heroku ps
  ```

- Reiniciar la aplicación:
  ```bash
  heroku restart
  ```

- Ejecutar un comando en el servidor:
  ```bash
  heroku run npm list
  ```

- Abrir la aplicación en el navegador:
  ```bash
  heroku open
  ```

### Logs y diagnóstico

- Ver logs en tiempo real:
  ```bash
  heroku logs --tail
  ```

- Ver últimos N logs:
  ```bash
  heroku logs -n 200
  ```

- Ver logs con marca de tiempo:
  ```bash
  heroku logs --tail --timestamps
  ```

### Mantenimiento

- Activar modo mantenimiento:
  ```bash
  heroku maintenance:on
  ```

- Desactivar modo mantenimiento:
  ```bash
  heroku maintenance:off
  ```

- Obtener información de la app:
  ```bash
  heroku info
  ```

## Estructura del proyecto

```
telegram-gas-bot/
├── config/                      # Configuraciones
├── logs/                        # Logs generados
├── reports/                     # Reportes generados
├── scripts/                     # Scripts utilitarios
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

## Solución de problemas

### El bot no responde

1. Verifica los logs:
   ```bash
   heroku logs --tail
   ```

2. Asegúrate de que el token es correcto:
   ```bash
   heroku config:get TELEGRAM_BOT_TOKEN
   ```

3. Confirma que la URL del webhook está bien configurada:
   ```bash
   heroku config:get APP_URL
   ```

### Problemas con MongoDB

1. Verifica la cadena de conexión:
   ```bash
   heroku config:get MONGODB_URI
   ```

2. Asegúrate de que la IP de Heroku está en la lista de acceso de MongoDB Atlas.

### Restricción de grupo

Si quieres que el bot solo funcione en un grupo específico:

1. Añade el bot al grupo y observa los logs para obtener el ID del grupo.
2. Modifica el archivo `src/utils/middleware.js` y actualiza la constante `ALLOWED_GROUPS` con el ID del grupo.
3. Despliega los cambios:
   ```bash
   git add .
   git commit -m "Añadir restricción de grupo"
   git push heroku main
   ```

## Contribuir

1. Haz un fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Realiza tus cambios y haz commit (`git commit -am 'Añade nueva funcionalidad'`)
4. Haz push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crea un nuevo Pull Request

## Licencia

Este proyecto está licenciado bajo [MIT License](LICENSE).