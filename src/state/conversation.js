// src/state/conversation.js
import { logger } from '../utils/logger.js';

/**
 * Actualiza el estado de la conversación en la sesión del usuario
 * @param {TelegrafContext} ctx - Contexto de Telegraf
 * @param {string} newState - Nuevo estado de la conversación
 * @param {Object} data - Datos a almacenar en la sesión (opcional)
 */
export async function updateConversationState(ctx, newState, data = null) {
  try {
    // Inicializar sesión si no existe
    if (!ctx.session) {
      logger.info(`Creando nueva sesión para usuario ${ctx.from?.id || 'desconocido'}`);
      ctx.session = {};
    }

    // Guardar estado anterior para logging
    const previousState = ctx.session.state || 'undefined';

    // Actualizar estado
    ctx.session.state = newState;
    logger.info(`Cambio de estado: ${previousState} -> ${newState} (Usuario: ${ctx.from?.id || 'desconocido'})`);

    // Si se proporcionan datos, actualizar o mantener los existentes
    if (data !== null) {
      ctx.session.data = data;
      logger.debug(`Datos actualizados: ${JSON.stringify(data)}`);
    } else if (!ctx.session.data) {
      ctx.session.data = {};
      logger.debug('Inicializados datos vacíos');
    }
  } catch (error) {
    logger.error(`Error al actualizar estado de conversación: ${error.message}`, error);
    // Intentar restablecer la sesión en caso de error
    ctx.session = { state: 'idle', data: {} };
    logger.info('Sesión restablecida a estado idle por error');
  }
}

/**
 * Comprueba si el estado actual coincide con alguno de los estados dados
 * @param {TelegrafContext} ctx - Contexto de Telegraf
 * @param {string|Array<string>} states - Estado o estados a comprobar
 * @returns {boolean} - True si el estado actual coincide con alguno de los dados
 */
export function isInState(ctx, states) {
  if (!ctx.session || !ctx.session.state) {
    return false;
  }

  if (Array.isArray(states)) {
    return states.includes(ctx.session.state);
  }

  return ctx.session.state === states;
}

/**
 * Limpia el estado de la conversación
 * @param {TelegrafContext} ctx - Contexto de Telegraf
 */
export async function clearConversationState(ctx) {
  try {
    ctx.session = { state: 'idle', data: {} };
    logger.debug(`Conversación ${ctx.from.id}: estado limpiado`);
  } catch (error) {
    logger.error(`Error al limpiar estado de conversación: ${error.message}`);
  }
}
// Al final del archivo conversation.js
// Función para depurar el estado actual
export function debugState(ctx) {
  if (!ctx.session) {
    logger.info('No hay sesión para este contexto');
    return;
  }

  logger.info(`Estado actual: ${ctx.session.state}`);
  if (ctx.session.data) {
    logger.info(`Datos en sesión: ${JSON.stringify(ctx.session.data, null, 2)}`);
  }
}