// src/middleware/security/admin-check.js
import { logger } from '../../utils/logger.js';

/**
 * Middleware para verificar si un usuario es administrador del grupo de Telegram
 * @param {Telegraf} bot - Instancia del bot de Telegraf
 */
export function setupAdminCheckMiddleware(bot) {
  // Arreglo de acciones que requieren permisos de administrador
  const adminRequiredActions = [
    'search_fuel_records',  // Botón "Buscar para desactivar"
    'manage_units',         // Botón "Gestionar unidades"
    'deactivate_unit_menu'  // Botón "Desactivar unidad" dentro del menú de gestión
  ];

  // Middleware para verificar permisos de administrador en acciones específicas
  bot.use(async (ctx, next) => {
    try {
      // Solo procesar callbacks de botones
      if (!ctx.callbackQuery) {
        return next();
      }

      // Obtener la acción del callback
      const action = ctx.callbackQuery.data;
      
      // Verificar si la acción requiere permisos de administrador
      const requiresAdmin = adminRequiredActions.some(
        adminAction => action === adminAction || action.startsWith(`${adminAction}_`)
      );

      if (requiresAdmin) {
        logger.info(`Verificando permisos de administrador para acción: ${action}`);
        
        // Si es un chat privado, solo permitir a administradores del bot
        if (ctx.chat?.type === 'private') {
          const adminIds = process.env.BOT_ADMIN_IDS
            ? process.env.BOT_ADMIN_IDS.split(',').map(id => id.trim())
            : [];
          
          const isAdmin = adminIds.includes(ctx.from.id.toString());
          
          if (!isAdmin) {
            logger.warn(`Acceso denegado: ${ctx.from.id} intentó acción ${action} en chat privado sin ser admin`);
            await ctx.answerCbQuery('Solo los administradores pueden realizar esta acción.', { show_alert: true });
            return; // No continuar
          }
          
          // Si es admin, permitir
          return next();
        }
        
        // Para grupos, verificar si el usuario es administrador del grupo de Telegram
        if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
          try {
            // Obtener información del miembro en el chat
            const chatMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
            
            // Verificar si el status es 'creator' o 'administrator'
            const isGroupAdmin = 
              chatMember.status === 'creator' || 
              chatMember.status === 'administrator';
            
            if (!isGroupAdmin) {
              logger.warn(
                `Acceso denegado: ${ctx.from.id} (${ctx.from.username || 'sin username'}) ` +
                `intentó acción ${action} en grupo ${ctx.chat.id} sin ser admin. ` +
                `Status: ${chatMember.status}`
              );
              
              await ctx.answerCbQuery(
                'Esta acción solo puede ser realizada por administradores del grupo.', 
                { show_alert: true }
              );
              
              return; // No continuar
            }
            
            logger.info(
              `Acceso permitido: ${ctx.from.id} (${ctx.from.username || 'sin username'}) ` +
              `ejecutó acción ${action} como admin en grupo ${ctx.chat.id}`
            );
          } catch (error) {
            logger.error(`Error al verificar estado de administrador: ${error.message}`);
            await ctx.answerCbQuery(
              'No se pudo verificar tus permisos. Intenta más tarde.', 
              { show_alert: true }
            );
            return; // No continuar por seguridad
          }
        }
      }
      
      // Si llegamos aquí, el acceso está permitido
      return next();
    } catch (error) {
      logger.error('Error en middleware de verificación de administrador:', {
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
