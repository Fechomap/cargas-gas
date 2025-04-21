// scripts/backup-automatico.js
import 'dotenv/config';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import ExcelJS from 'exceljs';
import archiver from 'archiver';
import { connectToDatabase, disconnectFromDatabase } from '../src/db/connection.js';
import { Fuel } from '../src/models/fuel.model.js';
import { Unit } from '../src/models/unit.model.js';
import { logger } from '../src/utils/logger.js';

// Convertir exec a promesa
const execAsync = promisify(exec);

// Configuración de rutas y nombres
const BACKUPS_DIR = path.resolve(process.cwd(), 'backups');
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const TEMP_DIR = path.resolve(process.cwd(), 'temp_backup');
const MAX_BACKUPS = 10; // Número máximo de backups a mantener (los más antiguos se eliminarán)

/**
 * Crea un backup completo del sistema
 * - Base de datos MongoDB (dump)
 * - Reporte Excel con todos los datos
 * - Archivos de tickets/imágenes
 */
async function createBackup() {
  const backupDate = new Date();
  const backupId = formatDateForFilename(backupDate);
  const backupName = `backup_${backupId}`;
  const backupDir = path.join(BACKUPS_DIR, backupName);
  
  try {
    logger.info('=== INICIANDO PROCESO DE BACKUP COMPLETO ===');
    logger.info(`Fecha y hora: ${backupDate.toLocaleString()}`);
    
    // Paso 1: Crear estructura de directorios
    logger.info('Creando estructura de directorios...');
    await fs.ensureDir(BACKUPS_DIR);
    await fs.ensureDir(TEMP_DIR);
    await fs.ensureDir(path.join(TEMP_DIR, 'mongodb'));
    await fs.ensureDir(path.join(TEMP_DIR, 'reportes'));
    await fs.ensureDir(path.join(TEMP_DIR, 'uploads'));
    
    // Paso 2: Realizar mongodump
    logger.info('Realizando backup de MongoDB...');
    await backupMongoDB(path.join(TEMP_DIR, 'mongodb'));
    
    // Paso 3: Conectar a la base de datos para generar reporte Excel
    logger.info('Conectando a la base de datos para generar reporte...');
    await connectToDatabase();
    
    // Paso 4: Generar reporte Excel completo
    logger.info('Generando reporte Excel completo...');
    await generateExcelReport(path.join(TEMP_DIR, 'reportes', 'datos_completos.xlsx'));
    
    // Paso 5: Copiar carpeta de uploads
    logger.info('Copiando archivos de tickets/imágenes...');
    if (fs.existsSync(UPLOADS_DIR)) {
      await fs.copy(UPLOADS_DIR, path.join(TEMP_DIR, 'uploads'));
    } else {
      logger.warn('Directorio de uploads no encontrado');
      // Crear directorio vacío para mantener la estructura
      await fs.ensureDir(path.join(TEMP_DIR, 'uploads'));
    }
    
    // Paso 6: Crear archivo ZIP con todo el contenido
    logger.info('Creando archivo ZIP con el backup completo...');
    await createZipArchive(TEMP_DIR, path.join(BACKUPS_DIR, `${backupName}.zip`));
    
    // Paso 7: Limpiar archivos temporales
    logger.info('Limpiando archivos temporales...');
    await fs.remove(TEMP_DIR);
    
    // Paso 8: Mantener solo los backups más recientes
    await manageBackupHistory();
    
    // Desconectar de la base de datos
    await disconnectFromDatabase();
    
    logger.info(`✅ Backup completado exitosamente: ${path.join(BACKUPS_DIR, `${backupName}.zip`)}`);
    logger.info('=== PROCESO DE BACKUP FINALIZADO ===');
    
    return {
      success: true,
      backupFile: path.join(BACKUPS_DIR, `${backupName}.zip`),
      timestamp: backupDate
    };
  } catch (error) {
    logger.error(`Error durante el proceso de backup: ${error.message}`);
    logger.error(error.stack);
    
    // Intentar desconectar de la base de datos en caso de error
    try {
      await disconnectFromDatabase();
    } catch (disconnectError) {
      logger.error(`Error al desconectar de la base de datos: ${disconnectError.message}`);
    }
    
    // Intentar limpiar archivos temporales en caso de error
    try {
      if (fs.existsSync(TEMP_DIR)) {
        await fs.remove(TEMP_DIR);
      }
    } catch (cleanupError) {
      logger.error(`Error al limpiar archivos temporales: ${cleanupError.message}`);
    }
    
    return {
      success: false,
      error: error.message,
      timestamp: backupDate
    };
  }
}

/**
 * Realiza el backup de MongoDB utilizando mongodump
 * @param {string} outputDir - Directorio donde se guardará el dump
 */
async function backupMongoDB(outputDir) {
  try {
    // Extraer URI y credenciales de la variable de entorno
    const mongoUri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB_NAME;
    
    if (!mongoUri || !dbName) {
      throw new Error('No se encontraron las variables de entorno MONGODB_URI o MONGODB_DB_NAME');
    }
    
    // Construir comando mongodump
    const cmd = `mongodump --uri="${mongoUri}" --db="${dbName}" --out="${outputDir}"`;
    
    // Ejecutar comando
    const { stdout, stderr } = await execAsync(cmd);
    
    if (stderr && !stderr.includes('writing')) {
      logger.warn(`Advertencias durante mongodump: ${stderr}`);
    }
    
    logger.info('Dump de MongoDB completado exitosamente');
    return true;
  } catch (error) {
    logger.error(`Error al ejecutar mongodump: ${error.message}`);
    
    // Si mongodump falla, intentar crear un respaldo alternativo usando mongoose
    logger.info('Intentando crear respaldo alternativo usando mongoose...');
    await createManualBackup(outputDir);
    
    return false;
  }
}

/**
 * Crea un respaldo manual en formato JSON usando mongoose
 * (Fallback en caso de que mongodump no esté disponible)
 * @param {string} outputDir - Directorio donde se guardará el backup
 */
async function createManualBackup(outputDir) {
  try {
    // Guardar todas las unidades
    const units = await Unit.find({}).lean();
    await fs.writeJSON(path.join(outputDir, 'units.json'), units, { spaces: 2 });
    
    // Guardar todas las cargas de combustible
    const fuels = await Fuel.find({}).lean();
    await fs.writeJSON(path.join(outputDir, 'fuels.json'), fuels, { spaces: 2 });
    
    logger.info('Respaldo manual en formato JSON creado exitosamente');
    return true;
  } catch (error) {
    logger.error(`Error al crear respaldo manual: ${error.message}`);
    throw error;
  }
}

/**
 * Genera un reporte Excel completo con todos los datos
 * @param {string} outputFile - Ruta del archivo Excel a generar
 */
async function generateExcelReport(outputFile) {
  try {
    // Crear workbook y hojas
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Cargas de Combustible';
    workbook.created = new Date();
    
    // Hoja 1: Unidades
    const unitsSheet = workbook.addWorksheet('Unidades');
    
    // Definir columnas para unidades
    unitsSheet.columns = [
      { header: '_id', key: '_id', width: 30 },
      { header: 'Operador', key: 'operatorName', width: 20 },
      { header: 'Número', key: 'unitNumber', width: 15 },
      { header: 'Activo', key: 'isActive', width: 10 },
      { header: 'ID de Botón', key: 'buttonId', width: 25 },
      { header: 'Fecha de Creación', key: 'createdAt', width: 20 },
      { header: 'Última Actualización', key: 'updatedAt', width: 20 }
    ];
    
    // Estilo para encabezados
    unitsSheet.getRow(1).font = { bold: true };
    unitsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // Obtener todas las unidades
    const units = await Unit.find({}).lean();
    
    // Añadir datos de unidades
    units.forEach(unit => {
      unitsSheet.addRow({
        _id: unit._id.toString(),
        operatorName: unit.operatorName,
        unitNumber: unit.unitNumber,
        isActive: unit.isActive ? 'Sí' : 'No',
        buttonId: unit.buttonId,
        createdAt: unit.createdAt,
        updatedAt: unit.updatedAt
      });
    });
    
    // Hoja 2: Cargas de combustible
    const fuelsSheet = workbook.addWorksheet('Cargas');
    
    // Definir columnas para cargas
    fuelsSheet.columns = [
      { header: '_id', key: '_id', width: 30 },
      { header: 'Fecha', key: 'recordDate', width: 20 },
      { header: 'Operador', key: 'operatorName', width: 20 },
      { header: 'Unidad', key: 'unitNumber', width: 15 },
      { header: 'ID de Unidad', key: 'unitId', width: 30 },
      { header: 'Tipo', key: 'fuelType', width: 15 },
      { header: 'Litros', key: 'liters', width: 12 },
      { header: 'Monto', key: 'amount', width: 15 },
      { header: 'Estatus', key: 'paymentStatus', width: 15 },
      { header: 'Fecha de Pago', key: 'paymentDate', width: 20 },
      { header: 'Foto de Ticket', key: 'ticketPhoto', width: 40 },
      { header: 'Fecha de Creación', key: 'createdAt', width: 20 },
      { header: 'Última Actualización', key: 'updatedAt', width: 20 }
    ];
    
    // Estilo para encabezados
    fuelsSheet.getRow(1).font = { bold: true };
    fuelsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // Obtener todas las cargas
    const fuels = await Fuel.find({}).lean();
    
    // Añadir datos de cargas
    fuels.forEach(fuel => {
      const row = fuelsSheet.addRow({
        _id: fuel._id.toString(),
        recordDate: fuel.recordDate,
        operatorName: fuel.operatorName,
        unitNumber: fuel.unitNumber,
        unitId: fuel.unitId.toString(),
        fuelType: fuel.fuelType,
        liters: fuel.liters,
        amount: fuel.amount,
        paymentStatus: fuel.paymentStatus,
        paymentDate: fuel.paymentDate,
        ticketPhoto: fuel.ticketPhoto || 'N/A',
        createdAt: fuel.createdAt,
        updatedAt: fuel.updatedAt
      });
      
      // Formatear columnas numéricas
      row.getCell('liters').numFmt = '0.00';
      row.getCell('amount').numFmt = '$#,##0.00';
      
      // Formatear fechas
      row.getCell('recordDate').numFmt = 'dd/mm/yyyy hh:mm:ss';
      if (fuel.paymentDate) {
        row.getCell('paymentDate').numFmt = 'dd/mm/yyyy hh:mm:ss';
      }
      row.getCell('createdAt').numFmt = 'dd/mm/yyyy hh:mm:ss';
      row.getCell('updatedAt').numFmt = 'dd/mm/yyyy hh:mm:ss';
    });
    
    // Hoja 3: Resumen
    const summarySheet = workbook.addWorksheet('Resumen');
    
    // Estilo para encabezados
    summarySheet.getRow(1).font = { bold: true, size: 14 };
    
    // Añadir información de resumen
    summarySheet.addRow(['RESUMEN DE BASE DE DATOS']);
    summarySheet.addRow(['Fecha de generación', new Date()]);
    summarySheet.addRow(['Total de unidades', units.length]);
    summarySheet.addRow(['Total de cargas', fuels.length]);
    
    // Resumen por operador
    summarySheet.addRow([]);
    summarySheet.addRow(['RESUMEN POR OPERADOR']);
    summarySheet.getRow(6).font = { bold: true };
    
    const operatorStats = {};
    fuels.forEach(fuel => {
      if (!operatorStats[fuel.operatorName]) {
        operatorStats[fuel.operatorName] = {
          count: 0,
          liters: 0,
          amount: 0,
          paid: 0,
          unpaid: 0
        };
      }
      
      operatorStats[fuel.operatorName].count++;
      operatorStats[fuel.operatorName].liters += fuel.liters;
      operatorStats[fuel.operatorName].amount += fuel.amount;
      
      if (fuel.paymentStatus === 'pagada') {
        operatorStats[fuel.operatorName].paid++;
      } else {
        operatorStats[fuel.operatorName].unpaid++;
      }
    });
    
    // Añadir encabezados para estadísticas por operador
    summarySheet.addRow(['Operador', 'Cargas', 'Litros', 'Monto', 'Pagadas', 'No Pagadas']);
    summarySheet.getRow(7).font = { bold: true };
    
    // Añadir datos por operador
    for (const [operator, stats] of Object.entries(operatorStats)) {
      summarySheet.addRow([
        operator,
        stats.count,
        stats.liters,
        stats.amount,
        stats.paid,
        stats.unpaid
      ]);
    }
    
    // Guardar archivo
    await workbook.xlsx.writeFile(outputFile);
    
    logger.info(`Reporte Excel generado exitosamente: ${outputFile}`);
    return true;
  } catch (error) {
    logger.error(`Error al generar reporte Excel: ${error.message}`);
    throw error;
  }
}

/**
 * Crea un archivo ZIP comprimiendo todo el contenido de un directorio
 * @param {string} sourceDir - Directorio a comprimir
 * @param {string} outputFile - Ruta del archivo ZIP a generar
 */
async function createZipArchive(sourceDir, outputFile) {
  return new Promise((resolve, reject) => {
    try {
      // Crear un stream de escritura para el archivo ZIP
      const output = fs.createWriteStream(outputFile);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Nivel de compresión máximo
      });
      
      // Manejar eventos
      output.on('close', () => {
        logger.info(`Archivo ZIP creado: ${outputFile} (${formatBytes(archive.pointer())})`);
        resolve(true);
      });
      
      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          logger.warn(`Advertencia durante la compresión: ${err.message}`);
        } else {
          reject(err);
        }
      });
      
      archive.on('error', (err) => {
        reject(err);
      });
      
      // Pipe el resultado al archivo de salida
      archive.pipe(output);
      
      // Agregar todo el directorio al archivo ZIP
      archive.directory(sourceDir, false);
      
      // Finalizar el archivo
      archive.finalize();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Gestiona el historial de backups
 * Elimina los backups más antiguos si se supera el límite
 */
async function manageBackupHistory() {
  try {
    // Obtener lista de archivos ZIP en la carpeta de backups
    const files = await fs.readdir(BACKUPS_DIR);
    const zipFiles = files.filter(file => file.endsWith('.zip'));
    
    // Si no se supera el límite, no es necesario hacer nada
    if (zipFiles.length <= MAX_BACKUPS) {
      return;
    }
    
    // Ordenar por fecha de modificación (más antiguos primero)
    const fileStats = await Promise.all(
      zipFiles.map(async file => {
        const filePath = path.join(BACKUPS_DIR, file);
        const stats = await fs.stat(filePath);
        return {
          file,
          path: filePath,
          mtime: stats.mtime
        };
      })
    );
    
    fileStats.sort((a, b) => a.mtime - b.mtime);
    
    // Eliminar los backups más antiguos
    const filesToDelete = fileStats.slice(0, fileStats.length - MAX_BACKUPS);
    
    for (const fileInfo of filesToDelete) {
      logger.info(`Eliminando backup antiguo: ${fileInfo.file}`);
      await fs.remove(fileInfo.path);
    }
    
    logger.info(`Se eliminaron ${filesToDelete.length} backups antiguos`);
  } catch (error) {
    logger.error(`Error al gestionar historial de backups: ${error.message}`);
    // No interrumpir el proceso principal
  }
}

/**
 * Formatea una fecha para usar en nombres de archivo
 * @param {Date} date - Fecha a formatear
 * @returns {string} - Fecha formateada (AAAAMMDD_HHMMSS)
 */
function formatDateForFilename(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Formatea bytes a una representación legible (KB, MB, GB)
 * @param {number} bytes - Cantidad de bytes
 * @returns {string} - Representación legible
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Función principal que ejecuta el proceso
async function main() {
  try {
    await createBackup();
    process.exit(0);
  } catch (error) {
    logger.error(`Error en proceso principal de backup: ${error.message}`);
    process.exit(1);
  }
}

// Ejecutar script
main();