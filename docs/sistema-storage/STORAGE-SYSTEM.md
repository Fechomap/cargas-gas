# 📁 Sistema de Almacenamiento Persistente - cargas-GAS Bot

## 🎯 **Resumen**
Sistema de almacenamiento persistente implementado para el bot de cargas de combustible, utilizando **Cloudflare R2** como storage principal con fallback automático a almacenamiento local.

## ✨ **Características Principales**

### 🔧 **Tecnologías**
- **Storage Principal**: Cloudflare R2 (Compatible S3)
- **SDK**: AWS SDK v3 para Node.js
- **Fallback**: Almacenamiento local automático
- **Base de Datos**: PostgreSQL + Prisma ORM
- **URLs**: Firmadas con expiración configurable

### 🏗️ **Arquitectura**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Telegram Bot  │────▶│   Storage API   │────▶│   PostgreSQL    │
│                 │     │                 │     │   (Metadatos)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
            ┌─────────────────┐      ┌─────────────────┐
            │  Cloudflare R2  │      │   Local Cache   │
            │  (Principal)    │      │   (Fallback)    │
            └─────────────────┘      └─────────────────┘
```

## 📋 **Modelo de Datos**

### **Tabla FileStorage**
```sql
CREATE TABLE "FileStorage" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenantId    UUID NOT NULL REFERENCES "Tenant"(id),
  relatedId   UUID,              -- ID del registro relacionado
  relatedType VARCHAR NOT NULL,  -- 'fuel', 'audit', etc.
  fileName    VARCHAR NOT NULL,  -- Nombre original
  fileType    VARCHAR NOT NULL,  -- MIME type
  fileSize    INTEGER NOT NULL,  -- Tamaño en bytes
  storageKey  VARCHAR UNIQUE,    -- Clave en R2/ruta local
  uploadedBy  VARCHAR NOT NULL,  -- User ID
  isActive    BOOLEAN DEFAULT true,
  createdAt   TIMESTAMP DEFAULT now(),
  updatedAt   TIMESTAMP DEFAULT now()
);
```

### **Organización de Archivos**
```
Estructura en R2:
/tenant-uuid/
├── /2025/
│   ├── /06/                    # Mes
│   │   ├── /fuel/              # Tipo de documento
│   │   │   ├── timestamp_ticket_123.jpg
│   │   │   └── timestamp_factura_456.pdf
│   │   └── /audit/
│   │       └── timestamp_documento.pdf
│   └── /07/
│       └── /fuel/
```

## 🚀 **API del StorageService**

### **Métodos Principales**

#### **saveFile(buffer, metadata)**
Guarda un archivo con metadatos completos.
```javascript
const result = await storageService.saveFile(buffer, {
  tenantId: 'uuid',
  relatedType: 'fuel',
  fileName: 'ticket.jpg',
  uploadedBy: 'user-id',
  relatedId: 'fuel-id' // opcional
});
// Retorna: { id, storageKey, isR2Storage, fileSize, fileType }
```

#### **savePhotoFromTelegram(ctx, fileId, metadata)**
Guarda foto directamente desde Telegram.
```javascript
const result = await storageService.savePhotoFromTelegram(ctx, fileId, {
  tenantId: ctx.tenant.id,
  relatedType: 'fuel',
  uploadedBy: ctx.from.id.toString()
});
```

#### **getSignedUrl(fileId, expiresIn)**
Genera URL firmada para acceso temporal.
```javascript
const url = await storageService.getSignedUrl(fileId, 3600); // 1 hora
```

#### **listFiles(tenantId, filters)**
Lista archivos por tenant con filtros.
```javascript
const files = await storageService.listFiles(tenantId, {
  relatedType: 'fuel',
  isActive: true
});
```

#### **deleteFile(fileId)**
Eliminación lógica (marca como inactivo).
```javascript
await storageService.deleteFile(fileId);
```

## ⚙️ **Configuración**

### **Variables de Entorno**
```bash
# Cloudflare R2 Storage
R2_ENDPOINT=https://account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=cargas-gas-storage
R2_REGION=auto
```

### **Dependencias NPM**
```json
{
  "@aws-sdk/client-s3": "^3.840.0",
  "@aws-sdk/s3-request-presigner": "^3.840.0", 
  "mime-types": "^3.0.1"
}
```

## 🔄 **Sistema de Fallback**

### **Detección Automática**
```javascript
// El sistema verifica automáticamente:
1. Variables de entorno R2 configuradas
2. Conectividad con R2
3. En caso de error, usa almacenamiento local

// Logs indican el storage utilizado:
"Archivo subido a R2: tenant/path/file.jpg"
"R2 falló, usando fallback local: error-details"
```

### **Compatibilidad**
- Mantiene compatibilidad con sistema existente
- URLs funcionan tanto para R2 como local
- Metadatos se guardan independientemente del storage

## 🔐 **Seguridad**

### **Control de Acceso**
- URLs firmadas con expiración (default: 24h)
- Aislamiento por tenant automático
- Validación de permisos antes de generar URLs

### **Validaciones**
- Tipos MIME verificados
- Límites de tamaño configurables
- Prevención de path traversal
- Hash MD5 para integridad

## 📊 **Monitoreo y Logs**

### **Eventos Loggeados**
```javascript
// Configuración
"Storage Service inicializado. R2 disponible: true"

// Subidas exitosas
"Archivo subido a R2: tenant/path/file.jpg"
"Archivo guardado con ID: uuid, R2: true"

// Errores y fallback
"R2 falló, usando fallback local: error-message"
"Error al guardar archivo: details"

// Vinculación
"Archivo uuid vinculado al registro fuel-uuid"
```

### **Métricas Disponibles**
- Total de archivos por tenant
- Uso de storage en bytes
- Tasa de éxito/error R2
- Tiempo de upload promedio

## 🚨 **Troubleshooting**

### **Problemas Comunes**

#### **Error: "R2 no disponible"**
```bash
# Verificar variables de entorno
echo $R2_ENDPOINT
echo $R2_ACCESS_KEY_ID

# Verificar conectividad
curl -I $R2_ENDPOINT
```

#### **Error: "Foreign key constraint violated"**
```bash
# Verificar que el tenantId existe
SELECT id, companyName FROM "Tenant" WHERE id = 'tenant-uuid';
```

#### **Error: "Archivo no encontrado"**
```javascript
// Verificar en base de datos
const file = await prisma.fileStorage.findUnique({
  where: { id: 'file-uuid' }
});
```

### **Comandos de Diagnóstico**
```bash
# Ver archivos recientes
SELECT * FROM "FileStorage" ORDER BY "createdAt" DESC LIMIT 10;

# Estadísticas por tenant
SELECT "tenantId", COUNT(*), SUM("fileSize") 
FROM "FileStorage" 
WHERE "isActive" = true 
GROUP BY "tenantId";

# Verificar vinculaciones
SELECT fs.*, f."saleNumber" 
FROM "FileStorage" fs
JOIN "Fuel" f ON f.id = fs."relatedId"
WHERE fs."relatedType" = 'fuel'
ORDER BY fs."createdAt" DESC;
```

## 📈 **Costos y Escalabilidad**

### **Cloudflare R2 Pricing**
- **Storage**: $0.015/GB/mes
- **Operaciones Clase A**: $4.50/millón
- **Operaciones Clase B**: $0.36/millón  
- **Egreso**: $0 (ventaja principal)

### **Estimaciones**
- **50GB/mes**: ~$0.75
- **10,000 uploads/mes**: ~$0.45
- **Total estimado**: < $2 USD/mes

### **Escalabilidad**
- Soporte para múltiples tenants
- Crecimiento horizontal automático
- CDN global incluido con R2

## 🎯 **Roadmap Futuro**

### **Mejoras Planeadas**
- [ ] Integración con reportes (links directos)
- [ ] Vista previa de imágenes en bot
- [ ] Compresión automática de imágenes
- [ ] Migración de archivos legacy
- [ ] Dashboard de uso por tenant

### **Optimizaciones**
- [ ] Cache local para acceso frecuente
- [ ] Compresión antes de upload
- [ ] Limpieza automática de archivos antiguos
- [ ] Métricas de performance en tiempo real

---

**Documentación actualizada**: 01 Julio 2025  
**Versión del sistema**: 1.0.0  
**Estado**: ✅ Producción Ready