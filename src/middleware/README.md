# Sistema de Middleware Robusto

## Descripción
Este directorio contiene la implementación de un sistema de middleware robusto y modular para el bot de Telegram. El sistema se ha diseñado para corregir problemas de manejo de errores, sesiones y validación de tenant, así como para mejorar la mantenibilidad y escalabilidad a largo plazo.

## Estructura

```
middleware/
  |- index.js            # Punto de entrada y configuración central
  |- adapter.js          # Adaptador para migración gradual
  |- core/               # Middlewares fundamentales
     |- error.js         # Manejo centralizado de errores
     |- session.js       # Gestión de sesiones
     |- logging.js       # Logging unificado
  |- tenant/             # Middlewares específicos para tenant
     |- validation.js    # Validación de tenant
     |- settings.js      # Configuración de tenant
  |- security/           # Middlewares de seguridad
     |- access.js        # Control de acceso
     |- group.js         # Restricción de grupos
  |- debug/              # Middlewares de depuración
     |- diagnostic.js    # Diagnóstico y monitoreo
```

## Uso

### Configuración básica
```javascript
import { setupMiddleware } from './src/middleware/index.js';

// En la inicialización del bot
setupMiddleware(bot, {
  enableDiagnostic: true,
  enableLogging: true,
  enableGroupRestriction: true,
  enableTenantValidation: true,
  enableTenantSettings: true
});
```

### Configuración parcial
```javascript
import { setupMiddleware } from './src/middleware/index.js';

// Solo habilitar middlewares específicos
setupMiddleware(bot, {
  enableDiagnostic: true,
  enableLogging: true,
  enableGroupRestriction: false, // Deshabilitar restricción de grupos
  enableTenantValidation: true,
  enableTenantSettings: false  // Deshabilitar configuración de tenant
});
```

## Soluciones implementadas

### 1. Manejo robusto de errores
- Middleware centralizado para capturar todos los errores
- Prevención de múltiples llamadas a `next()` en caso de error
- Registro detallado de errores con contexto completo

### 2. Validación de tenant mejorada
- Soporte para comandos de depuración sin validación de tenant
- Validación explícita de estructura y estado del tenant
- Manejo apropiado de casos de error

### 3. Sesiones con verificación de estructura
- Validación y reparación automática de la estructura de sesiones
- Valores por defecto para sesiones inexistentes o corruptas
- Prevención de errores por sesiones mal formadas

### 4. Sistema de diagnóstico avanzado
- Registro detallado de cada actualización
- Medición de tiempos de procesamiento
- Guardado de información de diagnóstico en archivos

## Migración desde el sistema anterior

Para facilitar la migración gradual desde el sistema anterior, se proporciona un adaptador en `adapter.js` que mantiene compatibilidad con las funciones antiguas:

```javascript
import { setupMiddleware_LEGACY } from './src/middleware/adapter.js';

// Usar en lugar de la función antigua
setupMiddleware_LEGACY(bot);
```

## Mantenimiento

Al añadir nuevos middlewares:
1. Crear un archivo en la subcarpeta correspondiente
2. Implementar la función de configuración con el formato `setup[Nombre]Middleware`
3. Exportar la función
4. Importar y configurar en `index.js`

## Variables de entorno utilizadas

- `NODE_ENV`: Entorno de ejecución (development, production)
- `ADMIN_USER_IDS`: IDs de usuarios administradores (separados por coma)
- `ALLOWED_GROUP_IDS`: IDs de grupos permitidos (separados por coma)
