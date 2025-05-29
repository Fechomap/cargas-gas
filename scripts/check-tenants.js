// scripts/check-tenants.js
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function checkTenants() {
  try {
    console.log('Verificando tenants en PostgreSQL...');
    
    // Obtener todos los tenants con sus configuraciones
    const tenants = await prisma.tenant.findMany({
      include: {
        settings: true
      }
    });
    
    console.log(`Tenants encontrados: ${tenants.length}`);
    
    for (const tenant of tenants) {
      console.log(`\n=== Tenant ID: ${tenant.id} ===`);
      console.log(`Nombre: ${tenant.name || 'No definido'}`);
      console.log(`Chat IDs: ${tenant.chatIds || 'No definido'}`);
      console.log(`Creado: ${tenant.createdAt}`);
      
      // Contar cargas asociadas
      const fuelCount = await prisma.fuel.count({
        where: { tenantId: tenant.id }
      });
      
      console.log(`Total de cargas asociadas: ${fuelCount}`);
      
      // Contar unidades asociadas
      const unitCount = await prisma.unit.count({
        where: { tenantId: tenant.id }
      });
      
      console.log(`Total de unidades asociadas: ${unitCount}`);
      
      // Mostrar configuraciones
      console.log('Configuraciones:');
      if (tenant.settings) {
        console.log(JSON.stringify(tenant.settings, null, 2));
      } else {
        console.log('No hay configuraciones');
      }
    }
    
    // También verificar los chatIds de los tenants en MongoDB si es posible
    console.log('\nPara verificar los chatIds en MongoDB, ejecuta:');
    console.log('db.tenants.find({}, {chatId: 1, name: 1}).pretty()');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error al verificar tenants:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkTenants();
