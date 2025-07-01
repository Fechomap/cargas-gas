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
- ⛽ **Registro de cargas**: Gas, gasolina y diesel con validación completa
- 📏 **Sistema de kilómetros**: Tracking opcional de kilometraje con validación de retrocesos
- 🔄 **Sistema de turnos**: Registro de inicio/fin de día con kilometraje automático
- 💰 **Cálculo automático**: Monto = litros × precio por litro (cuando se registra precio)
- 📷 **Captura de tickets**: Sistema opcional de fotografías con respaldo en Cloudflare R2
- 📁 **Descarga de documentos**: URLs firmadas para acceso seguro a tickets guardados
- 💰 **Control de pagos**: Estados de pago y saldos pendientes
- 📊 **Reportes avanzados**: PDF y Excel con columnas de kilómetros y precio por litro
- 🔍 **Sistema de búsqueda**: Por número de nota para pagos y gestión administrativa
- 📅 **Fechas retroactivas**: Registro de cargas con fechas anteriores
- 🚮 **Borrado lógico**: Desactivación segura de registros y unidades con filtrado optimizado

### ⭐ NUEVO: Sistema CRUD Completo para Administradores
- ✏️ **Edición completa**: Kilómetros, litros, precio por litro, tipo de combustible, número de nota, estado de pago
- 🔍 **Búsqueda exacta**: Localización precisa de registros por número de nota
- ♻️ **Recálculo automático**: Monto se actualiza automáticamente al cambiar litros o precio
- 🗑️ **Eliminación segura**: Sistema de confirmación con desactivación lógica
- 🔐 **Control de acceso**: Funciones administrativas limitadas a usuarios autorizados
- 🎯 **Validaciones robustas**: Tipos de datos, permisos y estados de conversación

## 🛠️ Tecnologías

- **Runtime**: Node.js 18.x
- **Base de datos**: PostgreSQL con Prisma ORM
- **Storage**: Cloudflare R2 para documentos
- **Bot**: Telegraf 4.x
- **Reportes**: PDFMake y ExcelJS
- **Logs**: Winston
- **Despliegue**: Railway

## 📋 Requisitos Previos

1. **Token de Bot de Telegram** (obtener de [@BotFather](https://t.me/botfather))
2. **Base de datos PostgreSQL** (Railway proporciona una)
3. **Cuenta en Railway** ([railway.app](https://railway.app))
4. **Cloudflare R2** (para almacenamiento de documentos)
5. **Node.js 18+** (para desarrollo local)

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
   
   # Cloudflare R2 (OPCIONAL - para almacenamiento de documentos)
   railway variables set R2_ACCOUNT_ID=tu_account_id
   railway variables set R2_ACCESS_KEY_ID=tu_access_key
   railway variables set R2_SECRET_ACCESS_KEY=tu_secret_key
   railway variables set R2_BUCKET_NAME=tu_bucket_name
   
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
   
   # Cloudflare R2 (opcional)
   R2_ACCOUNT_ID=tu_account_id
   R2_ACCESS_KEY_ID=tu_access_key
   R2_SECRET_ACCESS_KEY=tu_secret_key
   R2_BUCKET_NAME=tu_bucket_name
   
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
   - `/start` - Menú principal con estructura reorganizada
   - 🚛 **Registrar carga** - Nueva carga de combustible
   - 🕐 **Turnos** - Sistema de turnos (inicio/fin de día)
   - 📊 **Consultas** - Saldo pendiente, buscar notas, reportes (admins)
   - 🔧 **Administración** (solo admins) - Gestión de unidades y registros CRUD

### ⭐ Nuevas Funciones CRUD para Administradores

#### Gestión Completa de Registros
1. **Acceder**: `/start` → 🔧 **Administración** → 📝 **Gestionar registros**
2. **Buscar**: Ingresa número de nota (búsqueda exacta)
3. **Editar**: Selecciona campo a modificar:
   - 📏 **Kilómetros** - Validación numérica
   - 💧 **Litros** - Recálculo automático de monto
   - 💰 **Precio por litro** - Recálculo automático de monto
   - ⛽ **Tipo de combustible** - GAS, GASOLINA, DIESEL
   - 📝 **Número de nota** - Validación de unicidad
   - 💳 **Estado de pago** - Lógica inteligente (solo opción contraria)
4. **Eliminar**: Confirmación con información detallada

#### Búsqueda de Notas Mejorada
- **Acceso universal**: 📊 **Consultas** → 🔍 **Buscar nota**
- **Información completa**: Muestra todos los datos independiente del estado de pago
- **Descarga de documentos**: Botón automático cuando hay ticket guardado
- **URLs firmadas**: Acceso seguro con enlaces temporales

### Flujo de Trabajo Típico

1. **Registrar unidades**: Primero registra los operadores y sus unidades
2. **Iniciar turno**: Registra kilometraje inicial para el día (opcional)
3. **Cargar combustible**: Selecciona unidad → ingresa datos → opcionalmente kilómetros y precio → confirma
4. **Finalizar turno**: Registra kilometraje final del día (opcional)
5. **Gestionar pagos**: 📊 Consultas → 🔍 Buscar nota → marca como pagada
6. **Gestión administrativa**: 🔧 Administración → 📝 Gestionar registros → editar/eliminar
7. **Generar reportes**: 📊 Consultas → 📊 Generar reporte → aplicar filtros → descargar PDF/Excel

## 🗄️ Estructura de la Base de Datos

```mermaid
erDiagram
    Tenant ||--o{ Unit : tiene
    Tenant ||--o{ Fuel : tiene
    Tenant ||--o{ KilometerLog : registra
    Tenant ||--o{ FileStorage : almacena
    Tenant ||--|| TenantSettings : configura
    Unit ||--o{ Fuel : recibe
    Unit ||--o{ KilometerLog : registra
    
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
        decimal kilometers
        decimal pricePerLiter
        enum fuelType
        string saleNumber
        enum paymentStatus
        datetime recordDate
        boolean isActive
    }
    
    KilometerLog {
        string id PK
        string tenantId FK
        string unitId FK
        decimal kilometers
        enum logType
        date logDate
        datetime logTime
        string userId
        boolean isOmitted
    }
    
    FileStorage {
        string id PK
        string tenantId FK
        string relatedId
        string relatedType
        string fileName
        string storageKey
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

### Sistema de Almacenamiento
- **Cloudflare R2**: Almacenamiento principal para tickets y documentos
- **URLs firmadas**: Acceso temporal y seguro a archivos
- **Backup automático**: Respaldo periódico en múltiples ubicaciones
- **Fallback local**: Sistema de respaldo si R2 no está disponible

### Límites y Escalamiento
- Railway tiene límites en el plan gratuito
- Cloudflare R2 incluye 10GB gratuitos mensuales
- Monitorea el uso de recursos desde los dashboards
- Considera actualizar planes para producción

### Seguridad
- Nunca compartas el token del bot
- Mantén actualizados los IDs de administradores
- Revisa regularmente los logs de acceso
- Las claves de R2 deben mantenerse seguras
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

### Problemas con archivos/storage
1. Verificar configuración R2: `railway variables | grep R2`
2. Revisar logs de storageService
3. Comprobar permisos del bucket

### Problemas con CRUD de administradores
1. Verificar permisos de administrador
2. Revisar estado de conversación en logs
3. Confirmar que el registro existe y está activo

## 🤝 Soporte

Para soporte técnico o preguntas:
1. Revisar logs del sistema
2. Consultar documentación de desarrollo en `/docs`
3. Verificar roadmap de implementación
4. Abrir issue en el repositorio

## 📄 Licencia

Este proyecto está bajo licencia MIT. Ver archivo [LICENSE](LICENSE) para más detalles.

---

**Última actualización**: 1 de Julio 2025
**Versión**: 2.2.0 (Sistema CRUD Completo)

## 🔧 Mejoras Recientes

### 01/07/2025 - v2.2.0 - Sistema CRUD Completo para Administradores ⭐
- **🔧 Reorganización completa de menús**: Estructura jerárquica intuitiva con submenús especializados
- **📝 Sistema CRUD 100% funcional**: Edición completa de registros de combustible por administradores
- **🔍 Búsqueda exacta mejorada**: Localización precisa de registros sin coincidencias parciales
- **✏️ Edición de todos los campos**: Kilómetros, litros, precio por litro, tipo, nota, estado de pago
- **♻️ Recálculo automático**: Monto se actualiza automáticamente (litros × precio por litro)
- **🗑️ Eliminación segura**: Confirmación detallada con desactivación lógica
- **💾 Integración con storage**: Descarga de documentos respaldados con URLs firmadas
- **🔐 Control de acceso granular**: Funciones administrativas limitadas a usuarios autorizados
- **🎯 Validaciones robustas**: Tipos de datos, enum correctos, estados de conversación
- **📱 Interfaz mejorada**: Navegación fluida sin errores de parsing
- **📋 Documentación completa**: Roadmap detallado y casos de uso documentados
- **🏗️ Arquitectura modular**: Controladores especializados y comandos organizados

#### Nuevos Menús:
```
📊 CONSULTAS (todos los usuarios):
├── 💰 Saldo pendiente
├── 🔍 Buscar nota (con descarga de documentos)
└── 📊 Generar reporte [Solo Admin]

🔧 ADMINISTRACIÓN (solo administradores):
├── 👁️ Gestionar unidades
└── 📝 Gestionar registros [NUEVO CRUD COMPLETO]
    ├── 🔍 Búsqueda exacta por número de nota
    ├── ✏️ Edición completa de campos
    ├── 🗑️ Eliminación con confirmación
    └── ♻️ Recálculo automático de montos
```

#### Nuevos Archivos:
- `src/controllers/gestionRegistrosController.js` - Controlador CRUD completo
- `src/commands/fuel/gestion.command.js` - Comandos de gestión administrativa
- `docs/crud-admins/` - Documentación completa del sistema

### 30/06/2025 - v2.1.0 - Sistema de Kilómetros ⭐
- **📏 Sistema completo de kilómetros**: Registro opcional de kilometraje en cargas de combustible
- **🔄 Sistema de turnos**: Inicio/fin de día con registro automático de kilómetros
- **💰 Cálculo automático**: Monto = litros × precio por litro cuando se especifica precio
- **🔍 Validación inteligente**: Prevención de retrocesos en kilometraje con búsqueda híbrida
- **📊 Reportes mejorados**: Columnas de kilómetros y precio por litro en PDF y Excel
- **🗄️ Nueva tabla KilometerLog**: Sistema de tracking de turnos con restricciones únicas
- **📋 Documentación completa**: Sistema implementado en 8 fases con documentación detallada

### 31/05/2025 - v2.0.2
- **🔄 Corrección de contexto en registros progresivos**: Solucionado problema que requería reiniciar el bot entre cargas consecutivas
- **🔢 Ampliación de números de venta**: Soporte para números de venta de 1 a 10 dígitos (anteriormente 6)
- **✅ Validación de folios únicos**: Implementada verificación de números de venta duplicados con manejo de errores mejorado
- **🔧 Preservación de datos de sesión**: Mantenimiento inteligente de información de unidad para registros consecutivos

### 31/05/2025 - v2.0.1
- **⛽ Nuevo tipo de combustible**: Agregado Diésel como tercer tipo de combustible, ampliando las opciones de registro y reportes
- **📷 Manejo mejorado de fotos de tickets**: Corregido el funcionamiento del botón de omitir foto y separado el manejador de fotografías para mayor robustez
- **📊 Optimización de reportes**: Corregido el filtrado de registros desactivados en reportes para que no aparezcan en ninguna consulta (aplicando filtro isActive directamente en la consulta SQL)

## 🚀 Estado de Desarrollo

### ✅ Completado (FASES 0-3):
- [x] Reorganización completa de menús
- [x] Integración con sistema de storage R2
- [x] Sistema CRUD 100% funcional para registros de combustible
- [x] Control de acceso por roles
- [x] Búsqueda exacta y edición completa de campos

### 🔄 En Progreso:
- **FASE 4**: Sistema CRUD para registros de kilómetros
- **FASE 5**: Sistema de auditoría y logs
- **FASE 6**: Testing integral
- **FASE 7**: Deploy a producción

### 📋 Próximos Hitos:
- **Julio 2-4**: Completar CRUD de kilómetros
- **Julio 5-7**: Sistema de auditoría
- **Julio 8-9**: Testing integral
- **Julio 10**: Deploy final

**Rama de desarrollo**: `feature/crud-admins-reorganization`
**Estado**: Sistema CRUD funcional al 100% - Listo para continuar con FASE 4