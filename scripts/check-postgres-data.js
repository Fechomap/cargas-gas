// scripts/check-postgres-data.js
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const prisma = new PrismaClient();

async function checkData() {
  try {
    console.log('🔍 Verificando datos en PostgreSQL...');
    
    // Obtener todos los tenants
    const tenants = await prisma.tenant.findMany();
    console.log(`\n📊 Tenants encontrados: ${tenants.length}`);
    
    for (const tenant of tenants) {
      console.log(`\n🏢 Tenant: ${tenant.companyName} (ID: ${tenant.id}, ChatID: ${tenant.chatId})`);
      
      // Obtener configuración del tenant
      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId: tenant.id }
      });
      
      console.log(`   Configuración: ${settings ? '✅' : '❌'}`);
      
      // Obtener unidades del tenant
      const units = await prisma.unit.findMany({
        where: { tenantId: tenant.id }
      });
      
      console.log(`   Unidades: ${units.length}`);
      
      // Obtener últimas 5 unidades
      if (units.length > 0) {
        console.log('   Últimas unidades:');
        const latestUnits = units.slice(0, 5);
        latestUnits.forEach(unit => {
          console.log(`      - ${unit.operatorName} (${unit.unitNumber})`);
        });
      }
      
      // Obtener cargas de combustible del tenant
      const fuels = await prisma.fuel.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: 'desc' },
        take: 5
      });
      
      const totalFuels = await prisma.fuel.count({
        where: { tenantId: tenant.id }
      });
      
      console.log(`   Total cargas: ${totalFuels}`);
      
      // Mostrar últimas 5 cargas
      if (fuels.length > 0) {
        console.log('   Últimas cargas:');
        fuels.forEach(fuel => {
          console.log(`      - ${fuel.operatorName}, ${fuel.liters} litros, $${fuel.amount}, ${fuel.fuelType}`);
        });
      }
    }
    
    console.log('\n✅ Verificación completada');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar verificación
checkData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error en el proceso principal:', error);
    process.exit(1);
  });
