// src/commands/fuel/gestion.command.js
import { gestionRegistrosController } from '../../controllers/gestionRegistrosController.js';
import { isInState } from '../../state/conversation.js';
import { logger } from '../../utils/logger.js';
import { isAdminUser } from '../../utils/admin.js';
import { DesactivacionController } from '../../controllers/fuel/desactivacion.controller.js';

/**
 * Configura los comandos para gestión CRUD de registros de combustible
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupGestionCommands(bot) {
  
  // Callback para gestión de cargas (búsqueda)
  bot.action('manage_fuel_records_search', async (ctx) => {
    try {
      // Verificar permisos
      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }
      
      await ctx.answerCbQuery('Iniciando búsqueda...');
      await gestionRegistrosController.startFuelRecordSearch(ctx);
    } catch (error) {
      logger.error(`Error en búsqueda de gestión: ${error.message}`);
      await ctx.answerCbQuery('Error al buscar');
    }
  });

  // Callback para gestión de kilómetros (pendiente para FASE 4)
  bot.action('manage_km_records', async (ctx) => {
    try {
      await ctx.answerCbQuery('Función en desarrollo');
      await ctx.reply('📏 *Gestión de Kilómetros*\n\n🚧 Esta función estará disponible en la próxima fase.', {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error(`Error en gestión de km: ${error.message}`);
    }
  });

  // Callbacks para edición de registros
  bot.action(/^edit_fuel_(.+)$/, async (ctx) => {
    try {
      const fuelId = ctx.match[1];
      
      // Verificar permisos
      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }
      
      await ctx.answerCbQuery('Cargando editor...');
      await gestionRegistrosController.showEditMenu(ctx, fuelId);
    } catch (error) {
      logger.error(`Error al editar registro: ${error.message}`);
      await ctx.answerCbQuery('Error al editar');
    }
  });

  // Callbacks para eliminación de registros (usando lógica de desactivación)
  bot.action(/^delete_fuel_(.+)$/, async (ctx) => {
    try {
      const fuelId = ctx.match[1];
      
      // Verificar permisos
      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }
      
      await ctx.answerCbQuery('Preparando eliminación...');
      
      // Usar la lógica existente de desactivación con confirmación
      const desactivacionController = new DesactivacionController();
      await desactivacionController.showDeactivationConfirmation(ctx, fuelId);
      
    } catch (error) {
      logger.error(`Error al eliminar registro: ${error.message}`);
      await ctx.answerCbQuery('Error al eliminar');
    }
  });


  // Callbacks para edición de campos específicos
  bot.action(/^edit_field_(.+)_(.+)$/, async (ctx) => {
    try {
      const field = ctx.match[1];
      const fuelId = ctx.match[2];
      
      // Verificar permisos
      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }
      
      await ctx.answerCbQuery(`Editando ${field}...`);
      await gestionRegistrosController.startFieldEdit(ctx, field, fuelId);
    } catch (error) {
      logger.error(`Error al editar campo: ${error.message}`);
      await ctx.answerCbQuery('Error al editar campo');
    }
  });

  // Callbacks para actualización de campos con valores predefinidos
  bot.action(/^update_field_(.+)$/, async (ctx) => {
    try {
      const value = ctx.match[1];
      const field = ctx.session?.data?.editingField;
      const fuelId = ctx.session?.data?.editingFuelId;

      logger.info(`GESTION: update_field callback - value: ${value}, field: ${field}, fuelId: ${fuelId}`);

      if (!field || !fuelId) {
        await ctx.answerCbQuery('Error: Sesión de edición no válida');
        return;
      }

      // Verificar permisos
      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }

      await ctx.answerCbQuery(`Actualizando a ${value}...`);
      await gestionRegistrosController.updateFuelField(ctx, fuelId, field, value);
    } catch (error) {
      logger.error(`Error al actualizar campo: ${error.message}`);
      await ctx.answerCbQuery('Error al actualizar');
    }
  });

  // Callback para mostrar opciones de un registro específico
  bot.action(/^show_fuel_options_(.+)$/, async (ctx) => {
    try {
      const fuelId = ctx.match[1];
      
      // Verificar permisos
      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }
      
      await ctx.answerCbQuery('Cargando opciones...');
      
      // Buscar el registro y mostrar opciones
      const fuel = ctx.session?.data?.managingFuelData;
      if (fuel && fuel.id === fuelId) {
        await gestionRegistrosController.showRecordManagementOptions(ctx, fuel);
      } else {
        await ctx.reply('Error: Información del registro no disponible.');
      }
    } catch (error) {
      logger.error(`Error al mostrar opciones: ${error.message}`);
      await ctx.answerCbQuery('Error al cargar opciones');
    }
  });

  // Manejar entrada de texto para búsqueda de gestión y edición de campos
  bot.on('text', async (ctx, next) => {
    const currentState = ctx.session?.state;
    const editingField = ctx.session?.data?.editingField;
    const editingFuelId = ctx.session?.data?.editingFuelId;
    
    logger.info(`GESTION TEXT HANDLER: Texto recibido "${ctx.message.text}" - Estado: ${currentState}, Field: ${editingField}, FuelId: ${editingFuelId}`);
    
    if (isInState(ctx, 'gestion_search_fuel')) {
      logger.info('GESTION: Procesando búsqueda de gestión');
      await gestionRegistrosController.handleSearchInput(ctx);
      return;
    }
    
    if (isInState(ctx, 'editing_fuel_field')) {
      logger.info('GESTION: Procesando edición de campo');
      await gestionRegistrosController.handleFieldEditInput(ctx);
      return;
    }
    
    logger.info('GESTION: Texto no procesado, continuando con siguiente middleware');
    // Continuar con el siguiente middleware
    return next();
  });
}