# Bot de Telegram para Registro de Cargas de Combustible

Sistema multi-tenant para gestionar y dar seguimiento a las cargas de combustible de unidades de transporte. Registra operadores, unidades, cargas y genera reportes detallados con arquitectura empresarial que permite múltiples empresas en un solo bot.

## 🚀 Características Principales

### Sistema Multi-Tenant
- ✅ **Registro de empresas**: Sistema de aprobación para nuevas empresas
- 🔐 **Aislamiento de datos**: Cada empresa tiene sus propios datos completamente separados
- 🎫 **Sistema de tokens**: Vinculación segura de grupos con tokens únicos
- 👥 **Gestión de administradores**: Control de acceso por roles

### Funcionalidades Operativas
- 👷 **Gestión de operadores y unidades**: Registro y administración de flota
- ⛽ **Registro de cargas**: Gas y gasolina con validación completa
- 📷 **Captura de tickets**: Sistema opcional de fotografías con botón de omisión mejorado
- 💰 **Control de pagos**: Estados de pago y saldos pendientes
- 📊 **Reportes avanzados**: PDF y Excel con múltiples filtros
- 🔍 **Sistema de búsqueda**: Por número de nota para pagos y desactivación
- 📅 **Fechas retroactivas**: Registro de cargas con fechas anteriores
- 🚮 **Borrado lógico**: Desactivación segura de registros y unidades con filtrado optimizado

## 🛠️ Tecnologías

- **Runtime**: Node.js 18.x
- **Base de datos**: PostgreSQL con Prisma ORM
- **Bot**: Telegraf 4.x
- **Reportes**: PDFMake y ExcelJS
- **Logs**: Winston
- **Despliegue**: Railway

## 📋 Requisitos Previos

1. **Token de Bot de Telegram** (obtener de [@BotFather](https://t.me/botfather))
2. **Base de datos PostgreSQL** (Railway proporciona una)
3. **Cuenta en Railway** ([railway.app](https://railway.app))
4. **Node.js 18+** (para desarrollo local)

## 🚀 Despliegue en Railway

### Opción 1: Despliegue Rápido con Railway Button

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/telegram-gas-bot)

### Opción 2: Despliegue Manual

1. **Instalar Railway CLI**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Crear nuevo proyecto**
   ```bash
   railway init
   # Seleccionar "Empty Project"
   ```

3. **Agregar PostgreSQL**
   ```bash
   railway add
   # Seleccionar "PostgreSQL"
   ```

4. **Configurar variables de entorno**
   ```bash
   # Token del bot (REQUERIDO)
   railway variables set TELEGRAM_BOT_TOKEN=tu_token_aqui
   
   # IDs de administradores (REQUERIDO - separados por coma)
   railway variables set BOT_ADMIN_IDS=123456789,987654321
   
   # Ambiente
   railway variables set NODE_ENV=production
   
   # La DATABASE_URL se configura automáticamente con PostgreSQL
   ```

5. **Desplegar aplicación**
   ```bash
   # Asegurarse de estar en el directorio del proyecto
   railway up
   ```

6. **Ejecutar migraciones**
   ```bash
   # Conectar a la instancia de Railway
   railway run npx prisma migrate deploy
   railway run npx prisma generate
   ```

## 🔧 Configuración Local

1. **Clonar repositorio**
   ```bash
   git clone https://github.com/tu-usuario/telegram-gas-bot.git
   cd telegram-gas-bot
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   
   Crear archivo `.env`:
   ```env
   # Bot de Telegram
   TELEGRAM_BOT_TOKEN=tu_token_de_desarrollo
   
   # Base de datos PostgreSQL
   DATABASE_URL=postgresql://usuario:password@localhost:5432/cargas_gas_db
   
   # Administradores (IDs separados por coma)
   BOT_ADMIN_IDS=123456789
   
   # Ambiente
   NODE_ENV=development
   
   # Logs
   LOG_LEVEL=debug
   ```

4. **Configurar base de datos**
   ```bash
   # Generar cliente Prisma
   npx prisma generate
   
   # Ejecutar migraciones
   npx prisma migrate dev
   ```

5. **Iniciar en desarrollo**
   ```bash
   npm run dev
   ```

## 📚 Guía de Uso

### Para Administradores del Sistema

1. **Aprobar nuevas empresas**:
   - Los usuarios solicitan registro con `/registrar_empresa`
   - Recibirás una notificación con botones de aprobación
   - Al aprobar, se genera un token único

2. **Comandos administrativos** (solo en chat privado):
   - `/solicitudes` - Ver solicitudes pendientes
   - `/aprobar [ID]` - Aprobar solicitud
   - `/rechazar [ID]` - Rechazar solicitud

### Para Empresas/Usuarios

1. **Registro inicial**:
   ```
   # En chat privado con el bot
   /registrar_empresa
   # Seguir el proceso de registro
   # Esperar aprobación del administrador
   ```

2. **Vincular grupo** (después de aprobación):
   ```
   # En el grupo de Telegram
   /vincular TOKEN_RECIBIDO
   ```

3. **Operaciones diarias**:
   - `/start` - Menú principal
   - `/registrar` - Nueva unidad
   - `/saldo` - Ver saldo pendiente
   - `/reporte` - Generar reportes

### Flujo de Trabajo Típico

1. **Registrar unidades**: Primero registra los operadores y sus unidades
2. **Cargar combustible**: Selecciona unidad → ingresa datos → confirma
3. **Gestionar pagos**: Busca notas por número → marca como pagadas
4. **Generar reportes**: Aplica filtros → descarga PDF/Excel

## 🗄️ Estructura de la Base de Datos

```mermaid
erDiagram
    Tenant ||--o{ Unit : tiene
    Tenant ||--o{ Fuel : tiene
    Tenant ||--|| TenantSettings : configura
    Unit ||--o{ Fuel : recibe
    
    Tenant {
        string id PK
        string chatId UK
        string companyName
        boolean isActive
        boolean isApproved
        string registrationToken UK
    }
    
    Unit {
        string id PK
        string tenantId FK
        string operatorName
        string unitNumber
        string buttonId
        boolean isActive
    }
    
    Fuel {
        string id PK
        string tenantId FK
        string unitId FK
        decimal liters
        decimal amount
        enum fuelType
        string saleNumber
        enum paymentStatus
        datetime recordDate
        boolean isActive
    }
```

## 🔍 Comandos de Railway

### Gestión del Proyecto

```bash
# Ver logs en tiempo real
railway logs

# Abrir panel web
railway open

# Ver todas las variables
railway variables

# Ejecutar comando en producción
railway run [comando]

# Conectar a base de datos
railway connect postgresql
```

### Mantenimiento

```bash
# Backup de base de datos
railway run pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restaurar base de datos
railway run psql $DATABASE_URL < backup.sql

# Ejecutar migraciones
railway run npx prisma migrate deploy

# Ver estado de la base de datos
railway run npx prisma db pull
```

### Monitoreo

```bash
# Ver uso de recursos
railway status

# Ver información del proyecto
railway whoami
railway project
```

## 📊 Scripts de Mantenimiento

### Estadísticas de la Base de Datos
```bash
railway run node scripts/db-stats.js
```

### Backup Completo (DB + Archivos)
```bash
railway run node scripts/backup-automatico.js
```

## ⚠️ Consideraciones Importantes

### Sistema de Archivos
Railway tiene almacenamiento persistente limitado. Para las fotos de tickets:
- Los archivos se guardan temporalmente
- Se recomienda integrar almacenamiento en la nube (S3, Cloudinary)
- Hacer backups periódicos de la base de datos

### Límites y Escalamiento
- Railway tiene límites en el plan gratuito
- Monitorea el uso de recursos desde el dashboard
- Considera actualizar el plan para producción

### Seguridad
- Nunca compartas el token del bot
- Mantén actualizados los IDs de administradores
- Revisa regularmente los logs de acceso
- Haz backups frecuentes de la base de datos

## 🐛 Solución de Problemas

### El bot no responde
1. Verificar logs: `railway logs`
2. Verificar token: `railway variables`
3. Reiniciar: `railway restart`

### Error de base de datos
1. Verificar conexión: `railway connect postgresql`
2. Ejecutar migraciones: `railway run npx prisma migrate deploy`
3. Revisar logs de Prisma

### Problemas con comandos
1. Verificar que el grupo esté vinculado
2. Confirmar permisos del bot en el grupo
3. Revisar estado del tenant en la base de datos

## 🤝 Soporte

Para soporte técnico o preguntas:
1. Revisar logs del sistema
2. Consultar documentación de Prisma
3. Abrir issue en el repositorio

## 📄 Licencia

Este proyecto está bajo licencia MIT. Ver archivo [LICENSE](LICENSE) para más detalles.

---

**Última actualización**: 31 de Mayo 2025
**Versión**: 2.0.2 (Multi-tenant con PostgreSQL)

## 🔧 Mejoras Recientes

### 31/05/2025 - v2.0.2
- **🔄 Corrección de contexto en registros progresivos**: Solucionado problema que requería reiniciar el bot entre cargas consecutivas
- **🔢 Ampliación de números de venta**: Soporte para números de venta de 1 a 10 dígitos (anteriormente 6)
- **✅ Validación de folios únicos**: Implementada verificación de números de venta duplicados con manejo de errores mejorado
- **🔧 Preservación de datos de sesión**: Mantenimiento inteligente de información de unidad para registros consecutivos

### 31/05/2025 - v2.0.1
- **⛽ Nuevo tipo de combustible**: Agregado Diésel como tercer tipo de combustible, ampliando las opciones de registro y reportes.
- **📷 Manejo mejorado de fotos de tickets**: Corregido el funcionamiento del botón de omitir foto y separado el manejador de fotografías para mayor robustez.
- **📊 Optimización de reportes**: Corregido el filtrado de registros desactivados en reportes para que no aparezcan en ninguna consulta (aplicando filtro isActive directamente en la consulta SQL).