# Requerimiento de Implementación - Sistema de Almacenamiento para Bot de Cargas de Combustible

## 📋 Resumen Ejecutivo

### Contexto del Proyecto
- **Sistema actual**: Bot de Telegram multi-tenant para registro de cargas de combustible
- **Estado**: En producción activa con múltiples clientes (Grúas Coapa, Empresa Jhonvc)
- **Infraestructura**: Railway (Node.js 18.x) + PostgreSQL + Telegraf
- **Problema actual**: Las fotos/documentos se guardan temporalmente sin persistencia real

### Objetivo Principal
Implementar un sistema de almacenamiento persistente y escalable para guardar de manera opcional:
- 📷 Fotos de tickets de combustible
- 📄 PDFs de facturas
- 🖼️ Capturas de pantalla
- 📑 Cualquier documento que respalde las operaciones de carga

---

## 🔍 Análisis del Estado Actual

### Arquitectura Existente

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Telegram Bot  │────▶│   Railway App   │────▶│   PostgreSQL    │
│   (Telegraf)    │     │   (Node.js)     │     │   (Prisma ORM)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │ Almacenamiento  │
                        │   Temporal      │
                        │  (No persiste)  │
                        └─────────────────┘
```

### Flujo Actual de Archivos

1. **Captura**: Usuario envía foto vía Telegram
2. **Recepción**: Bot recibe el `file_id` de Telegram
3. **Procesamiento**: `storageService.savePhotoFromTelegram()` maneja el archivo
4. **Almacenamiento**: Se guarda temporalmente (se pierde al reiniciar)
5. **Referencia**: URL se guarda en campo `ticketPhoto` de la tabla `Fuel`

### Limitaciones Identificadas

- ❌ **Sin persistencia real**: Archivos se pierden al reiniciar/redesplegar
- ❌ **Sin respaldo**: No hay backup de documentos importantes
- ❌ **Sin organización**: No hay estructura de carpetas por empresa/fecha
- ❌ **Sin metadatos**: No se guardan datos adicionales del archivo
- ❌ **Sin versionado**: No hay control de versiones de documentos
- ❌ **Límite de Railway**: Almacenamiento local muy limitado

---

## 🎯 Requerimientos Funcionales

### RF1: Almacenamiento de Archivos

- **RF1.1**: Soportar múltiples tipos de archivo
  - Imágenes: JPG, PNG, WEBP
  - Documentos: PDF
  - Límite de tamaño: 10MB por archivo

- **RF1.2**: Organización jerárquica
  ```
  /tenant-id/
  ├── /2025/
  │   ├── /01/
  │   │   ├── /fuel-records/
  │   │   │   ├── ticket-{fuel-id}-{timestamp}.jpg
  │   │   │   └── factura-{fuel-id}-{timestamp}.pdf
  │   │   └── /audit-docs/
  │   │       └── documento-{timestamp}.pdf
  ```

- **RF1.3**: Metadatos obligatorios
  - ID del tenant
  - ID del registro relacionado
  - Tipo de documento
  - Fecha de subida
  - Usuario que subió
  - Tamaño del archivo
  - Hash MD5 para integridad

### RF2: Gestión de Archivos

- **RF2.1**: Operaciones CRUD
  - Crear: Subir nuevo archivo
  - Leer: Obtener URL temporal de acceso
  - Actualizar: Reemplazar archivo existente
  - Eliminar: Borrado lógico (marcar como eliminado)

- **RF2.2**: URLs temporales de acceso
  - Generar URLs firmadas con expiración (24 horas)
  - Restringir acceso por tenant
  - Auditoría de accesos

### RF3: Integración con Sistema Actual

- **RF3.1**: Modificación mínima del flujo actual
- **RF3.2**: Compatibilidad con registros existentes
- **RF3.3**: Migración opcional de datos históricos
- **RF3.4**: Fallback si el storage falla

### RF4: Reportes y Consultas

- **RF4.1**: Incluir links a documentos en reportes PDF/Excel
- **RF4.2**: Vista de galería de documentos por carga
- **RF4.3**: Búsqueda de documentos por fecha/tipo

---

## 🔧 Requerimientos No Funcionales

### RNF1: Rendimiento
- Tiempo de subida < 3 segundos para archivos de 5MB
- Tiempo de descarga < 2 segundos
- Disponibilidad 99.9%

### RNF2: Seguridad
- Encriptación en tránsito (HTTPS)
- Encriptación en reposo
- Aislamiento por tenant (multi-tenancy)
- Logs de auditoría

### RNF3: Escalabilidad
- Soportar mínimo 10,000 archivos/mes
- Storage inicial: 50GB
- Crecimiento proyectado: 10GB/mes

### RNF4: Cumplimiento
- Retención de documentos: 5 años
- Cumplir con normativas fiscales mexicanas
- Respaldo automático diario

---

## 💡 Soluciones Recomendadas

### Opción 1: Cloudflare R2 (RECOMENDADA) ⭐

**Ventajas:**
- ✅ Compatible con S3 API
- ✅ Sin costo de egreso (bandwidth gratis)
- ✅ $0.015 USD/GB/mes
- ✅ Integración simple con Node.js
- ✅ CDN global incluido
- ✅ URLs firmadas nativas

**Implementación:**
```javascript
// Ejemplo de integración
import { S3Client } from '@aws-sdk/client-s3';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});
```

### Opción 2: Amazon S3

**Ventajas:**
- ✅ Más maduro y probado
- ✅ Excelente documentación
- ✅ Múltiples clases de storage

**Desventajas:**
- ❌ Costos de transferencia
- ❌ Más caro que R2
- ❌ Configuración más compleja

### Opción 3: DigitalOcean Spaces

**Ventajas:**
- ✅ Simple y directo
- ✅ $5 USD/mes incluye 250GB
- ✅ Compatible con S3

**Desventajas:**
- ❌ Menos features avanzados
- ❌ CDN limitado

---

## 🏗️ Arquitectura Propuesta

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Telegram Bot  │────▶│   Railway App   │────▶│   PostgreSQL    │
│   (Telegraf)    │     │   (Node.js)     │     │  (Metadatos)    │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Storage Service │
                        │   (Abstraction)  │
                        └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
            ┌─────────────────┐      ┌─────────────────┐
            │  Cloudflare R2  │      │   Local Cache   │
            │  (Persistent)   │      │   (Temporal)    │
            └─────────────────┘      └─────────────────┘
```

### Componentes Nuevos

1. **Storage Service Mejorado**
   ```javascript
   class StorageService {
     async saveFile(file, metadata)
     async getFileUrl(fileId, expiresIn)
     async deleteFile(fileId)
     async listFiles(tenantId, filters)
   }
   ```

2. **Tabla de Metadatos (Nueva)**
   ```prisma
   model FileStorage {
     id          String   @id @default(uuid())
     tenantId    String
     relatedId   String?  // fuel_id, etc
     relatedType String   // 'fuel', 'audit', etc
     fileName    String
     fileType    String
     fileSize    Int
     storageKey  String   @unique
     uploadedBy  String
     isActive    Boolean  @default(true)
     createdAt   DateTime @default(now())
     updatedAt   DateTime @updatedAt
   }
   ```

---

## 📅 Plan de Implementación

### Fase 1: Preparación (3 días)

**1.1 Configuración de Infraestructura**
- [ ] Crear cuenta en Cloudflare R2
- [ ] Configurar bucket con políticas de acceso
- [ ] Generar credenciales API
- [ ] Configurar variables de entorno en Railway

**1.2 Actualización de Base de Datos**
- [ ] Crear migración para tabla `FileStorage`
- [ ] Actualizar modelos de Prisma
- [ ] Generar cliente actualizado

**1.3 Desarrollo del Storage Service**
- [ ] Implementar abstracción del servicio
- [ ] Crear métodos CRUD
- [ ] Implementar generación de URLs firmadas
- [ ] Agregar manejo de errores y retry logic

### Fase 2: Integración (4 días)

**2.1 Modificar Flujo de Registro**
- [ ] Actualizar `handleTicketPhoto()` para usar nuevo servicio
- [ ] Mantener compatibilidad con campo `ticketPhoto`
- [ ] Agregar guardado de metadatos
- [ ] Implementar validaciones de tipo/tamaño

**2.2 Sistema de Fallback**
- [ ] Detectar si storage externo está disponible
- [ ] Fallback a almacenamiento temporal si falla
- [ ] Notificación a administradores si hay fallas

**2.3 Actualizar Reportes**
- [ ] Incluir links a documentos en PDFs
- [ ] Agregar columna de "Ver documento" en Excel
- [ ] Implementar vista previa en bot

### Fase 3: Migración y Testing (3 días)

**3.1 Migración de Datos (Opcional)**
- [ ] Script para migrar fotos existentes
- [ ] Validar integridad post-migración
- [ ] Actualizar referencias en BD

**3.2 Testing Exhaustivo**
- [ ] Pruebas unitarias del storage service
- [ ] Pruebas de integración end-to-end
- [ ] Pruebas de carga (subir múltiples archivos)
- [ ] Pruebas de recuperación ante fallas

**3.3 Documentación**
- [ ] Actualizar README con nueva funcionalidad
- [ ] Crear guía de usuario para nueva feature
- [ ] Documentar API del storage service

### Fase 4: Despliegue (2 días)

**4.1 Despliegue Gradual**
- [ ] Deploy en ambiente de staging
- [ ] Pruebas con usuarios beta
- [ ] Monitoreo de métricas
- [ ] Deploy a producción

**4.2 Monitoreo Post-Deploy**
- [ ] Verificar uploads funcionando
- [ ] Revisar logs de errores
- [ ] Confirmar respaldos automáticos
- [ ] Validar costos de storage

---

## 💰 Estimación de Costos

### Cloudflare R2 (Recomendado)

**Costos Mensuales:**
- Almacenamiento: $0.015/GB × 50GB = $0.75 USD
- Operaciones Clase A: $4.50/millón × 0.1 = $0.45 USD
- Operaciones Clase B: $0.36/millón × 0.5 = $0.18 USD
- **Egreso: $0** (gran ventaja)
- **Total estimado: < $2 USD/mes inicial**

**Proyección Anual:**
- Año 1: ~$50 USD
- Año 2: ~$150 USD (con crecimiento)

### Comparación con Alternativas

| Servicio | Storage/mes | Egreso/mes | Total/mes |
|----------|------------|------------|-----------|
| R2       | $0.75      | $0         | $0.75     |
| S3       | $1.15      | $4.50      | $5.65     |
| Spaces   | $5.00      | Incluido   | $5.00     |

---

## 🔐 Consideraciones de Seguridad

### 1. Control de Acceso
```javascript
// Validar permisos antes de generar URL
async getSecureUrl(fileId, userId, tenantId) {
  // Verificar que usuario pertenece al tenant
  // Verificar que archivo pertenece al tenant
  // Generar URL con expiración corta
}
```

### 2. Validación de Archivos
- Verificar tipo MIME real (no solo extensión)
- Escaneo antivirus (opcional pero recomendado)
- Límites estrictos de tamaño
- Prevención de path traversal

### 3. Auditoría
- Log de todos los accesos a archivos
- Registro de IPs y user agents
- Alertas por accesos sospechosos

---

## 📊 Métricas de Éxito

### KPIs Técnicos
- Uptime del servicio: > 99.9%
- Tiempo promedio de upload: < 3s
- Tasa de error: < 0.1%
- Uso de storage: Dentro del presupuesto

### KPIs de Negocio
- Adopción: > 80% de cargas con documento
- Satisfacción: Reducción de consultas sobre documentos perdidos
- Cumplimiento: 100% de documentos disponibles para auditoría

---

## 🚨 Riesgos y Mitigaciones

### Riesgo 1: Falla del Servicio Externo
- **Mitigación**: Sistema de fallback local + alertas

### Riesgo 2: Costos Excesivos
- **Mitigación**: Alertas de uso + límites por tenant

### Riesgo 3: Pérdida de Datos
- **Mitigación**: Respaldos automáticos + replicación

### Riesgo 4: Problemas de Performance
- **Mitigación**: CDN + caché local + uploads asíncronos

---

## 📝 Checklist de Entrega

### Para Desarrolladores
- [ ] Código implementado y probado
- [ ] Documentación técnica completa
- [ ] Scripts de migración listos
- [ ] Variables de entorno documentadas
- [ ] Pruebas automatizadas pasando

### Para Operaciones
- [ ] Cuentas de servicios creadas
- [ ] Monitoreo configurado
- [ ] Respaldos automáticos activos
- [ ] Runbook de troubleshooting

### Para Usuarios
- [ ] Guía de uso actualizada
- [ ] Notificación de nueva funcionalidad
- [ ] Soporte para dudas

---

## 🎯 Siguiente Paso Inmediato

1. **Aprobar la solución**: Confirmar Cloudflare R2 como opción
2. **Crear cuenta**: Configurar Cloudflare y obtener credenciales
3. **Ambiente de pruebas**: Configurar bucket de desarrollo
4. **Iniciar Fase 1**: Comenzar con la implementación

---

**Documento preparado para**: Equipo de Desarrollo - Bot de Cargas de Combustible  
**Fecha**: Junio 30, 2025  
**Versión**: 1.0  
**Estado**: Pendiente de Aprobación