// src/commands/index.js
import { setupStartCommand } from './start.command.js';
import { setupRegisterUnitCommand } from './register.command.js';
import { setupFuelCommand } from './fuel.command.js';
import { setupReportCommand } from './report.command.js';
import { logger } from '../utils/logger.js';

/**
 * Registra todos los comandos del bot
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function registerCommands(bot) {
  try {
    // Registrar comandos principales
    setupStartCommand(bot);
    setupRegisterUnitCommand(bot);
    setupFuelCommand(bot);
    setupReportCommand(bot);
    
    // Establecer comandos en la interfaz de Telegram
    bot.telegram.setMyCommands([
      { command: 'start', description: 'Iniciar el bot' },
      { command: 'registrar', description: 'Registrar una nueva unidad' },
      { command: 'saldo', description: 'Ver saldo pendiente total' },
      { command: 'reporte', description: 'Generar reportes de cargas' },
      { command: 'ayuda', description: 'Ver instrucciones de uso' }
    ]);
    
    logger.info('Comandos registrados correctamente');
  } catch (error) {
    logger.error('Error al registrar comandos:', error);
    throw error;
  }
}