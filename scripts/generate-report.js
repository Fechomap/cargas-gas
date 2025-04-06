// scripts/generate-report.js
import 'dotenv/config';
import { connectToDatabase, disconnectFromDatabase } from '../src/db/connection.js';
import { reportService } from '../src/services/report.service.js';
import fs from 'fs';
import path from 'path';
import { exit } from 'process';
import { logger } from '../src/utils/logger.js';

/**
 * Script para generar reportes desde la línea de comandos
 * Uso: node scripts/generate-report.js [--format=pdf|excel] [--output=filename]
 */
async function main() {
  try {
    logger.info('Iniciando generación de reporte...');
    
    // Procesando argumentos
    const args = process.argv.slice(2);
    const formatArg = args.find(arg => arg.startsWith('--format='));
    const outputArg = args.find(arg => arg.startsWith('--output='));
    
    const format = formatArg ? formatArg.split('=')[1] : 'pdf';
    const outputFilename = outputArg ? outputArg.split('=')[1] : `reporte_${new Date().toISOString().split('T')[0]}.${format}`;
    
    // Conectar a la base de datos
    await connectToDatabase();
    
    // Filtros predeterminados: últimos 30 días, todas las cargas no pagadas
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const filters = {
      startDate: thirtyDaysAgo,
      endDate: new Date(),
      paymentStatus: 'no pagada'
    };
    
    // Generar el reporte según el formato
    let reportFile;
    
    if (format === 'excel') {
      reportFile = await reportService.generateExcelReport(filters);
    } else {
      reportFile = await reportService.generatePdfReport(filters);
    }
    
    // Copiar archivo a ubicación deseada
    const outputPath = path.resolve(process.cwd(), 'reports', outputFilename);
    
    // Asegurar que el directorio existe
    const reportsDir = path.dirname(outputPath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // Copiar archivo
    fs.copyFileSync(reportFile.path, outputPath);
    
    logger.info(`Reporte generado exitosamente: ${outputPath}`);
    
    // Desconectar de la base de datos
    await disconnectFromDatabase();
    exit(0);
  } catch (error) {
    logger.error(`Error al generar reporte: ${error.message}`);
    
    // Intentar desconectar de la base de datos en caso de error
    try {
      await disconnectFromDatabase();
    } catch (disconnectError) {
      logger.error(`Error al desconectar de la base de datos: ${disconnectError.message}`);
    }
    
    exit(1);
  }
}

main();