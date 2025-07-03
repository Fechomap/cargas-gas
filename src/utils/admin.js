// src/utils/admin.js
import { logger } from './logger.js';

/**
 * Valida si un usuario es administrador del bot (super admin)
 * @param {string} userId - ID del usuario
 * @returns {Promise<boolean>} - True si es admin del bot, false en caso contrario
 */
export async function isBotAdmin(userId) {
  if (!userId) return false;

  // Lista de IDs de administradores (considerando ambas variables de entorno)
  const adminIds = process.env.ADMIN_USER_IDS
    ? process.env.ADMIN_USER_IDS.split(',').map(id => id.trim())
    : process.env.BOT_ADMIN_IDS
      ? process.env.BOT_ADMIN_IDS.split(',').map(id => id.trim())
      : [];

  const isAdmin = adminIds.includes(userId.toString());
  logger.debug(`Verificando si usuario ${userId} es bot admin: ${isAdmin}`);

  return isAdmin;
}

/**
 * Valida si un usuario es administrador de Telegram en un grupo
 * @param {Object} ctx - Contexto de Telegraf
 * @param {string} userId - ID del usuario
 * @returns {Promise<boolean>} - True si es admin del grupo, false en caso contrario
 */
export async function isTelegramAdmin(ctx, userId) {
  if (!userId || !ctx.chat) return false;

  // En chats privados, no aplica la verificación de admin de Telegram
  if (ctx.chat.type === 'private') {
    return false;
  }

  // Para grupos, verificar si el usuario es administrador del grupo de Telegram
  if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
    try {
      // Obtener información del miembro en el chat
      const chatMember = await ctx.telegram.getChatMember(ctx.chat.id, userId);

      // Verificar si el status es 'creator' o 'administrator'
      const isGroupAdmin = chatMember.status === 'creator' || chatMember.status === 'administrator';

      logger.debug(`Verificando si usuario ${userId} es admin del grupo ${ctx.chat.id}: ${isGroupAdmin} (status: ${chatMember.status})`);

      return isGroupAdmin;
    } catch (error) {
      logger.error(`Error al verificar estado de administrador en grupo: ${error.message}`);
      return false;
    }
  }

  return false;
}

/**
 * Valida si un usuario es administrador (bot admin O admin de Telegram)
 * @param {string} userId - ID del usuario
 * @param {Object} ctx - Contexto de Telegraf (opcional, para verificar admin de Telegram)
 * @returns {Promise<boolean>} - True si es admin, false en caso contrario
 */
export async function isAdminUser(userId, ctx = null) {
  if (!userId) return false;

  // Verificar si es admin del bot (super admin)
  const isBotAdminUser = await isBotAdmin(userId);

  // Si es admin del bot, tiene todos los permisos
  if (isBotAdminUser) {
    logger.debug(`Usuario ${userId} es super admin del bot`);
    return true;
  }

  // Si no hay contexto, solo verificar bot admin
  if (!ctx) {
    return false;
  }

  // Verificar si es admin de Telegram del grupo
  const isTelegramAdminUser = await isTelegramAdmin(ctx, userId);

  logger.debug(`Usuario ${userId} - Bot admin: ${isBotAdminUser}, Telegram admin: ${isTelegramAdminUser}`);

  return isTelegramAdminUser;
}