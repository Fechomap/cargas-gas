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
// ✓ MODO SIMULACIÓN: true = solo simula cambios (no guarda), false = aplica cambios
const MODO_SIMULACION = false;
// ✓ LÍMITE DE REGISTROS: Limita la cantidad de registros a procesar (0 = sin límite)
const LIMITE_REGISTROS = 0;
// ============================================================

// Ruta al archivo Excel
const FILE_PATH = path.resolve(process.cwd(), 'scripts', 'actualizacion.xlsx');

// Función para leer el archivo Excel
async function readExcelFile() {
  try {
    // Verificar si el archivo existe
    if (!fs.existsSync(FILE_PATH)) {
      throw new Error(`El archivo actualizacion.xlsx no existe en ${FILE_PATH}`);
    }

    logger.info(`Leyendo archivo Excel: ${FILE_PATH}`);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(FILE_PATH);
    
    // Asumimos que los datos están en la primera hoja ("Cargas")
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
    
    // Obtener datos
    worksheet.eachRow((row, rowNumber) => {
      // Omitir fila de encabezados
      if (rowNumber > 1) {
        const rowData = {};
        
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber];
          if (header) {
            // Manejar tipos de datos específicamente
            if (cell.type === ExcelJS.ValueType.Date) {
              rowData[header] = cell.value; // ExcelJS ya convierte a Date
            } else {
              rowData[header] = cell.value;
            }
          }
        });
        
        rows.push(rowData);
      }
    });
    
    logger.info(`Se leyeron ${rows.length} registros del archivo Excel`);
    
    // Aplicar límite de registros si está configurado
    if (LIMITE_REGISTROS > 0 && rows.length > LIMITE_REGISTROS) {
      logger.info(`⚠️ LIMITANDO A ${LIMITE_REGISTROS} REGISTROS POR SEGURIDAD`);
      return rows.slice(0, LIMITE_REGISTROS);
    }
    
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
    
    // Opción 2: Buscar por combinación de campos
    const query = {};
    
    // Verificar campos clave disponibles para la búsqueda
    if (rowData.Fecha) {
      if (rowData.Fecha instanceof Date) {
        // Crear un rango de 1 minuto alrededor de la fecha para manejar diferencias de precisión
        const startDate = new Date(rowData.Fecha);
        const endDate = new Date(rowData.Fecha);
        startDate.setMinutes(startDate.getMinutes() - 1);
        endDate.setMinutes(endDate.getMinutes() + 1);
        
        query.recordDate = {
          $gte: startDate,
          $lte: endDate
        };
      } else {
        // Si no es un objeto Date, intentar convertirlo
        const date = new Date(rowData.Fecha);
        if (!isNaN(date.getTime())) {
          // Mismo enfoque de rango
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
    
    // Verificar que tenemos suficientes campos para una búsqueda precisa
    const requiredFields = ['recordDate', 'operatorName', 'unitNumber'];
    const missingFields = requiredFields.filter(field => !query[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`No se pueden identificar registros sin los campos: ${missingFields.join(', ')}`);
    }
    
    // Buscar registros que coincidan
    const records = await Fuel.find(query);
    
    // Verificar unicidad
    if (records.length === 0) {
      return null; // No se encontró registro
    } else if (records.length > 1) {
      // Intento adicional para reducir ambigüedad
      // Filtrar por litros y monto si están disponibles
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
      
      throw new Error(`Se encontraron múltiples registros (${records.length}) para la consulta. No se puede actualizar de forma segura.`);
    }
    
    return records[0];
  } catch (error) {
    logger.error(`Error al buscar registro: ${error.message}`);
    throw error;
  }
}

// Función para comparar y actualizar un registro
async function updateRecord(record, rowData) {
  try {
    let modified = false;
    const changes = [];
    
    // Mapeo de campos del Excel a campos del modelo
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
    
    // Clonar el registro original para simulación
    const originalRecord = JSON.parse(JSON.stringify(record.toObject()));
    
    // Verificar y actualizar cada campo
    for (const [excelField, modelField] of Object.entries(fieldMappings)) {
      if (rowData[excelField] !== undefined) {
        let newValue = rowData[excelField];
        
        // Conversiones específicas
        if (modelField === 'liters' || modelField === 'amount') {
          newValue = parseFloat(newValue);
        } else if (modelField === 'paymentStatus') {
          // Normalizar estatus
          newValue = newValue.toLowerCase() === 'pagada' || newValue.toLowerCase() === 'pagado' ? 'pagada' : 'no pagada';
        }
        
        // Manejar campos de fecha
        if (modelField === 'recordDate' || modelField === 'paymentDate') {
          if (newValue) {
            // Si es una fecha válida, usarla
            if (newValue instanceof Date) {
              // Ya es un objeto Date, no necesita conversión
            } else {
              // Intentar convertir a Date
              newValue = new Date(newValue);
              
              // Verificar si es una fecha válida
              if (isNaN(newValue.getTime())) {
                logger.warn(`Se proporcionó un valor de fecha inválido para ${excelField}: ${rowData[excelField]}`);
                continue; // Saltar este campo
              }
            }
          } else {
            // Si el campo está vacío y es fecha de pago, establecer como null
            if (modelField === 'paymentDate') {
              newValue = null;
            } else if (modelField === 'recordDate') {
              // No actualizar fecha de registro si está vacía
              continue;
            }
          }
        }
        
        // Comparar valores y actualizar si es diferente
        const oldValue = record[modelField];
        let valuesDiffer = false;
        
        // Manejo especial para fechas
        if (oldValue instanceof Date && newValue instanceof Date) {
          valuesDiffer = oldValue.getTime() !== newValue.getTime();
        } else {
          valuesDiffer = JSON.stringify(oldValue) !== JSON.stringify(newValue);
        }
        
        if (valuesDiffer) {
          record[modelField] = newValue;
          
          changes.push({
            field: modelField,
            oldValue,
            newValue
          });
          
          modified = true;
        }
      }
    }
    
    // Si se estableció el estatus a "pagada" pero no hay fecha de pago, añadir la fecha actual
    if (record.paymentStatus === 'pagada' && !record.paymentDate) {
      record.paymentDate = new Date();
      changes.push({
        field: 'paymentDate',
        oldValue: null,
        newValue: record.paymentDate
      });
      modified = true;
    }
    
    // Si se cambió el estatus a "no pagada", eliminar la fecha de pago
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
    
    // Guardar cambios si hubo modificaciones y NO estamos en modo simulación
    if (modified && !MODO_SIMULACION) {
      await record.save();
    } else if (modified && MODO_SIMULACION) {
      // En modo simulación, restaurar el registro original
      Object.keys(originalRecord).forEach(key => {
        if (key !== '_id') {
          record[key] = originalRecord[key];
        }
      });
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

// Función para formatear valor para log
function formatValueForLog(value) {
  if (value === null || value === undefined) {
    return 'null';
  } else if (value instanceof Date) {
    return value.toISOString();
  } else if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value.toString();
}

// Función para solicitar confirmación al usuario
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

// Función principal que ejecuta el proceso
async function main() {
  try {
    logger.info('=== INICIANDO PROCESO DE ACTUALIZACIÓN ===');
    
    if (MODO_SIMULACION) {
      logger.info('🔍 EJECUTANDO EN MODO SIMULACIÓN - No se guardarán cambios');
    } else {
      logger.info('⚠️ EJECUTANDO EN MODO REAL - Se guardarán cambios permanentemente');
    }
    
    // Solicitar confirmación antes de continuar
    const confirmado = await solicitarConfirmacion();
    if (!confirmado) {
      logger.info('🛑 Proceso cancelado por el usuario');
      process.exit(0);
    }
    
    // Leer archivo Excel
    const rows = await readExcelFile();
    
    // Conectar a la base de datos
    await connectToDatabase();
    
    // Estadísticas de proceso
    let totalRecords = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;
    let recordsNotFound = 0;
    
    // Procesar cada fila
    for (const [index, rowData] of rows.entries()) {
      totalRecords++;
      
      try {
        // Buscar registro en la base de datos
        const record = await findRecord(rowData);
        
        if (!record) {
          logger.warn(`⚠ Registro no encontrado para: operador "${rowData.Operador}", fecha "${rowData.Fecha}"`);
          recordsNotFound++;
          continue;
        }
        
        // Identificación para log
        const recordIdentifier = `operador "${record.operatorName}", fecha "${record.recordDate}", ID: ${record._id}`;
        logger.info(`✔ Registro identificado correctamente para: ${recordIdentifier}`);
        
        // Actualizar registro
        const { modified, changes } = await updateRecord(record, rowData);
        
        if (modified) {
          // Mostrar cambios realizados
          for (const change of changes) {
            const oldValueFormatted = formatValueForLog(change.oldValue);
            const newValueFormatted = formatValueForLog(change.newValue);
            logger.info(`↻ Campo modificado: ${change.field} (de ${oldValueFormatted} → ${newValueFormatted})`);
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
        logger.error(`Error al procesar fila ${index + 2}: ${error.message}`);
        continue; // Continuar con el siguiente registro
      }
    }
    
    // Mostrar resumen final
    logger.info('=== RESUMEN DE ACTUALIZACIÓN ===');
    if (MODO_SIMULACION) {
      logger.info('🔍 RESULTADO DE SIMULACIÓN (ningún cambio fue guardado)');
    }
    logger.info(`Total de registros procesados: ${totalRecords}`);
    logger.info(`Registros que serían actualizados: ${recordsUpdated}`);
    logger.info(`Registros sin cambios: ${recordsSkipped}`);
    logger.info(`Registros no encontrados: ${recordsNotFound}`);
    
    // Desconectar de la base de datos
    await disconnectFromDatabase();
    logger.info('=== PROCESO DE ACTUALIZACIÓN COMPLETADO ===');
  } catch (error) {
    logger.error(`Error en proceso principal: ${error.message}`);
    
    // Intentar desconectar de la base de datos en caso de error
    try {
      await disconnectFromDatabase();
    } catch (disconnectError) {
      logger.error(`Error al desconectar de la base de datos: ${disconnectError.message}`);
    }
    
    process.exit(1);
  }
}

// Ejecutar script
main();