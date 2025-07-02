// src/controllers/turno.controller.js
import { Markup } from 'telegraf';
import { KilometerService } from '../services/kilometer.prisma.service.js';
import { UnitService } from '../services/unit.prisma.service.js';
import { updateConversationState } from '../state/conversation.js';
import { logger } from '../utils/logger.js';

/**
 * Controlador para gestionar los turnos de trabajo (inicio/fin de día)
 * Maneja el registro masivo de kilómetros para múltiples unidades
 */
export class TurnoController {
  /**
   * Muestra el menú principal de turnos
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async showTurnosMenu(ctx) {
    try {
      logger.info(`Usuario ${ctx.from.id} accedió al menú de turnos`);

      await ctx.reply(
        '🕐 Gestión de Turnos\n\n' +
        'Selecciona la acción que deseas realizar:',
        Markup.inlineKeyboard([
          [Markup.button.callback('🌅 Inicio del día', 'turno_inicio_dia')],
          [Markup.button.callback('🌅 Fin del día', 'turno_fin_dia')],
          [Markup.button.callback('📊 Ver registros del día', 'turno_ver_registros')],
          [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
        ])
      );

    } catch (error) {
      logger.error(`Error al mostrar menú de turnos: ${error.message}`);
      await ctx.reply('Error al mostrar el menú de turnos. Por favor, intenta nuevamente.');
    }
  }

  /**
   * Inicia el proceso de registro de inicio de turno
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async startInicioTurno(ctx) {
    try {
      logger.info(`Iniciando proceso de inicio de turno para tenant ${ctx.tenant.id}`);

      const today = new Date().toISOString().split('T')[0];

      // Obtener todas las unidades activas del tenant
      const allUnits = await UnitService.getActiveUnits(ctx.tenant.id);

      if (allUnits.length === 0) {
        await ctx.reply('No hay unidades registradas para procesar.');
        return;
      }

      // Obtener unidades que ya tienen registro de inicio de turno hoy
      const unitsWithInitLog = await KilometerService.getTurnLogsByDate(
        ctx.tenant.id,
        today,
        'INICIO_TURNO'
      );

      const unitsWithInitIds = new Set(unitsWithInitLog.map(log => log.unitId));

      // Filtrar unidades pendientes (sin registro de inicio hoy)
      const pendingUnits = allUnits.filter(unit => !unitsWithInitIds.has(unit.id));

      if (pendingUnits.length === 0) {
        await ctx.reply(
          '✅ Todas las unidades ya tienen registro de inicio de turno para hoy.\n\n' +
          `📊 Registros completados: ${unitsWithInitLog.length}\n` +
          `📅 Fecha: ${new Date().toLocaleDateString('es-MX')}`
        );
        return;
      }

      // Mostrar resumen antes de iniciar
      await ctx.reply(
        `🌅 Inicio de Turno - ${new Date().toLocaleDateString('es-MX')}\n\n` +
        '📊 Resumen:\n' +
        `• Total de unidades: ${allUnits.length}\n` +
        `• Ya registradas: ${unitsWithInitLog.length}\n` +
        `• Pendientes por registrar: ${pendingUnits.length}\n\n` +
        'Iniciando registro secuencial...'
      );

      // Inicializar datos de sesión para el proceso
      await updateConversationState(ctx, 'turno_inicio_processing', {
        logType: 'INICIO_TURNO',
        pendingUnits: pendingUnits,
        currentIndex: 0,
        processedUnits: [],
        omittedUnits: [],
        date: today
      });

      // Procesar la primera unidad
      await this.processNextUnit(ctx);

    } catch (error) {
      logger.error(`Error al iniciar proceso de inicio de turno: ${error.message}`);
      await ctx.reply('Error al iniciar el proceso. Por favor, intenta nuevamente.');
    }
  }

  /**
   * Inicia el proceso de registro de fin de turno
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async startFinTurno(ctx) {
    try {
      logger.info(`Iniciando proceso de fin de turno para tenant ${ctx.tenant.id}`);

      const today = new Date().toISOString().split('T')[0];

      // Obtener todas las unidades activas del tenant
      const allUnits = await UnitService.getActiveUnits(ctx.tenant.id);

      if (allUnits.length === 0) {
        await ctx.reply('No hay unidades registradas para procesar.');
        return;
      }

      // Obtener unidades que ya tienen registro de fin de turno hoy
      const unitsWithEndLog = await KilometerService.getTurnLogsByDate(
        ctx.tenant.id,
        today,
        'FIN_TURNO'
      );

      const unitsWithEndIds = new Set(unitsWithEndLog.map(log => log.unitId));

      // Filtrar unidades pendientes (sin registro de fin hoy)
      const pendingUnits = allUnits.filter(unit => !unitsWithEndIds.has(unit.id));

      if (pendingUnits.length === 0) {
        await ctx.reply(
          '✅ Todas las unidades ya tienen registro de fin de turno para hoy.\n\n' +
          `📊 Registros completados: ${unitsWithEndLog.length}\n` +
          `📅 Fecha: ${new Date().toLocaleDateString('es-MX')}`
        );
        return;
      }

      // Mostrar resumen antes de iniciar
      await ctx.reply(
        `🌆 Fin de Turno - ${new Date().toLocaleDateString('es-MX')}\n\n` +
        '📊 Resumen:\n' +
        `• Total de unidades: ${allUnits.length}\n` +
        `• Ya registradas: ${unitsWithEndLog.length}\n` +
        `• Pendientes por registrar: ${pendingUnits.length}\n\n` +
        'Iniciando registro secuencial...'
      );

      // Inicializar datos de sesión para el proceso
      await updateConversationState(ctx, 'turno_fin_processing', {
        logType: 'FIN_TURNO',
        pendingUnits: pendingUnits,
        currentIndex: 0,
        processedUnits: [],
        omittedUnits: [],
        date: today
      });

      // Procesar la primera unidad
      await this.processNextUnit(ctx);

    } catch (error) {
      logger.error(`Error al iniciar proceso de fin de turno: ${error.message}`);
      await ctx.reply('Error al iniciar el proceso. Por favor, intenta nuevamente.');
    }
  }

  /**
   * Procesa la siguiente unidad en la cola
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async processNextUnit(ctx) {
    try {
      const { pendingUnits, currentIndex, logType, processedUnits, omittedUnits } = ctx.session.data;

      // Verificar si hemos terminado con todas las unidades
      if (currentIndex >= pendingUnits.length) {
        await this.showTurnoSummary(ctx);
        return;
      }

      const currentUnit = pendingUnits[currentIndex];
      const remaining = pendingUnits.length - currentIndex;

      logger.info(`Procesando unidad ${currentIndex + 1}/${pendingUnits.length}: ${currentUnit.operatorName}`);

      // Obtener último kilómetro conocido para mostrar contexto
      const lastKm = await KilometerService.getLastKilometer(ctx.tenant.id, currentUnit.id);

      let contextMessage = '';
      if (lastKm) {
        contextMessage = `\n📊 Último registro: ${lastKm.kilometers} km (${new Date(lastKm.date).toLocaleDateString('es-MX')})`;
      } else {
        contextMessage = '\n✨ Primer registro de kilómetros para esta unidad';
      }

      const turnoType = logType === 'INICIO_TURNO' ? 'inicio' : 'fin';
      const emoji = logType === 'INICIO_TURNO' ? '🌅' : '🌆';

      await ctx.reply(
        `${emoji} Registro de ${turnoType} de turno\n\n` +
        `👤 Operador: ${currentUnit.operatorName}\n` +
        `🚛 Unidad: ${currentUnit.unitNumber}\n` +
        `📅 Fecha: ${new Date().toLocaleDateString('es-MX')}\n` +
        contextMessage + '\n\n' +
        `⏳ Quedan ${remaining} unidades por procesar\n\n` +
        'Por favor, ingresa los kilómetros actuales:',
        Markup.inlineKeyboard([
          [Markup.button.callback('⏭️ Omitir esta unidad', 'turno_omit_unit')],
          [Markup.button.callback('❌ Cancelar proceso', 'turno_cancel_process')]
        ])
      );

      // Actualizar estado para captura de kilómetros
      await updateConversationState(ctx, 'turno_capturing_kilometers');

    } catch (error) {
      logger.error(`Error al procesar siguiente unidad: ${error.message}`);
      await ctx.reply('Error al procesar unidad. Continuando con la siguiente...');

      // Incrementar índice y continuar
      ctx.session.data.currentIndex++;
      await this.processNextUnit(ctx);
    }
  }

  /**
   * Maneja la entrada de kilómetros durante el proceso de turnos
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleTurnoKilometersEntry(ctx) {
    try {
      const { pendingUnits, currentIndex, logType, date } = ctx.session.data;
      const currentUnit = pendingUnits[currentIndex];

      const kilometersText = ctx.message.text.replace(',', '.');
      const kilometers = parseFloat(kilometersText);

      if (isNaN(kilometers) || kilometers < 0) {
        await ctx.reply('Por favor, ingresa un número válido mayor o igual a cero.');
        return;
      }

      // Validar formato (máximo 2 decimales)
      const decimalPlaces = (kilometersText.split('.')[1] || '').length;
      if (decimalPlaces > 2) {
        await ctx.reply('Los kilómetros no pueden tener más de 2 decimales. Por favor, ingresa nuevamente.');
        return;
      }

      logger.info(`Validando kilómetros ${kilometers} para unidad ${currentUnit.id} en turno ${logType}`);

      // Validar kilómetros contra histórico
      const validation = await KilometerService.validateKilometer(
        ctx.tenant.id,
        currentUnit.id,
        kilometers
      );

      if (!validation.isValid) {
        let errorMessage = `❌ ${validation.message}`;

        if (validation.lastKilometer) {
          errorMessage += '\n\n📊 Último registro:\n';
          errorMessage += `• Kilómetros: ${validation.lastKilometer.kilometers}\n`;
          errorMessage += `• Fecha: ${new Date(validation.lastKilometer.date).toLocaleDateString('es-MX')}`;
        }

        errorMessage += '\n\nPor favor, ingresa un kilómetro mayor o igual al último registrado.';

        await ctx.reply(errorMessage);
        return;
      }

      // Si hay advertencia, mostrarla pero continuar
      if (validation.warning) {
        await ctx.reply(`⚠️ ${validation.message}\n\nContinuando con el registro...`);
      }

      // Crear registro de turno
      try {
        const turnLog = await KilometerService.createTurnLog({
          tenantId: ctx.tenant.id,
          unitId: currentUnit.id,
          kilometers: kilometers,
          logType: logType,
          logDate: date,
          userId: ctx.from.id.toString()
        });

        logger.info(`Log de turno creado exitosamente: ${turnLog.id}`);

        await ctx.reply(
          `✅ Registrado: ${currentUnit.operatorName} - ${currentUnit.unitNumber}\n` +
          `📊 Kilómetros: ${kilometers}`
        );

        // Agregar a unidades procesadas
        ctx.session.data.processedUnits.push({
          unit: currentUnit,
          kilometers: kilometers,
          logId: turnLog.id
        });

      } catch (error) {
        if (error.message.includes('Ya existe un registro')) {
          await ctx.reply(`⚠️ Esta unidad ya tiene registro de ${logType.toLowerCase().replace('_', ' ')} para hoy. Continuando...`);

          // Agregar a unidades ya procesadas
          ctx.session.data.processedUnits.push({
            unit: currentUnit,
            kilometers: 'Ya registrado',
            logId: null
          });
        } else {
          throw error;
        }
      }

      // Continuar con la siguiente unidad
      ctx.session.data.currentIndex++;
      await this.processNextUnit(ctx);

    } catch (error) {
      logger.error(`Error al procesar kilómetros de turno: ${error.message}`);
      await ctx.reply('Error al registrar kilómetros. Continuando con la siguiente unidad...');

      // Continuar con la siguiente unidad
      ctx.session.data.currentIndex++;
      await this.processNextUnit(ctx);
    }
  }

  /**
   * Omite la unidad actual y continúa con la siguiente
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async omitCurrentUnit(ctx) {
    try {
      const { pendingUnits, currentIndex } = ctx.session.data;
      const currentUnit = pendingUnits[currentIndex];

      logger.info(`Omitiendo unidad: ${currentUnit.operatorName} - ${currentUnit.unitNumber}`);

      await ctx.answerCbQuery('Unidad omitida');
      await ctx.reply(`⏭️ Omitida: ${currentUnit.operatorName} - ${currentUnit.unitNumber}`);

      // Agregar a unidades omitidas
      ctx.session.data.omittedUnits.push(currentUnit);

      // Continuar con la siguiente unidad
      ctx.session.data.currentIndex++;
      await this.processNextUnit(ctx);

    } catch (error) {
      logger.error(`Error al omitir unidad: ${error.message}`);
      await ctx.reply('Error al omitir unidad. Continuando...');

      ctx.session.data.currentIndex++;
      await this.processNextUnit(ctx);
    }
  }

  /**
   * Cancela todo el proceso de turnos
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async cancelTurnoProcess(ctx) {
    try {
      await ctx.answerCbQuery('Proceso cancelado');

      const { processedUnits, omittedUnits, currentIndex, pendingUnits } = ctx.session.data;

      await ctx.reply(
        '❌ Proceso cancelado por el usuario\n\n' +
        '📊 Resumen del progreso:\n' +
        `• Unidades procesadas: ${processedUnits.length}\n` +
        `• Unidades omitidas: ${omittedUnits.length}\n` +
        `• Unidades pendientes: ${pendingUnits.length - currentIndex}\n\n` +
        'Puedes reiniciar el proceso cuando desees.'
      );

      // Limpiar estado de conversación
      await updateConversationState(ctx, 'idle', {});

    } catch (error) {
      logger.error(`Error al cancelar proceso: ${error.message}`);
      await ctx.reply('Error al cancelar proceso.');
    }
  }

  /**
   * Muestra el resumen final del proceso de turnos
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async showTurnoSummary(ctx) {
    try {
      const { processedUnits, omittedUnits, logType } = ctx.session.data;

      const turnoTypeText = logType === 'INICIO_TURNO' ? 'inicio de turno' : 'fin de turno';
      const emoji = logType === 'INICIO_TURNO' ? '🌅' : '🌆';

      let summaryMessage = `${emoji} Proceso de ${turnoTypeText} completado\n\n`;
      summaryMessage += '📊 Resumen final:\n';
      summaryMessage += `• ✅ Procesadas: ${processedUnits.length}\n`;
      summaryMessage += `• ⏭️ Omitidas: ${omittedUnits.length}\n`;
      summaryMessage += `• 📅 Fecha: ${new Date().toLocaleDateString('es-MX')}\n\n`;

      if (processedUnits.length > 0) {
        summaryMessage += '📋 Unidades procesadas:\n';
        processedUnits.forEach((item, index) => {
          summaryMessage += `${index + 1}. ${item.unit.operatorName} - ${item.unit.unitNumber}: ${item.kilometers} km\n`;
        });
        summaryMessage += '\n';
      }

      if (omittedUnits.length > 0) {
        summaryMessage += '⏭️ Unidades omitidas:\n';
        omittedUnits.forEach((unit, index) => {
          summaryMessage += `${index + 1}. ${unit.operatorName} - ${unit.unitNumber}\n`;
        });
      }

      await ctx.reply(summaryMessage);

      // Limpiar estado de conversación
      await updateConversationState(ctx, 'idle', {});

      logger.info(`Proceso de ${turnoTypeText} completado: ${processedUnits.length} procesadas, ${omittedUnits.length} omitidas`);

    } catch (error) {
      logger.error(`Error al mostrar resumen: ${error.message}`);
      await ctx.reply('Proceso completado con errores en el resumen.');
    }
  }

  /**
   * Muestra los registros de turnos del día actual
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async showTodayLogs(ctx) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Obtener logs de inicio y fin de turno
      const inicioLogs = await KilometerService.getTurnLogsByDate(ctx.tenant.id, today, 'INICIO_TURNO');
      const finLogs = await KilometerService.getTurnLogsByDate(ctx.tenant.id, today, 'FIN_TURNO');

      let message = `📊 Registros de Turnos - ${new Date().toLocaleDateString('es-MX')}\n\n`;

      message += `🌅 Inicio de turno: ${inicioLogs.length} registros\n`;
      if (inicioLogs.length > 0) {
        inicioLogs.forEach(log => {
          message += `  • ${log.Unit.operatorName} - ${log.Unit.unitNumber}: ${log.kilometers} km\n`;
        });
      }

      message += `\n🌆 Fin de turno: ${finLogs.length} registros\n`;
      if (finLogs.length > 0) {
        finLogs.forEach(log => {
          message += `  • ${log.Unit.operatorName} - ${log.Unit.unitNumber}: ${log.kilometers} km\n`;
        });
      }

      if (inicioLogs.length === 0 && finLogs.length === 0) {
        message += '\nNo hay registros de turnos para el día de hoy.';
      }

      await ctx.reply(message);

    } catch (error) {
      logger.error(`Error al mostrar registros del día: ${error.message}`);
      await ctx.reply('Error al obtener los registros del día.');
    }
  }
}