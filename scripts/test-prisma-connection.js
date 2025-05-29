// scripts/test-prisma-connection.js
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔍 Probando conexión a PostgreSQL...');
    
    // Intenta realizar una operación simple
    await prisma.$connect();
    console.log('✅ Conexión a PostgreSQL establecida correctamente');
    
    // Verificar si tenemos un tenant creado (prueba de lectura)
    const tenantCount = await prisma.tenant.count();
    console.log(`📊 Número de tenants en la base de datos: ${tenantCount}`);
    
    console.log('🎉 Prueba completada con éxito');
  } catch (error) {
    console.error('❌ Error al conectar a PostgreSQL:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar prueba
testConnection()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error inesperado:', error);
    process.exit(1);
  });
