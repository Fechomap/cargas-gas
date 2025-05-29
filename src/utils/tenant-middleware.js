// src/utils/tenant-middleware.js
import { TenantService } from '../services/tenant.service.js';

/**
 * Middleware para obtener el tenant asociado a un chat de Telegram
 * y agregarlo al contexto
 */
export async function withTenant(ctx, next) {
  try {
    // Obtener el chatId del contexto de Telegram
    const chatId = ctx.chat?.id?.toString();
    
    if (!chatId) {
      ctx.reply('Error: No se pudo identificar el chat.');
      return;
    }
    
    // Buscar tenant asociado al chatId
    const tenant = await TenantService.findTenantByChatId(chatId);
    
    // Si no existe el tenant, crear uno nuevo
    if (!tenant) {
      const newTenant = await TenantService.createTenant({
        chatId,
        companyName: ctx.chat.title || `Chat ${chatId}`
      });
      
      ctx.tenant = newTenant;
      
      // Crear configuración por defecto
      await TenantService.getOrCreateSettings(newTenant.id);
      
      console.log(`Nuevo tenant registrado: ${newTenant.companyName} (${chatId})`);
    } else {
      // Verificar si el tenant está activo
      if (!tenant.isActive) {
        ctx.reply('Este grupo no tiene una suscripción activa. Por favor contacte al administrador.');
        return;
      }
      
      // Si el tenant existe y está activo, agregarlo al contexto
      ctx.tenant = tenant;
    }
    
    // Continuar con el siguiente middleware
    return next();
  } catch (error) {
    console.error('Error en middleware de tenant:', error);
    ctx.reply('Error interno al procesar la solicitud. Por favor intente nuevamente.');
  }
}

/**
 * Middleware para obtener la configuración del tenant
 * y agregarla al contexto
 */
export async function withTenantSettings(ctx, next) {
  try {
    if (!ctx.tenant) {
      throw new Error('Tenant no encontrado en el contexto');
    }
    
    // Obtener configuración del tenant
    const settings = await TenantService.getOrCreateSettings(ctx.tenant.id);
    
    // Agregar configuración al contexto
    ctx.tenantSettings = settings;
    
    // Continuar con el siguiente middleware
    return next();
  } catch (error) {
    console.error('Error en middleware de configuración:', error);
    ctx.reply('Error interno al procesar la configuración. Por favor intente nuevamente.');
  }
}
