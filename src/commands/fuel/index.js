// src/commands/fuel/index.js
import { logger } from '../../utils/logger.js';
import { setupFuelEntryCommands } from './entry.command.js';
import { setupBalanceCommands } from './balance.command.js';
import { setupDateHandlingCommands } from './date-handling.command.js';
import { setupPaymentCommands } from './payment.command.js';
import { setupFuelDeactivationCommands } from './desactivacion.command.js';
import { setupGestionCommands } from './gestion.command.js';

/**
 * Configura todos los comandos relacionados con cargas de combustible
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupFuelCommands(bot) {
  logger.info("⭐ Configurando sistema de registro de combustible");

  // Registrar los diferentes módulos de comandos
  setupFuelEntryCommands(bot);
  setupBalanceCommands(bot);
  setupDateHandlingCommands(bot);
  setupPaymentCommands(bot);
  setupFuelDeactivationCommands(bot);
  setupGestionCommands(bot);

  logger.info("✅ Comandos de combustible configurados exitosamente");
}
