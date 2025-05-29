// src/db/prisma.js
import { PrismaClient } from '@prisma/client';

// Crear una instancia de PrismaClient
const prisma = new PrismaClient();

// Manejar conexión
prisma.$connect()
  .then(() => {
    console.log('🚀 Conexión a PostgreSQL establecida correctamente');
  })
  .catch((error) => {
    console.error('❌ Error al conectar a PostgreSQL:', error);
    process.exit(1);
  });

// Manejar desconexión al cerrar la aplicación
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('Conexión a PostgreSQL cerrada correctamente');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  console.log('Conexión a PostgreSQL cerrada correctamente');
  process.exit(0);
});

export default prisma;
