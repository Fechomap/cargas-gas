// scripts/check-unpaid-fuels.js
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function checkUnpaidFuels() {
  try {
    console.log('Verificando cargas no pagadas en PostgreSQL...');
    
    // Obtener todos los tenants
    const tenants = await prisma.tenant.findMany();
    console.log(`Tenants encontrados: ${tenants.length}`);
    
    for (const tenant of tenants) {
      console.log(`\n=== Tenant: ${tenant.name} (ID: ${tenant.id}) ===`);
      
      // Contar cargas totales por tenant
      const totalFuels = await prisma.fuel.count({
        where: { tenantId: tenant.id }
      });
      console.log(`Total de cargas: ${totalFuels}`);
      
      // Contar cargas no pagadas
      const unpaidFuels = await prisma.fuel.count({
        where: { 
          tenantId: tenant.id,
          paymentStatus: 'NO_PAGADA'
        }
      });
      console.log(`Cargas no pagadas: ${unpaidFuels}`);
      
      // Calcular monto total no pagado
      const unpaidAmount = await prisma.fuel.aggregate({
        where: { 
          tenantId: tenant.id,
          paymentStatus: 'NO_PAGADA'
        },
        _sum: {
          amount: true
        }
      });
      console.log(`Monto no pagado: ${unpaidAmount._sum.amount || 0}`);
      
      // Mostrar las primeras 5 cargas no pagadas
      const unpaidFuelsList = await prisma.fuel.findMany({
        where: { 
          tenantId: tenant.id,
          paymentStatus: 'NO_PAGADA'
        },
        take: 5,
        orderBy: { recordDate: 'desc' }
      });
      
      console.log('Ejemplos de cargas no pagadas:');
      unpaidFuelsList.forEach(fuel => {
        console.log(`- ID: ${fuel.id}, Operador: ${fuel.operatorName}, Monto: ${fuel.amount}, Fecha: ${fuel.recordDate}`);
      });
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error al verificar cargas:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkUnpaidFuels();
