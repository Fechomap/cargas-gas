// src/middleware/tenant/validation.js
import { logger } from '../../utils/logger.js';
import { TenantService } from '../../services/tenant.service.js';
import { isAdminUser } from '../../utils/admin.js';

/**
 * Middleware para validación de tenant
 * @param {Telegraf} bot - Instancia del bot de Telegraf
 */
export function setupTenantValidationMiddleware(bot) {
  bot.use(withTenant());
}

/**
 * Middleware para obtener y validar el tenant asociado a un chat
 */
export function withTenant() {
  return async (ctx, next) => {
    // Añadir una bandera para evitar procesamiento múltiple
    if (ctx.__tenantProcessed) {
      logger.debug('Contexto ya procesado por middleware de tenant, continuando...');
      return next();
    }

    // Marcar como procesado
    ctx.__tenantProcessed = true;

    try {
      // Lista de comandos que pueden ejecutarse sin validación de tenant
      const bypassCommands = ['/start', '/registrar', '/ayuda', '/help', '/registrar_empresa'];
      const adminCommands = ['/debug_', '/admin_', '/solicitudes', '/aprobar', '/rechazar'];

      // Comandos para el sistema de registro multi-tenant
      const registrationCommands = ['/registrar_empresa', '/vincular', '/activar'];

      // Callbacks especiales que no requieren validación de tenant
      const bypassCallbacks = ['start_registration', 'main_menu'];

      // Verificar si es un comando especial que no requiere validación
      const messageText = ctx.message?.text || '';

      // Verificar si es un chat privado (uno a uno con el bot)
      const isPrivateChat = ctx.chat?.type === 'private';

      // Permitir comandos administrativos en cualquier contexto si el usuario es admin
      if ((adminCommands.some(cmd => messageText.startsWith(cmd)) ||
           messageText.startsWith('/aprobar') ||
           messageText.startsWith('/rechazar')) &&
          await isAdminUser(ctx.from?.id, ctx)) {
        logger.info(`Comando administrativo detectado: ${messageText} - Usuario admin: ${ctx.from?.id}`);
        ctx.isAdminMode = true;
        return next();
      }

      // Permitir todos los comandos para administradores en chat privado
      if (isPrivateChat && await isAdminUser(ctx.from?.id, ctx)) {
        logger.info(`Permitiendo comando en chat privado para admin: ${messageText}`);
        return next();
      }

      // Permitir comandos básicos sin validación
      if (bypassCommands.some(cmd => messageText === cmd)) {
        logger.debug(`Comando sin validación de tenant: ${messageText}`);
        return next();
      }

      // Permitir comandos del sistema de registro
      if (registrationCommands.some(cmd => messageText.startsWith(cmd))) {
        logger.debug(`Comando de registro permitido sin tenant: ${messageText}`);
        return next();
      }

      // MOVER AQUÍ: Permitir callbacks especiales SIEMPRE (independientemente de tenant)
      if (ctx.callbackQuery && bypassCallbacks.includes(ctx.callbackQuery.data)) {
        logger.debug(`Permitiendo callback especial: ${ctx.callbackQuery.data}`);
        return next();
      }

      // Obtener chatId
      const chatId = ctx.chat?.id?.toString();
      if (!chatId) {
        logger.warn('No se pudo identificar el chat');
        await ctx.reply('Error: No se pudo identificar el chat.');
        return; // No continuar
      }

      // Permitir todos los mensajes si estamos en un proceso de registro
      // Verificar si hay un estado de registro activo en la sesión
      if (ctx.session?.state?.startsWith('register_company_')) {
        logger.debug(`Permitiendo mensaje para proceso de registro activo: ${ctx.session.state}`);
        return next();
      }

      // Buscar tenant asociado al chatId
      const tenant = await TenantService.findTenantByChatId(chatId);

      // Validar existencia del tenant
      if (!tenant) {
        logger.info(`Chat sin tenant registrado: ${chatId}`);

        // Si es un comando de registro o relacionado, permitir
        if (messageText.startsWith('/registrar') ||
            messageText.startsWith('/vincular') ||
            registrationCommands.some(cmd => messageText.startsWith(cmd))) {
          logger.debug(`Permitiendo comando relacionado con registro: ${messageText}`);
          return next();
        }

        await ctx.reply('Este grupo no está registrado. Utilice /registrar para iniciar el proceso de registro.');
        return; // No continuar
      }

      // Verificar si el tenant está activo
      if (!tenant.isActive) {
        logger.warn(`Intento de acceso a tenant inactivo: ${tenant.id}`);
        await ctx.reply('Esta empresa no tiene una suscripción activa. Por favor contacte al administrador.');
        return; // No continuar
      }

      // Verificar si el tenant está aprobado
      if (tenant.isApproved === false) {
        logger.warn(`Intento de acceso a tenant no aprobado: ${tenant.id}`);
        await ctx.reply('El registro de esta empresa está pendiente de aprobación. Por favor, espere la confirmación del administrador.');
        return; // No continuar
      }

      // Validar estructura del tenant
      validateTenantStructure(tenant);

      // Si llegamos aquí, el tenant es válido
      logger.debug(`Tenant válido: ${tenant.id} (${tenant.companyName})`);
      ctx.tenant = tenant;

      // Continuar con el siguiente middleware
      return next();

    } catch (error) {
      logger.error('Error en middleware de validación de tenant:', {
        error: error.message,
        stack: error.stack,
        chatId: ctx.chat?.id,
        userId: ctx.from?.id
      });

      await ctx.reply('Error al procesar la información de la empresa. Por favor, intente nuevamente.');
      // No llamar a next() para evitar errores en cascada
    }
  };
}


/**
 * Valida la estructura del tenant
 * @param {Object} tenant - Objeto tenant a validar
 * @throws {Error} Si la estructura es inválida
 */
function validateTenantStructure(tenant) {
  // Verificar campos requeridos
  const requiredFields = ['id', 'companyName', 'chatId', 'isActive'];
  for (const field of requiredFields) {
    if (tenant[field] === undefined) {
      throw new Error(`Campo requerido faltante en tenant: ${field}`);
    }
  }

  // Verificar tipos de datos
  if (typeof tenant.isActive !== 'boolean') {
    tenant.isActive = Boolean(tenant.isActive);
  }

  // Devolver tenant validado
  return tenant;
}
