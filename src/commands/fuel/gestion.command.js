// src/commands/fuel/gestion.command.js
import { gestionRegistrosController } from '../../controllers/gestionRegistrosController.js';
import { isInState } from '../../state/conversation.js';
import { logger } from '../../utils/logger.js';
import { isAdminUser } from '../../utils/admin.js';
import { DesactivacionController } from '../../controllers/fuel/desactivacion.controller.js';
import { prisma } from '../../db/index.js';

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

  // Callback para gestión de kilómetros
  bot.action('manage_km_records', async (ctx) => {
    try {
      // Verificar permisos
      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }

      await ctx.answerCbQuery('Cargando menú de kilómetros...');
      await gestionRegistrosController.showKilometerMenu(ctx);
    } catch (error) {
      logger.error(`Error en gestión de km: ${error.message}`);
      await ctx.answerCbQuery('Error al cargar menú');
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

      // Usar la nueva función que obtiene datos directamente de BD
      await gestionRegistrosController.showRecordManagementOptionsByID(ctx, fuelId);
    } catch (error) {
      logger.error(`Error al mostrar opciones: ${error.message}`);
      await ctx.answerCbQuery('Error al cargar opciones');
    }
  });

  // ============= CALLBACKS DE KILÓMETROS =============

  // Ver registros recientes de kilómetros
  bot.action('km_view_recent', async (ctx) => {
    try {
      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }

      await ctx.answerCbQuery('Cargando registros...');
      await gestionRegistrosController.showRecentKilometerLogs(ctx);
    } catch (error) {
      logger.error(`Error al ver registros recientes: ${error.message}`);
      await ctx.answerCbQuery('Error al cargar registros');
    }
  });

  // Buscar por unidad
  bot.action('km_search_by_unit', async (ctx) => {
    try {
      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }

      await ctx.answerCbQuery('Iniciando búsqueda por unidad...');
      await gestionRegistrosController.startKmSearchByUnit(ctx);
    } catch (error) {
      logger.error(`Error al buscar por unidad: ${error.message}`);
      await ctx.answerCbQuery('Error en búsqueda');
    }
  });

  // Buscar por fecha - Menú principal
  bot.action('km_search_by_date', async (ctx) => {
    try {
      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }

      await ctx.answerCbQuery('Mostrando opciones de fecha...');
      await gestionRegistrosController.showKmSearchByDate(ctx);
    } catch (error) {
      logger.error(`Error en búsqueda por fecha: ${error.message}`);
      await ctx.answerCbQuery('Error al mostrar opción');
    }
  });

  // Callbacks para períodos predefinidos
  bot.action('km_date_today', async (ctx) => {
    try {
      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }

      await ctx.answerCbQuery('Buscando registros de hoy...');
      await gestionRegistrosController.searchKmByPeriod(ctx, 'today');
    } catch (error) {
      logger.error(`Error en búsqueda de hoy: ${error.message}`);
      await ctx.answerCbQuery('Error en búsqueda');
    }
  });

  bot.action('km_date_yesterday', async (ctx) => {
    try {
      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }

      await ctx.answerCbQuery('Buscando registros de ayer...');
      await gestionRegistrosController.searchKmByPeriod(ctx, 'yesterday');
    } catch (error) {
      logger.error(`Error en búsqueda de ayer: ${error.message}`);
      await ctx.answerCbQuery('Error en búsqueda');
    }
  });

  bot.action('km_date_week', async (ctx) => {
    try {
      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }

      await ctx.answerCbQuery('Buscando registros de la semana...');
      await gestionRegistrosController.searchKmByPeriod(ctx, 'week');
    } catch (error) {
      logger.error(`Error en búsqueda semanal: ${error.message}`);
      await ctx.answerCbQuery('Error en búsqueda');
    }
  });

  bot.action('km_date_month', async (ctx) => {
    try {
      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }

      await ctx.answerCbQuery('Buscando registros del mes...');
      await gestionRegistrosController.searchKmByPeriod(ctx, 'month');
    } catch (error) {
      logger.error(`Error en búsqueda mensual: ${error.message}`);
      await ctx.answerCbQuery('Error en búsqueda');
    }
  });

  bot.action('km_date_custom', async (ctx) => {
    try {
      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }

      await ctx.answerCbQuery('Configurando búsqueda personalizada...');
      await gestionRegistrosController.startCustomDateSearch(ctx);
    } catch (error) {
      logger.error(`Error en búsqueda personalizada: ${error.message}`);
      await ctx.answerCbQuery('Error al configurar');
    }
  });

  // Gestionar registro específico de kilómetros
  bot.action(/^km_manage_(.+)$/, async (ctx) => {
    try {
      const logIdShort = ctx.match[1];

      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }

      await ctx.answerCbQuery('Cargando registro...');
      await gestionRegistrosController.showKmManagementOptions(ctx, logIdShort);
    } catch (error) {
      logger.error(`Error al gestionar registro km: ${error.message}`);
      await ctx.answerCbQuery('Error al cargar registro');
    }
  });

  // Editar kilómetros
  bot.action(/^km_edit_(.+)$/, async (ctx) => {
    try {
      const logId = ctx.match[1];

      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }

      await ctx.answerCbQuery('Iniciando edición...');
      await gestionRegistrosController.startKmEdit(ctx, logId);
    } catch (error) {
      logger.error(`Error al editar km: ${error.message}`);
      await ctx.answerCbQuery('Error al editar');
    }
  });

  // Confirmar eliminación de kilómetros (DEBE IR ANTES del handler genérico)
  bot.action(/^km_delete_confirm_(.+)$/, async (ctx) => {
    try {
      const logId = ctx.match[1];

      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }

      await ctx.answerCbQuery('Eliminando registro...');
      await gestionRegistrosController.executeKmDeletion(ctx, logId);
    } catch (error) {
      logger.error(`Error al confirmar eliminación km: ${error.message}`);
      await ctx.answerCbQuery('Error al eliminar');
    }
  });

  // Eliminar registro de kilómetros (handler genérico)
  bot.action(/^km_delete_(.+)$/, async (ctx) => {
    try {
      const logId = ctx.match[1];

      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }

      await ctx.answerCbQuery('Preparando eliminación...');
      await gestionRegistrosController.confirmKmDeletion(ctx, logId);
    } catch (error) {
      logger.error(`Error al eliminar km: ${error.message}`);
      await ctx.answerCbQuery('Error al eliminar');
    }
  });

  // Forzar actualización de kilómetros (saltando validaciones)
  bot.action(/^km_force_update_(.+)_(.+)$/, async (ctx) => {
    try {
      const logId = ctx.match[1];
      const kmValue = parseFloat(ctx.match[2]);

      const isAdmin = await isAdminUser(ctx.from?.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        return;
      }

      await ctx.answerCbQuery('Forzando actualización...');

      // Obtener datos del registro
      const log = await prisma.kilometerLog.findUnique({
        where: { id: logId }
      });

      if (!log) {
        await ctx.reply('❌ Registro no encontrado.');
        return;
      }

      await gestionRegistrosController.executeKmUpdate(ctx, logId, log, kmValue);
    } catch (error) {
      logger.error(`Error al forzar actualización: ${error.message}`);
      await ctx.answerCbQuery('Error al actualizar');
    }
  });

  // Manejar entrada de texto para búsqueda de gestión y edición de campos
  bot.on('text', async (ctx, next) => {
    const currentState = ctx.session?.state;
    const editingField = ctx.session?.data?.editingField;
    const editingFuelId = ctx.session?.data?.editingFuelId;
    const editingKmId = ctx.session?.data?.editingKmId;

    logger.info(`GESTION TEXT HANDLER: Texto recibido "${ctx.message.text}" - Estado: ${currentState}, Field: ${editingField}, FuelId: ${editingFuelId}, KmId: ${editingKmId}`);

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

    if (isInState(ctx, 'km_search_unit')) {
      logger.info('GESTION: Procesando búsqueda de kilómetros por unidad');
      await gestionRegistrosController.handleKmUnitSearch(ctx, ctx.message.text);
      return;
    }

    if (isInState(ctx, 'editing_km_value')) {
      logger.info('GESTION: Procesando edición de kilómetros');
      await gestionRegistrosController.handleKmEditInput(ctx);
      return;
    }

    if (isInState(ctx, 'km_custom_date')) {
      logger.info('GESTION: Procesando búsqueda por fecha personalizada');
      await gestionRegistrosController.handleCustomDateSearch(ctx);
      return;
    }

    logger.info('GESTION: Texto no procesado, continuando con siguiente middleware');
    // Continuar con el siguiente middleware
    return next();
  });
}