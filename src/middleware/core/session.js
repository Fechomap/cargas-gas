// src/middleware/core/session.js
import { logger } from '../../utils/logger.js';

/**
 * Middleware para gestión robusta de sesiones
 * @param {Telegraf} bot - Instancia del bot de Telegraf
 */
export function setupSessionMiddleware(bot) {
  // Middleware para inicializar y validar la estructura de la sesión
  bot.use((ctx, next) => {
    try {
      // Inicializar sesión si no existe
      if (!ctx.session) {
        ctx.session = createDefaultSession();
        logger.debug('Sesión inicializada con valores por defecto');
      } else {
        // Validar y reparar la estructura de la sesión si es necesario
        ctx.session = validateAndRepairSession(ctx.session);
      }
      
      // Continuar con el siguiente middleware
      return next();
    } catch (error) {
      logger.error(`Error en middleware de sesión: ${error.message}`, {
        error: error.stack,
        session: ctx.session
      });
      
      // Reiniciar la sesión en caso de error grave
      ctx.session = createDefaultSession();
      logger.info('Sesión reiniciada debido a error');
      
      // Continuar con el siguiente middleware
      return next();
    }
  });
}

/**
 * Crea una sesión con estructura por defecto
 * @returns {Object} Sesión con estructura por defecto
 */
function createDefaultSession() {
  return {
    state: 'idle',
    data: {},
    lastInteraction: Date.now(),
    history: [],
    currentForm: null,
    pendingActions: []
  };
}

/**
 * Valida y repara la estructura de la sesión
 * @param {Object} session - Sesión a validar
 * @returns {Object} Sesión validada y reparada
 */
function validateAndRepairSession(session) {
  const validatedSession = { ...createDefaultSession() };
  
  // Transferir propiedades válidas
  if (typeof session === 'object' && session !== null) {
    // Validar estado
    if (typeof session.state === 'string') {
      validatedSession.state = session.state;
    }
    
    // Validar datos
    if (typeof session.data === 'object' && session.data !== null) {
      validatedSession.data = session.data;
    }
    
    // Validar historial
    if (Array.isArray(session.history)) {
      validatedSession.history = session.history;
    }
    
    // Validar formulario actual
    if (session.currentForm !== undefined) {
      validatedSession.currentForm = session.currentForm;
    }
    
    // Validar acciones pendientes
    if (Array.isArray(session.pendingActions)) {
      validatedSession.pendingActions = session.pendingActions;
    }
  }
  
  // Actualizar timestamp de última interacción
  validatedSession.lastInteraction = Date.now();
  
  return validatedSession;
}
