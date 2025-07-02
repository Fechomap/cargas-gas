// src/utils/admin.js
import { logger } from './logger.js';

/**
 * Valida si un usuario es administrador
 * @param {string} userId - ID del usuario
 * @returns {Promise<boolean>} - True si es admin, false en caso contrario
 */
export async function isAdminUser(userId) {
  if (!userId) return false;

  // Lista de IDs de administradores (considerando ambas variables de entorno)
  const adminIds = process.env.ADMIN_USER_IDS
    ? process.env.ADMIN_USER_IDS.split(',').map(id => id.trim())
    : process.env.BOT_ADMIN_IDS
      ? process.env.BOT_ADMIN_IDS.split(',').map(id => id.trim())
      : [];

  const isAdmin = adminIds.includes(userId.toString());
  logger.debug(`Verificando si usuario ${userId} es admin: ${isAdmin}`);

  return isAdmin;
}