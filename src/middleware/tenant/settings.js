// src/middleware/tenant/settings.js
import { logger } from '../../utils/logger.js';
import { TenantService } from '../../services/tenant.service.js';

/**
 * Middleware para cargar configuración de tenant
 * @param {Telegraf} bot - Instancia del bot de Telegraf
 */
export function setupTenantSettingsMiddleware(bot) {
  bot.use(withTenantSettings());
}

/**
 * Middleware para obtener y validar la configuración del tenant
 */
export function withTenantSettings() {
  return async (ctx, next) => {
    try {
      // Solo cargar configuración si hay un tenant en el contexto
      if (!ctx.tenant || ctx.isAdminMode) {
        // Si no hay tenant o estamos en modo admin, continuamos sin cargar settings
        return next();
      }

      // Obtener configuración del tenant
      const settings = await TenantService.getOrCreateSettings(ctx.tenant.id);

      // Validar estructura de la configuración
      const validatedSettings = validateTenantSettings(settings);

      // Agregar configuración al contexto
      ctx.tenantSettings = validatedSettings;

      logger.debug(`Configuración de tenant cargada: ${ctx.tenant.id}`);

      // Continuar con el siguiente middleware
      return next();
    } catch (error) {
      logger.error('Error en middleware de configuración de tenant:', {
        error: error.message,
        stack: error.stack,
        tenantId: ctx.tenant?.id,
        chatId: ctx.chat?.id,
        userId: ctx.from?.id
      });

      // No interrumpir el flujo por un error en configuración
      // En su lugar, usar configuración por defecto
      ctx.tenantSettings = getDefaultTenantSettings();
      logger.info(`Usando configuración por defecto para tenant: ${ctx.tenant?.id}`);

      // Continuar con el siguiente middleware
      return next();
    }
  };
}

/**
 * Valida la estructura de la configuración del tenant
 * @param {Object} settings - Configuración a validar
 * @returns {Object} Configuración validada
 */
function validateTenantSettings(settings) {
  // Si no hay configuración, devolver valores por defecto
  if (!settings) {
    return getDefaultTenantSettings();
  }

  const defaultSettings = getDefaultTenantSettings();
  const validatedSettings = { ...defaultSettings };

  // Transferir propiedades válidas
  if (typeof settings === 'object' && settings !== null) {
    // Validar límite de operadores
    if (typeof settings.unitLimit === 'number' && settings.unitLimit > 0) {
      validatedSettings.unitLimit = settings.unitLimit;
    }

    // Validar moneda
    if (typeof settings.currency === 'string' && settings.currency) {
      validatedSettings.currency = settings.currency;
    }

    // Validar zona horaria
    if (typeof settings.timezone === 'string' && settings.timezone) {
      validatedSettings.timezone = settings.timezone;
    }

    // Validar características habilitadas
    if (typeof settings.features === 'object' && settings.features !== null) {
      validatedSettings.features = {
        ...defaultSettings.features,
        ...Object.entries(settings.features)
          .filter(([_, value]) => typeof value === 'boolean')
          .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})
      };
    }

    // Transferir configuración de notificaciones si existe
    if (typeof settings.notifications === 'object' && settings.notifications !== null) {
      validatedSettings.notifications = {
        ...defaultSettings.notifications,
        ...Object.entries(settings.notifications)
          .filter(([_, value]) => typeof value === 'boolean')
          .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})
      };
    }
  }

  return validatedSettings;
}

/**
 * Obtiene la configuración por defecto para un tenant
 * @returns {Object} Configuración por defecto
 */
function getDefaultTenantSettings() {
  return {
    unitLimit: 10,
    currency: 'MXN',
    timezone: 'America/Mexico_City',
    features: {
      fuelTracking: true,
      reportGeneration: true,
      notifications: true,
      multipleOperators: true,
      exportData: true
    },
    notifications: {
      lowFuel: true,
      dailySummary: false,
      weeklyReport: true,
      unusualConsumption: true
    }
  };
}
