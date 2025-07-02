// src/commands/registration/index.js
import { setupStartRegistrationCommand } from './start-registration.command.js';
import { setupAdminCommands } from './admin.commands.js';
import { setupGroupLinkingCommand } from './group-linking.command.js';
import { logger } from '../../utils/logger.js';

/**
 * Configura todos los comandos relacionados con el registro de empresas
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupCompanyRegisterCommands(bot) {
  try {
    logger.info('Configurando comandos de registro de empresas...');

    // Configurar comando para iniciar registro (chat privado)
    setupStartRegistrationCommand(bot);

    // Configurar comandos administrativos (listar, aprobar, rechazar)
    setupAdminCommands(bot);

    // Configurar comando para vincular grupos
    setupGroupLinkingCommand(bot);

    logger.info('Comandos de registro configurados exitosamente');
  } catch (error) {
    logger.error(`Error al configurar comandos de registro: ${error.message}`);
    throw error;
  }
}
