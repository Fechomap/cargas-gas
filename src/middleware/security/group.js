// src/middleware/security/group.js
import { logger } from '../../utils/logger.js';

/**
 * Middleware para restricción de grupos
 * @param {Telegraf} bot - Instancia del bot de Telegraf
 */
export function setupGroupRestrictionMiddleware(bot) {
  // Obtener IDs de grupos permitidos desde variables de entorno
  const allowedGroupIds = process.env.ALLOWED_GROUP_IDS 
    ? process.env.ALLOWED_GROUP_IDS.split(',').map(id => Number(id.trim()))
    : [-1002411620798, -4527368480]; // IDs por defecto (los que estaban en el código original)
  
  // Middleware para restringir acceso solo a grupos específicos
  bot.use(async (ctx, next) => {
    try {
      // Verificar si es un comando de depuración o administración
      const messageText = ctx.message?.text || '';
      const isAdminCommand = messageText.startsWith('/debug_') || 
                              messageText.startsWith('/admin_') || 
                              messageText.startsWith('/aprobar_') || 
                              messageText.startsWith('/rechazar_') ||
                              messageText.startsWith('/aprobar') ||
                              messageText.startsWith('/rechazar');
      
      // Si es un chat privado y un comando de administración, permitir
      if (ctx.chat?.type === 'private' && isAdminCommand && await isAdminUser(ctx.from?.id)) {
        logger.info(`Comando administrativo permitido en chat privado: ${messageText}`);
        return next();
      }
      
      // Permitir comandos de registro en chats privados
      if (ctx.chat?.type === 'private' && (messageText.startsWith('/registrar') || messageText === '/start')) {
        logger.info(`Comando permitido en chat privado: ${messageText}`);
        return next();
      }
      
      // IMPORTANTE: Permitir comando /vincular en cualquier grupo
      // Este comando es necesario para activar nuevos grupos
      if ((ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') && 
          (messageText.startsWith('/vincular') || messageText.startsWith('/activar'))) {
        logger.info(`Permitiendo comando de vinculación en grupo: ${ctx.chat.id} - Comando: ${messageText}`);
        return next();
      }
      
      // Registrar información del chat para depuración
      if (ctx.chat) {
        logger.debug(`Chat info - ID: ${ctx.chat.id}, Tipo: ${ctx.chat.type}, Título: ${ctx.chat.title || 'N/A'}`);
      }
      
      // Verificar si es un grupo permitido por la lista estática o un chat privado con el bot
      const isAllowedStatically = ctx.chat && allowedGroupIds.includes(ctx.chat.id);
      const isPrivateChat = ctx.chat?.type === 'private';
      
      // Si no está permitido estáticamente y no es un chat privado, verificar si está vinculado a un tenant
      if (!isAllowedStatically && !isPrivateChat) {
        // Importar TenantService dinámicamente para evitar dependencias circulares
        const { TenantService } = await import('../../services/tenant.service.js');
        
        try {
          // Verificar si el grupo está vinculado a un tenant activo
          const linkedTenant = await TenantService.findTenantByChatId(ctx.chat.id.toString());
          
          if (linkedTenant && linkedTenant.isActive && linkedTenant.isApproved) {
            logger.info(`Grupo ${ctx.chat.id} permitido por estar vinculado al tenant: ${linkedTenant.companyName}`);
            return next();
          }
        } catch (error) {
          logger.error(`Error al verificar tenant vinculado: ${error.message}`);
        }
        
        logger.warn(`Acceso denegado - ID: ${ctx.chat?.id || 'desconocido'}, Tipo: ${ctx.chat?.type || 'desconocido'}`);
        return; // Bloquear silenciosamente
      }
      
      // Si llegamos aquí, el chat está permitido
      return next();
    } catch (error) {
      logger.error('Error en middleware de restricción de grupos:', {
        error: error.message,
        stack: error.stack,
        chatId: ctx.chat?.id,
        userId: ctx.from?.id
      });
      
      // En caso de error, no continuar (por seguridad)
      return;
    }
  });
}

/**
 * Verifica si un usuario es administrador
 * @param {string} userId - ID del usuario
 * @returns {Promise<boolean>} - True si es admin, false en caso contrario
 */
async function isAdminUser(userId) {
  if (!userId) return false;
  
  // Lista de IDs de administradores (usando ambas variables de entorno)
  const adminIds = process.env.ADMIN_USER_IDS 
    ? process.env.ADMIN_USER_IDS.split(',').map(id => id.trim())
    : process.env.BOT_ADMIN_IDS
      ? process.env.BOT_ADMIN_IDS.split(',').map(id => id.trim())
      : [];
  
  const isAdmin = adminIds.includes(userId.toString());
  logger.debug(`Usuario ${userId} ${isAdmin ? 'ES' : 'NO es'} administrador`);
  
  return isAdmin;
}
