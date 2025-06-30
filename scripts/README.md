# 📋 SCRIPTS DEL PROYECTO

Documentación de scripts organizados para el mantenimiento del sistema de registro de cargas de combustible.

## 🗂️ **SCRIPTS DISPONIBLES**

### **💾 Scripts de Backup**

#### `backup-local-database.sh`
- **Propósito**: Crear backup completo de la base de datos LOCAL
- **Uso**: `./scripts/backup-local-database.sh`
- **Salida**: `/backups/gas_bot_backup_YYYYMMDD_HHMMSS.sql`
- **Características**:
  - Validación robusta del contenido
  - Verificación de tablas críticas
  - Reporte detallado del backup
  - Detección de archivos corruptos

#### `backup-production-database.sh`
- **Propósito**: Crear backup seguro de la base de datos de PRODUCCIÓN
- **Uso**: `./scripts/backup-production-database.sh`
- **Salida**: `/backups/production/production_gas_bot_backup_YYYYMMDD_HHMMSS.sql`
- **Características**:
  - ⚠️ **CRÍTICO**: Solo operaciones de lectura
  - Confirmación manual obligatoria
  - Validación previa de conectividad
  - Checksum SHA256 para integridad
  - Verificación de tablas críticas

### **🔄 Scripts de Sincronización**

#### `sync-prod-to-local-dev.sh` ⭐ **PRINCIPAL**
- **Propósito**: Sincronización inteligente prod → local configurada para desarrollo
- **Uso**: `./scripts/sync-prod-to-local-dev.sh`
- **Características**:
  - Importa datos reales de producción
  - Configura automáticamente chatId para desarrollo (`-4527368480`)
  - Actualiza esquema de Prisma automáticamente
  - Mantiene configuración de entorno local
  - Evita problemas de tenant no encontrado
  - **JAMÁS** modifica producción

### **🔍 Scripts de Verificación**

#### `verify-database-alignment.js`
- **Propósito**: Verificar alineación completa entre bases local y producción
- **Uso**: `node scripts/verify-database-alignment.js`
- **Salida**: 
  - Reporte en consola con estado detallado
  - Archivo JSON: `db-alignment-report.json`
- **Características**:
  - Comparación de conteos por tabla
  - Verificación de estructura de esquema
  - Análisis de datos de muestra
  - Estado de migraciones de Prisma
  - Exit codes apropiados (0=éxito, 1=problemas)

## 🚀 **FLUJO RECOMENDADO PARA DESARROLLO**

### **1. Preparación inicial del entorno**
```bash
# 1. Crear backup de producción (seguridad)
./scripts/backup-production-database.sh

# 2. Sincronizar datos con configuración de desarrollo
./scripts/sync-prod-to-local-dev.sh

# 3. Verificar que todo esté alineado
node scripts/verify-database-alignment.js
```

### **2. Desarrollo diario**
```bash
# Si necesitas datos frescos de producción
./scripts/sync-prod-to-local-dev.sh

# Si necesitas backup de tu trabajo local
./scripts/backup-local-database.sh
```

### **3. Antes de implementar cambios**
```bash
# Verificar estado antes de cambios
node scripts/verify-database-alignment.js

# Backup de seguridad
./scripts/backup-production-database.sh
```

## ⚠️ **REGLAS DE SEGURIDAD**

### **🔒 Protección de Producción**
1. **JAMÁS** ejecutar scripts contra producción sin confirmar
2. **SIEMPRE** verificar variables de entorno (.env) antes de ejecutar
3. **SOLO** scripts de backup pueden acceder a producción
4. **CONFIRMAR** que NODE_ENV=development antes de sincronizar

### **📁 Organización**
1. **TODOS** los scripts deben estar en `/scripts/`
2. **DOCUMENTAR** cualquier script nuevo en este README
3. **ELIMINAR** scripts obsoletos inmediatamente
4. **USAR** nombres descriptivos para scripts

### **🛡️ Buenas Prácticas**
1. **LEER** este README antes de usar cualquier script
2. **VERIFICAR** permisos de ejecución (`chmod +x`)
3. **REVISAR** logs de error en caso de fallos
4. **MANTENER** backups actualizados

## 🔍 **TROUBLESHOOTING**

### **Problemas comunes**

#### ❌ "Chat sin tenant registrado"
- **Causa**: ChatId no configurado para desarrollo
- **Solución**: Ejecutar `./scripts/sync-prod-to-local-dev.sh`

#### ❌ "Cannot connect to database"
- **Causa**: Base de datos local no iniciada
- **Solución**: Verificar PostgreSQL local activo

#### ❌ "Permission denied"
- **Causa**: Scripts sin permisos de ejecución
- **Solución**: `chmod +x scripts/*.sh`

#### ❌ "Backup file too small"
- **Causa**: Error en backup o base vacía
- **Solución**: Verificar conexión y contenido de base

## 📊 **ESTRUCTURA FINAL**

```
scripts/
├── README.md                        # 📋 Este archivo
├── backup-local-database.sh         # 💾 Backup local
├── backup-production-database.sh    # 💾 Backup producción
├── sync-prod-to-local-dev.sh       # 🔄 Sincronización principal
└── verify-database-alignment.js     # 🔍 Verificación de alineación
```

**Total: 4 scripts principales + documentación**

---

**Última actualización**: Junio 2025  
**Versión**: 2.0 - Scripts organizados y limpieza completa  
**Estado**: ✅ Producción-ready