// scripts/actualizacion.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { connectToDatabase, disconnectFromDatabase } from '../src/db/connection.js';
import { Fuel } from '../src/models/fuel.model.js';
import { logger } from '../src/utils/logger.js';

// ============================================================
// CONFIGURACIÓN DE SEGURIDAD
// ============================================================
const MODO_SIMULACION = false;
const LIMITE_REGISTROS = 0;
const DEBUG = true;
// ============================================================

const FILE_PATH = path.resolve(process.cwd(), 'scripts', 'actualizacion.xlsx');

// Función para leer el archivo Excel
async function readExcelFile() {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      throw new Error(`El archivo actualizacion.xlsx no existe en ${FILE_PATH}`);
    }

    logger.info(`Leyendo archivo Excel: ${FILE_PATH}`);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(FILE_PATH);
    
    const worksheet = workbook.getWorksheet('Cargas');
    if (!worksheet) {
      throw new Error('No se encontró la hoja "Cargas" en el archivo Excel');
    }
    
    const rows = [];
    
    // Obtener encabezados (primera fila)
    const headers = [];
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber] = cell.value;
    });
    
    // Mostrar encabezados encontrados
    logger.info('=== ENCABEZADOS ENCONTRADOS EN EL EXCEL ===');
    headers.forEach((header, index) => {
      if (header) logger.info(`Columna ${index}: "${header}"`);
    });
    logger.info('==========================================');
    
    // Obtener datos
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const rowData = {};
        
        // IMPORTANTE: Usar forEach para asegurar que leemos TODAS las celdas
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const header = headers[colNumber];
          if (header) {
            // Manejar diferentes tipos de celdas
            if (cell.type === ExcelJS.ValueType.Date) {
              rowData[header] = cell.value;
            } else if (cell.type === ExcelJS.ValueType.Number) {
              rowData[header] = cell.value;
            } else if (cell.type === ExcelJS.ValueType.String) {
              rowData[header] = cell.value;
            } else if (cell.value !== null && cell.value !== undefined) {
              rowData[header] = cell.value.toString();
            } else {
              rowData[header] = null; // Explícitamente establecer null para celdas vacías
            }
          }
        });
        
        // Debug: Mostrar primera fila completa
        if (rowNumber === 2 && DEBUG) {
          logger.info('=== PRIMERA FILA DE DATOS ===');
          Object.entries(rowData).forEach(([key, value]) => {
            logger.info(`${key}: "${value}" (tipo: ${typeof value})`);
          });
          logger.info('============================');
        }
        
        rows.push(rowData);
      }
    });
    
    logger.info(`Se leyeron ${rows.length} registros del archivo Excel`);
    return rows;
  } catch (error) {
    logger.error(`Error al leer archivo Excel: ${error.message}`);
    throw error;
  }
}

// Función para buscar un registro en la base de datos
async function findRecord(rowData) {
  try {
    // Opción 1: Buscar por _id si está disponible
    if (rowData._id) {
      return await Fuel.findById(rowData._id);
    }
    
    const query = {};
    
    if (rowData.Fecha) {
      if (rowData.Fecha instanceof Date) {
        const startDate = new Date(rowData.Fecha);
        const endDate = new Date(rowData.Fecha);
        startDate.setMinutes(startDate.getMinutes() - 1);
        endDate.setMinutes(endDate.getMinutes() + 1);
        
        query.recordDate = {
          $gte: startDate,
          $lte: endDate
        };
      } else {
        const date = new Date(rowData.Fecha);
        if (!isNaN(date.getTime())) {
          const startDate = new Date(date);
          const endDate = new Date(date);
          startDate.setMinutes(startDate.getMinutes() - 1);
          endDate.setMinutes(endDate.getMinutes() + 1);
          
          query.recordDate = {
            $gte: startDate,
            $lte: endDate
          };
        }
      }
    }
    
    if (rowData.Operador) {
      query.operatorName = rowData.Operador;
    }
    
    if (rowData.Unidad) {
      query.unitNumber = rowData.Unidad;
    }
    
    if (rowData.Tipo) {
      query.fuelType = rowData.Tipo;
    }
    
    const requiredFields = ['recordDate', 'operatorName', 'unitNumber'];
    const missingFields = requiredFields.filter(field => !query[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`No se pueden identificar registros sin los campos: ${missingFields.join(', ')}`);
    }
    
    const records = await Fuel.find(query);
    
    if (records.length === 0) {
      return null;
    } else if (records.length > 1) {
      const filteredRecords = records.filter(record => {
        let match = true;
        
        if (rowData.Litros !== undefined && record.liters !== parseFloat(rowData.Litros)) {
          match = false;
        }
        
        if (rowData.Monto !== undefined && record.amount !== parseFloat(rowData.Monto)) {
          match = false;
        }
        
        return match;
      });
      
      if (filteredRecords.length === 1) {
        return filteredRecords[0];
      }
      
      throw new Error(`Se encontraron múltiples registros (${records.length}) para la consulta.`);
    }
    
    return records[0];
  } catch (error) {
    logger.error(`Error al buscar registro: ${error.message}`);
    throw error;
  }
}

// Función corregida para actualizar registro
async function updateRecord(record, rowData) {
  try {
    let modified = false;
    const changes = [];
    
    // ACTUALIZADO: Posibles nombres de columna para número de venta
    const possibleSaleNumberColumns = [
      'Número de Venta',
      'Numero de Venta',
      'Número de venta',
      'Numero de venta',
      'Num. Venta',
      'Núm. Venta',
      'No. Venta',
      'NumVenta'
    ];
    
    // Buscar la columna de número de venta con cualquiera de los nombres posibles
    let saleNumberColumnName = null;
    for (const colName of possibleSaleNumberColumns) {
      if (rowData.hasOwnProperty(colName)) {
        saleNumberColumnName = colName;
        break;
      }
    }
    
    // Mapeo de campos
    const fieldMappings = {
      'Fecha': 'recordDate',
      'Operador': 'operatorName',
      'Unidad': 'unitNumber',
      'Tipo': 'fuelType',
      'Litros': 'liters',
      'Monto': 'amount',
      'Estatus': 'paymentStatus',
      'Fecha Pago': 'paymentDate'
    };
    
    // Añadir el mapeo de número de venta si encontramos la columna
    if (saleNumberColumnName) {
      fieldMappings[saleNumberColumnName] = 'saleNumber';
    }
    
    if (DEBUG) {
      logger.info(`\n=== PROCESANDO REGISTRO ID: ${record._id} ===`);
      logger.info(`Campos en Excel: ${Object.keys(rowData).join(', ')}`);
      if (saleNumberColumnName) {
        logger.info(`Columna de número de venta encontrada: "${saleNumberColumnName}"`);
      } else {
        logger.warn('No se encontró columna de número de venta');
      }
    }
    
    const originalRecord = JSON.parse(JSON.stringify(record.toObject()));
    
    // Verificar y actualizar cada campo
    for (const [excelField, modelField] of Object.entries(fieldMappings)) {
      if (DEBUG) {
        logger.info(`\nProcesando campo: ${excelField} -> ${modelField}`);
      }
      
      // Obtener valor del Excel
      let excelValue = rowData[excelField];
      
      // Log especial para número de venta
      if (modelField === 'saleNumber' && DEBUG) {
        logger.info(`Valor raw del Excel para número de venta: "${excelValue}" (tipo: ${typeof excelValue})`);
      }
      
      // Verificar si hay un valor para procesar
      if (excelValue !== undefined) {
        let newValue = excelValue;
        
        if (DEBUG) {
          logger.info(`Valor en Excel para ${excelField}: "${newValue}" (tipo: ${typeof newValue})`);
          logger.info(`Valor actual en BD para ${modelField}: "${record[modelField]}" (tipo: ${typeof record[modelField]})`);
        }
        
        // Conversiones según tipo de campo
        if (modelField === 'liters' || modelField === 'amount') {
          newValue = parseFloat(newValue);
          if (isNaN(newValue)) {
            logger.warn(`Valor numérico inválido para ${excelField}: ${excelValue}`);
            continue;
          }
        } else if (modelField === 'paymentStatus') {
          if (newValue === null || newValue === '') {
            continue; // Saltar si está vacío
          }
          newValue = newValue.toString().toLowerCase().trim();
          newValue = (newValue === 'pagada' || newValue === 'pagado') ? 'pagada' : 'no pagada';
        } else if (modelField === 'saleNumber') {
          // Manejo especial para número de venta
          if (newValue === null || newValue === '' || newValue === undefined || newValue === 'N/A' || newValue === 'null') {
            newValue = null;
          } else {
            // Convertir a string y limpiar
            newValue = newValue.toString().trim();
            
            // Validar formato (1-6 caracteres alfanuméricos)
            if (!/^[A-Za-z0-9-]{1,6}$/.test(newValue)) {
              logger.warn(`Número de venta inválido: "${newValue}"`);
              newValue = null;
            }
          }
          
          if (DEBUG) {
            logger.info(`Número de venta procesado: "${newValue}"`);
          }
        } else if (modelField === 'operatorName' || modelField === 'unitNumber' || modelField === 'fuelType') {
          if (newValue === null || newValue === '') {
            continue;
          }
          newValue = newValue.toString().trim();
        }
        
        // Manejar fechas
        if (modelField === 'recordDate' || modelField === 'paymentDate') {
          if (newValue && newValue !== '') {
            if (!(newValue instanceof Date)) {
              newValue = new Date(newValue);
            }
            
            if (isNaN(newValue.getTime())) {
              logger.warn(`Fecha inválida para ${excelField}: ${excelValue}`);
              continue;
            }
          } else if (modelField === 'paymentDate') {
            newValue = null;
          } else if (modelField === 'recordDate') {
            continue;
          }
        }
        
        // Comparar valores
        const oldValue = record[modelField];
        let valuesDiffer = false;
        
        if (oldValue instanceof Date && newValue instanceof Date) {
          valuesDiffer = oldValue.getTime() !== newValue.getTime();
        } else if (modelField === 'liters' || modelField === 'amount') {
          valuesDiffer = Math.abs((oldValue || 0) - newValue) > 0.001;
        } else if (modelField === 'saleNumber') {
          // Comparación especial para número de venta
          const oldValueStr = oldValue ? oldValue.toString() : null;
          const newValueStr = newValue ? newValue.toString() : null;
          valuesDiffer = oldValueStr !== newValueStr;
          
          if (DEBUG) {
            logger.info(`Comparando número de venta: "${oldValueStr}" vs "${newValueStr}" - Diferente: ${valuesDiffer}`);
          }
        } else {
          // Comparación general
          valuesDiffer = String(oldValue || '') !== String(newValue || '');
        }
        
        if (valuesDiffer) {
          record[modelField] = newValue;
          
          changes.push({
            field: modelField,
            oldValue,
            newValue
          });
          
          modified = true;
          
          if (DEBUG) {
            logger.info(`CAMBIO DETECTADO: ${modelField} de "${oldValue}" a "${newValue}"`);
          }
        }
      }
    }
    
    // Lógica para fecha de pago automática
    if (record.paymentStatus === 'pagada' && !record.paymentDate) {
      record.paymentDate = new Date();
      changes.push({
        field: 'paymentDate',
        oldValue: null,
        newValue: record.paymentDate
      });
      modified = true;
    }
    
    if (record.paymentStatus === 'no pagada' && record.paymentDate) {
      const oldValue = record.paymentDate;
      record.paymentDate = null;
      changes.push({
        field: 'paymentDate',
        oldValue,
        newValue: null
      });
      modified = true;
    }
    
    // Guardar cambios
    if (modified) {
      if (!MODO_SIMULACION) {
        await record.save();
        if (DEBUG) {
          logger.info('Cambios guardados en la base de datos');
        }
      } else {
        Object.keys(originalRecord).forEach(key => {
          if (key !== '_id') {
            record[key] = originalRecord[key];
          }
        });
        if (DEBUG) {
          logger.info('MODO SIMULACIÓN: Cambios NO guardados');
        }
      }
    }
    
    return {
      modified,
      changes
    };
  } catch (error) {
    logger.error(`Error al actualizar registro: ${error.message}`);
    throw error;
  }
}

// El resto de las funciones sin cambios...
function formatValueForLog(value) {
  if (value === null || value === undefined) {
    return 'null';
  } else if (value instanceof Date) {
    return value.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
  } else if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value.toString();
}

function solicitarConfirmacion() {
  return new Promise(resolve => {
    process.stdout.write('\n');
    if (MODO_SIMULACION) {
      process.stdout.write('⚠️  MODO SIMULACIÓN ACTIVADO - No se guardarán cambios en la base de datos\n');
    } else {
      process.stdout.write('⚠️⚠️⚠️  MODO ACTUALIZACIÓN REAL - Los cambios se guardarán en la base de datos ⚠️⚠️⚠️\n');
    }
    
    if (LIMITE_REGISTROS > 0) {
      process.stdout.write(`📋 Limitando a ${LIMITE_REGISTROS} registros por seguridad\n`);
    }
    
    process.stdout.write('\n¿Deseas continuar? (s/n): ');
    
    process.stdin.once('data', data => {
      const respuesta = data.toString().trim().toLowerCase();
      resolve(respuesta === 's' || respuesta === 'si' || respuesta === 'y' || respuesta === 'yes');
    });
  });
}

async function main() {
  try {
    logger.info('=== INICIANDO PROCESO DE ACTUALIZACIÓN ===');
    
    if (MODO_SIMULACION) {
      logger.info('🔍 EJECUTANDO EN MODO SIMULACIÓN - No se guardarán cambios');
    } else {
      logger.info('⚠️ EJECUTANDO EN MODO REAL - Se guardarán cambios permanentemente');
    }
    
    const confirmado = await solicitarConfirmacion();
    if (!confirmado) {
      logger.info('🛑 Proceso cancelado por el usuario');
      process.exit(0);
    }
    
    const rows = await readExcelFile();
    await connectToDatabase();
    
    let totalRecords = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;
    let recordsNotFound = 0;
    
    for (const [index, rowData] of rows.entries()) {
      totalRecords++;
      
      try {
        const record = await findRecord(rowData);
        
        if (!record) {
          logger.warn(`⚠ Registro no encontrado para: operador "${rowData.Operador}", fecha "${rowData.Fecha}", fila ${index + 2}`);
          recordsNotFound++;
          continue;
        }
        
        const recordIdentifier = `operador "${record.operatorName}", fecha "${record.recordDate}", ID: ${record._id}`;
        logger.info(`\n✔ Registro identificado correctamente: ${recordIdentifier}`);
        
        const { modified, changes } = await updateRecord(record, rowData);
        
        if (modified) {
          logger.info(`📝 Se detectaron ${changes.length} cambios:`);
          for (const change of changes) {
            const oldValueFormatted = formatValueForLog(change.oldValue);
            const newValueFormatted = formatValueForLog(change.newValue);
            logger.info(`   ↻ ${change.field}: "${oldValueFormatted}" → "${newValueFormatted}"`);
          }
          
          if (MODO_SIMULACION) {
            logger.info(`🔍 SIMULACIÓN: El registro sería actualizado (no se guardó)`);
          } else {
            logger.info(`✅ Registro actualizado con éxito`);
          }
          recordsUpdated++;
        } else {
          logger.info(`✔ Registro sin cambios: ${recordIdentifier}`);
          recordsSkipped++;
        }
      } catch (error) {
        logger.error(`❌ Error al procesar fila ${index + 2}: ${error.message}`);
        continue;
      }
    }
    
    logger.info('\n=== RESUMEN DE ACTUALIZACIÓN ===');
    if (MODO_SIMULACION) {
      logger.info('🔍 RESULTADO DE SIMULACIÓN (ningún cambio fue guardado)');
    }
    logger.info(`Total de registros procesados: ${totalRecords}`);
    logger.info(`Registros actualizados: ${recordsUpdated}`);
    logger.info(`Registros sin cambios: ${recordsSkipped}`);
    logger.info(`Registros no encontrados: ${recordsNotFound}`);
    
    await disconnectFromDatabase();
    logger.info('=== PROCESO DE ACTUALIZACIÓN COMPLETADO ===\n');
  } catch (error) {
    logger.error(`Error en proceso principal: ${error.message}`);
    
    try {
      await disconnectFromDatabase();
    } catch (disconnectError) {
      logger.error(`Error al desconectar de la base de datos: ${disconnectError.message}`);
    }
    
    process.exit(1);
  }
}

main();