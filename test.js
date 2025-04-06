// test.js - Script de prueba de integración
import 'dotenv/config';
import mongoose from 'mongoose';
import { Telegraf } from 'telegraf';
import fs from 'fs';
import path from 'path';

async function testEnvironmentVariables() {
    console.log('\n=== Prueba de Variables de Entorno ===');
    
    const requiredVars = [
        { name: 'TELEGRAM_BOT_TOKEN', desc: 'Token del bot de Telegram' },
        { name: 'MONGODB_URI', desc: 'URI de conexión a MongoDB' },
        { name: 'MONGODB_DB_NAME', desc: 'Nombre de la base de datos MongoDB' }
    ];
    
    let allVarsOk = true;
    
    for (const varInfo of requiredVars) {
        const value = process.env[varInfo.name];
        
        if (!value) {
            console.error(`❌ Falta ${varInfo.desc} (${varInfo.name})`);
            allVarsOk = false;
            continue;
        }
        
        // Mostrar valor enmascarado para datos sensibles
        let displayValue = value;
        if (varInfo.name === 'TELEGRAM_BOT_TOKEN' || varInfo.name === 'MONGODB_URI') {
            displayValue = value.substring(0, 10) + '...';
        }
        
        console.log(`✅ ${varInfo.name}: ${displayValue}`);
    }
    
    if (allVarsOk) {
        console.log('✅ Todas las variables de entorno requeridas están configuradas');
    } else {
        console.error('❌ Faltan algunas variables de entorno');
    }
    
    return allVarsOk;
}

async function testMongoDBConnection() {
    console.log('\n=== Prueba de Conexión a MongoDB ===');
    
    // Obtener detalles de conexión a MongoDB desde variables de entorno
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB_NAME;
    
    if (!uri) {
        console.error('❌ Falta la URI de MongoDB en las variables de entorno');
        return false;
    }
    
    if (!dbName) {
        console.error('❌ Falta el nombre de la base de datos MongoDB en las variables de entorno');
        console.error('   Intentando conexión sin nombre de base de datos explícito');
    }
    
    console.log(`Conectando a MongoDB con URI: ${uri.substring(0, 15)}...`);
    console.log(`Nombre de la base de datos: ${dbName || 'Usando valor predeterminado de la cadena de conexión'}`);
    
    try {
        // Intentar conexión con mongoose (como se usa en el proyecto)
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            dbName: dbName
        });
        
        console.log('✅ Conexión exitosa a MongoDB');
        console.log(`Conectado a la base de datos: ${mongoose.connection.db.databaseName}`);
        
        // Probar la conexión listando colecciones
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`Colecciones en la base de datos: ${collections.length}`);
        if (collections.length > 0) {
            console.log('Colecciones encontradas:');
            collections.forEach(collection => {
                console.log(`- ${collection.name}`);
            });
        } else {
            console.log('No se encontraron colecciones (base de datos vacía)');
        }
        
        return true;
    } catch (error) {
        console.error(`❌ Error al conectar a MongoDB: ${error.message}`);
        
        // Diagnósticos específicos para problemas de conexión a MongoDB
        if (error.message.includes('bad auth')) {
            console.error('\nSe detectó un error de autenticación:');
            console.error('1. Verifica el usuario y contraseña en tu URI de MongoDB');
            console.error('2. Comprueba que el usuario tenga los permisos adecuados');
            console.error('3. Asegúrate de que el método de autenticación sea correcto (SCRAM-SHA-1, etc.)');
        } else if (error.message.includes('ENOTFOUND')) {
            console.error('\nError de host no encontrado:');
            console.error('1. Revisa el nombre de host en tu URI de MongoDB');
            console.error('2. Verifica tu conexión a Internet');
            console.error('3. Comprueba que la resolución DNS esté funcionando correctamente');
        }
        
        return false;
    } finally {
        // Cerrar la conexión si se abrió
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
            console.log('Conexión a MongoDB cerrada');
        }
    }
}

async function testTelegramBot() {
    console.log('\n=== Prueba del Bot de Telegram ===');
    
    const token = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!token) {
        console.error('❌ Falta el token del bot de Telegram en las variables de entorno');
        return false;
    }
    
    console.log(`Probando bot con token: ${token.substring(0, 10)}...`);
    
    try {
        // Inicializar el bot
        const bot = new Telegraf(token);
        
        // Probar el bot obteniendo su información
        const botInfo = await bot.telegram.getMe();
        console.log('✅ Conexión exitosa a la API de Telegram');
        console.log(`Nombre de usuario del bot: @${botInfo.username}`);
        console.log(`ID del bot: ${botInfo.id}`);
        
        return true;
    } catch (error) {
        console.error(`❌ Error al conectar a la API de Telegram: ${error.message}`);
        
        if (error.message.includes('401')) {
            console.error('\nError de no autorizado:');
            console.error('1. El token del bot es inválido o ha expirado');
            console.error('2. Obtén un nuevo token de BotFather');
        } else if (error.message.includes('ETIMEDOUT')) {
            console.error('\nTimeout de conexión:');
            console.error('1. Revisa tu conexión a Internet');
            console.error('2. Verifica que la API de Telegram no esté bloqueada en tu región');
        }
        
        return false;
    }
}

async function testProjectImports() {
    console.log('\n=== Prueba de Importaciones Críticas del Proyecto ===');
    
    const criticalImports = [
        { path: './src/db/connection.js', desc: 'Módulo de conexión a la base de datos' },
        { path: './src/api/telegram.api.js', desc: 'Módulo de API de Telegram' },
        { path: './src/commands/index.js', desc: 'Registro de comandos' },
        { path: './src/models/unit.model.js', desc: 'Modelo de unidad' },
        { path: './src/models/fuel.model.js', desc: 'Modelo de combustible' },
        { path: './src/utils/logger.js', desc: 'Utilidad de registro' }
    ];
    
    let allImportsOk = true;
    
    for (const importItem of criticalImports) {
        try {
            console.log(`Probando importación: ${importItem.desc} (${importItem.path})...`);
            
            // Intentar importar dinámicamente el módulo
            const module = await import(importItem.path);
            
            // Verificar si el módulo tiene las exportaciones esperadas
            if (importItem.path.includes('connection.js')) {
                if (typeof module.connectToDatabase !== 'function') {
                    console.error(`❌ Falta exportación esperada: función connectToDatabase`);
                    allImportsOk = false;
                    continue;
                }
            } else if (importItem.path.includes('telegram.api.js')) {
                if (typeof module.initializeBot !== 'function') {
                    console.error(`❌ Falta exportación esperada: función initializeBot`);
                    allImportsOk = false;
                    continue;
                }
            }
            
            console.log(`✅ Importación exitosa de ${importItem.desc}`);
        } catch (error) {
            console.error(`❌ Error al importar ${importItem.desc}: ${error.message}`);
            allImportsOk = false;
        }
    }
    
    if (allImportsOk) {
        console.log('✅ Todas las importaciones críticas fueron exitosas');
    } else {
        console.error('❌ Algunas importaciones fallaron');
    }
    
    return allImportsOk;
}

async function testFullIntegration() {
    console.log('\n=== Prueba de Integración Completa ===');
    
    try {
        // Importar el módulo de conexión a la base de datos
        const { connectToDatabase, disconnectFromDatabase } = await import('./src/db/connection.js');
        console.log('✅ Importación exitosa del módulo de conexión a la base de datos');
        
        // Intentar conectar a la base de datos
        console.log('Conectando a MongoDB...');
        const dbConnection = await connectToDatabase();
        
        if (dbConnection) {
            console.log('✅ Conexión exitosa a MongoDB usando módulos del proyecto');
            
            // Importar inicialización del bot
            const { initializeBot } = await import('./src/api/telegram.api.js');
            console.log('✅ Importación exitosa del módulo de inicialización del bot');
            
            // Importar registro de comandos
            const { registerCommands } = await import('./src/commands/index.js');
            console.log('✅ Importación exitosa del módulo de registro de comandos');
            
            // Crear configuración del bot
            const botConfig = {
                token: process.env.TELEGRAM_BOT_TOKEN,
                options: {
                    polling: false
                }
            };
            
            // Inicializar el bot
            console.log('Inicializando bot...');
            const bot = initializeBot(botConfig);
            
            if (bot) {
                console.log('✅ Inicialización exitosa del bot usando módulos del proyecto');
                
                // Intentar registrar comandos
                try {
                    console.log('Registrando comandos...');
                    registerCommands(bot);
                    console.log('✅ Registro exitoso de comandos');
                } catch (commandError) {
                    console.error(`❌ Error al registrar comandos: ${commandError.message}`);
                }
                
                // Probar funcionalidad del bot
                try {
                    console.log('Probando funcionalidad del bot...');
                    const botInfo = await bot.telegram.getMe();
                    console.log(`✅ El bot está funcional. Nombre de usuario: @${botInfo.username}`);
                } catch (botError) {
                    console.error(`❌ Prueba de funcionalidad del bot fallida: ${botError.message}`);
                }
            } else {
                console.error('❌ Error al inicializar el bot');
            }
            
            // Desconectar de la base de datos
            await disconnectFromDatabase();
            console.log('Conexión a MongoDB cerrada');
        } else {
            console.error('❌ Error al conectar a MongoDB usando módulos del proyecto');
        }
    } catch (error) {
        console.error(`❌ Prueba de integración completa fallida: ${error.message}`);
        console.error(error);
        return false;
    }
    
    return true;
}

async function runTests() {
    console.log('=== Iniciando Suite de Pruebas de Integración ===');
    console.log('Directorio de trabajo actual:', process.cwd());
    
    // Probar variables de entorno
    const envVarsOk = await testEnvironmentVariables();
    
    // Probar conexión a MongoDB
    const mongoDbOk = await testMongoDBConnection();
    
    // Probar bot de Telegram
    const telegramBotOk = await testTelegramBot();
    
    // Probar importaciones del proyecto
    const importsOk = await testProjectImports();
    
    // Probar integración completa solo si todas las pruebas individuales pasan
    let integrationOk = false;
    if (envVarsOk && mongoDbOk && telegramBotOk && importsOk) {
        integrationOk = await testFullIntegration();
    } else {
        console.log('\n⚠️ Omitiendo prueba de integración completa debido a fallos en pruebas individuales');
    }
    
    // Imprimir resumen
    console.log('\n=== Resumen de Resultados de Pruebas ===');
    console.log(`Variables de Entorno: ${envVarsOk ? '✅ APROBADO' : '❌ FALLIDO'}`);
    console.log(`Conexión a MongoDB: ${mongoDbOk ? '✅ APROBADO' : '❌ FALLIDO'}`);
    console.log(`Bot de Telegram: ${telegramBotOk ? '✅ APROBADO' : '❌ FALLIDO'}`);
    console.log(`Importaciones del Proyecto: ${importsOk ? '✅ APROBADO' : '❌ FALLIDO'}`);
    
    if (envVarsOk && mongoDbOk && telegramBotOk && importsOk) {
        console.log(`Integración Completa: ${integrationOk ? '✅ APROBADO' : '❌ FALLIDO'}`);
    }
    
    // Proporcionar recomendaciones basadas en los resultados de las pruebas
    console.log('\n=== Recomendaciones ===');
    
    if (!envVarsOk) {
        console.log('• Crea o actualiza el archivo .env con las variables requeridas:');
        console.log('  TELEGRAM_BOT_TOKEN=tu_token_de_bot');
        console.log('  MONGODB_URI=tu_cadena_de_conexion_mongodb');
        console.log('  MONGODB_DB_NAME=tu_nombre_de_base_de_datos');
    }
    
    if (!mongoDbOk) {
        console.log('• Soluciona problemas de conexión a MongoDB:');
        console.log('  - Verifica que tu cadena de conexión sea correcta');
        console.log('  - Comprueba el nombre de usuario y contraseña');
        console.log('  - Asegúrate de que tu IP esté en la lista blanca en MongoDB Atlas');
        console.log('  - Verifica que el nombre de la base de datos exista');
    }
    
    if (!telegramBotOk) {
        console.log('• Soluciona problemas con el bot de Telegram:');
        console.log('  - Verifica que tu token de bot sea válido');
        console.log('  - Asegúrate de que puedas acceder a la API de Telegram');
        console.log('  - Crea un nuevo bot con BotFather si es necesario');
    }
    
    if (!importsOk) {
        console.log('• Soluciona problemas de importación del proyecto:');
        console.log('  - Asegúrate de que todos los archivos requeridos existan en las rutas correctas');
        console.log('  - Verifica si hay errores de sintaxis en los módulos');
        console.log('  - Comprueba que todas las dependencias estén instaladas');
    }
    
    if (!integrationOk && envVarsOk && mongoDbOk && telegramBotOk && importsOk) {
        console.log('• Soluciona problemas de integración:');
        console.log('  - Verifica si hay dependencias circulares');
        console.log('  - Asegúrate de que los módulos exporten correctamente sus funciones');
        console.log('  - Comprueba que todas las firmas de módulos coincidan con lo esperado');
    }
}

// Ejecutar las pruebas
runTests()
    .then(() => {
        console.log('\nScript de prueba completado.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script de prueba falló con un error inesperado:', error);
        process.exit(1);
    });