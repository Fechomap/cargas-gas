// scripts/db-cleanup.js
import 'dotenv/config';
import { connectToDatabase, disconnectFromDatabase } from '../src/db/connection.js';
import mongoose from 'mongoose';
import readline from 'readline';
import { logger } from '../src/utils/logger.js';

// Crear interfaz para leer entrada del usuario
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Función para preguntar al usuario (Promise-based)
function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer.trim());
    });
  });
}

// Función para listar colecciones disponibles
async function listCollections() {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    return collections.map(collection => collection.name);
  } catch (error) {
    logger.error(`Error al listar colecciones: ${error.message}`);
    return [];
  }
}

// Función para borrar una colección específica
async function deleteCollection(collectionName) {
  try {
    await mongoose.connection.db.dropCollection(collectionName);
    logger.info(`Colección "${collectionName}" eliminada correctamente`);
    return true;
  } catch (error) {
    logger.error(`Error al eliminar colección "${collectionName}": ${error.message}`);
    return false;
  }
}

// Función para borrar documentos según un filtro
async function deleteDocuments(collectionName, filterStr) {
  try {
    let filter = {};
    
    // Si hay un filtro, interpretarlo como JSON
    if (filterStr && filterStr.trim() !== '') {
      try {
        filter = JSON.parse(filterStr);
      } catch (parseError) {
        logger.error(`Error al parsear filtro JSON: ${parseError.message}`);
        return { success: false, count: 0, error: 'Formato JSON inválido' };
      }
    }
    
    const collection = mongoose.connection.db.collection(collectionName);
    
    // Contar documentos que serán eliminados
    const count = await collection.countDocuments(filter);
    if (count === 0) {
      return { success: true, count: 0, error: null };
    }
    
    // Eliminar documentos
    const result = await collection.deleteMany(filter);
    return { 
      success: true, 
      count: result.deletedCount,
      error: null 
    };
  } catch (error) {
    logger.error(`Error al eliminar documentos: ${error.message}`);
    return { success: false, count: 0, error: error.message };
  }
}

// Función principal
async function main() {
  try {
    console.log('=== HERRAMIENTA DE LIMPIEZA DE MONGODB ===');
    console.log('ADVERTENCIA: Esta herramienta eliminará datos permanentemente.');
    console.log('Asegúrate de tener un backup antes de continuar.\n');
    
    // Conectar a la base de datos
    console.log('Conectando a MongoDB...');
    await connectToDatabase();
    console.log('Conexión establecida\n');
    
    // Verificar la base de datos y ambiente
    const dbName = mongoose.connection.db.databaseName;
    console.log(`Base de datos actual: ${dbName}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}\n`);
    
    // Confirmación inicial
    const confirmEnv = await askQuestion(`Por favor, escribe el nombre del ambiente (${process.env.NODE_ENV || 'development'}) para confirmar: `);
    
    if (confirmEnv.toLowerCase() !== (process.env.NODE_ENV || 'development').toLowerCase()) {
      console.log('Confirmación incorrecta. Operación cancelada por seguridad.');
      await disconnectFromDatabase();
      rl.close();
      return;
    }
    
    // Listar colecciones disponibles
    console.log('\nObteniendo colecciones disponibles...');
    const collections = await listCollections();
    
    if (collections.length === 0) {
      console.log('No se encontraron colecciones en la base de datos.');
      await disconnectFromDatabase();
      rl.close();
      return;
    }
    
    console.log('Colecciones disponibles:');
    collections.forEach((name, index) => {
      console.log(`${index + 1}. ${name}`);
    });
    
    // Seleccionar colección
    const collectionIndex = await askQuestion('\nSelecciona el número de la colección o escribe "todas" para ver todas las opciones: ');
    
    if (collectionIndex.toLowerCase() === 'todas') {
      // Mostrar menú para todas las colecciones
      const allOption = await askQuestion(
        '\nSelecciona una opción:\n' +
        '1. Eliminar TODAS las colecciones (borrar toda la base de datos)\n' +
        '2. Volver a selección de colección individual\n' +
        'Opción: '
      );
      
      if (allOption === '1') {
        const confirmAll = await askQuestion(`\n⚠️ ADVERTENCIA: Esto eliminará TODA la base de datos "${dbName}".\n` +
          `Para confirmar, escribe "BORRAR ${dbName.toUpperCase()}": `);
        
        if (confirmAll === `BORRAR ${dbName.toUpperCase()}`) {
          console.log('\nEliminando todas las colecciones...');
          
          for (const collection of collections) {
            const deleted = await deleteCollection(collection);
            console.log(`- ${collection}: ${deleted ? 'Eliminada' : 'Error'}`);
          }
          
          console.log('\nOperación completada.');
        } else {
          console.log('Confirmación incorrecta. Operación cancelada por seguridad.');
        }
      } else {
        // Volver al inicio del script (recursivaente sería mejor, pero para simplificar)
        console.log('Volviendo a la selección de colección...');
        main();
        return;
      }
    } else {
      // Validar selección de colección
      const index = parseInt(collectionIndex, 10) - 1;
      
      if (isNaN(index) || index < 0 || index >= collections.length) {
        console.log('Selección inválida. Operación cancelada.');
        await disconnectFromDatabase();
        rl.close();
        return;
      }
      
      const selectedCollection = collections[index];
      console.log(`\nColección seleccionada: ${selectedCollection}`);
      
      // Opciones para la colección seleccionada
      const actionOption = await askQuestion(
        '\nSelecciona una acción:\n' +
        '1. Eliminar TODA la colección\n' +
        '2. Eliminar documentos específicos mediante filtro\n' +
        'Opción: '
      );
      
      if (actionOption === '1') {
        // Eliminar toda la colección
        const confirmDelete = await askQuestion(`\n⚠️ ADVERTENCIA: Esto eliminará TODOS los documentos de "${selectedCollection}".\n` +
          `Para confirmar, escribe "BORRAR ${selectedCollection.toUpperCase()}": `);
        
        if (confirmDelete === `BORRAR ${selectedCollection.toUpperCase()}`) {
          console.log(`\nEliminando colección "${selectedCollection}"...`);
          const deleted = await deleteCollection(selectedCollection);
          
          if (deleted) {
            console.log('Colección eliminada correctamente.');
          } else {
            console.log('No se pudo eliminar la colección. Verifica los logs para más detalles.');
          }
        } else {
          console.log('Confirmación incorrecta. Operación cancelada por seguridad.');
        }
      } else if (actionOption === '2') {
        // Eliminar documentos mediante filtro
        console.log('\n--- Eliminación mediante filtro ---');
        console.log('Ingresa un filtro en formato JSON, por ejemplo:');
        console.log('{"paymentStatus": "no pagada"} - Para eliminar cargas no pagadas');
        console.log('{"operatorName": "Ricardo"} - Para eliminar registros de un operador específico');
        console.log('{}                          - Para eliminar TODOS los documentos');
        
        const filterStr = await askQuestion('\nFiltro (formato JSON): ');
        
        try {
          // Contar documentos que serán afectados
          const collection = mongoose.connection.db.collection(selectedCollection);
          const filter = filterStr.trim() !== '' ? JSON.parse(filterStr) : {};
          const count = await collection.countDocuments(filter);
          
          console.log(`\nSe encontraron ${count} documentos que coinciden con el filtro.`);
          
          if (count > 0) {
            // Doble confirmación
            const confirmFilter = await askQuestion(`\n⚠️ ADVERTENCIA: Esto eliminará ${count} documentos de "${selectedCollection}".\n` +
              `Para confirmar, escribe "ELIMINAR ${count} DOCUMENTOS": `);
            
            if (confirmFilter === `ELIMINAR ${count} DOCUMENTOS`) {
              console.log('\nEliminando documentos...');
              const result = await deleteDocuments(selectedCollection, filterStr);
              
              if (result.success) {
                console.log(`Se eliminaron ${result.count} documentos correctamente.`);
              } else {
                console.log(`Error: ${result.error}`);
              }
            } else {
              console.log('Confirmación incorrecta. Operación cancelada por seguridad.');
            }
          }
        } catch (error) {
          console.log(`Error: ${error.message}`);
        }
      } else {
        console.log('Opción inválida. Operación cancelada.');
      }
    }
    
    // Desconectar de la base de datos
    await disconnectFromDatabase();
    console.log('\nDesconexión de la base de datos realizada.');
  } catch (error) {
    console.error(`Error: ${error.message}`);
  } finally {
    rl.close();
  }
}

// Ejecutar script
main();