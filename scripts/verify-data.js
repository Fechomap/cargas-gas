// scripts/verify-data.js
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyData() {
  try {
    // 1. Verificar el tenant
    console.log('\n=== VERIFICACIÓN DE DATOS MIGRADOS ===');
    
    const tenant = await prisma.tenant.findFirst();
    console.log('\n📋 TENANT:');
    console.log(`- ID: ${tenant.id}`);
    console.log(`- Nombre: ${tenant.companyName}`);
    console.log(`- Chat ID: ${tenant.chatId}`);
    console.log(`- Activo: ${tenant.isActive ? 'Sí' : 'No'}`);
    
    // 2. Verificar las unidades
    const units = await prisma.unit.findMany({
      take: 5,
      orderBy: { operatorName: 'asc' }
    });
    
    console.log('\n🚗 UNIDADES (primeras 5):');
    units.forEach((unit, index) => {
      console.log(`\n[Unidad ${index+1}]`);
      console.log(`- Operador: ${unit.operatorName}`);
      console.log(`- Número: ${unit.unitNumber}`);
      console.log(`- Button ID: ${unit.buttonId}`);
    });
    
    // 3. Verificar registros de combustible
    const fuels = await prisma.fuel.findMany({
      take: 5,
      orderBy: { recordDate: 'desc' }
    });
    
    console.log('\n⛽ REGISTROS DE COMBUSTIBLE (5 más recientes):');
    fuels.forEach((fuel, index) => {
      console.log(`\n[Registro ${index+1}]`);
      console.log(`- Operador: ${fuel.operatorName}`);
      console.log(`- Unidad: ${fuel.unitNumber}`);
      console.log(`- Litros: ${fuel.liters}`);
      console.log(`- Costo: ${fuel.amount}`);
      console.log(`- Fecha: ${fuel.recordDate.toISOString().substring(0, 10)}`);
      console.log(`- Estado de pago: ${fuel.paymentStatus}`);
      console.log(`- Fecha de pago: ${fuel.paymentDate ? fuel.paymentDate.toISOString().substring(0, 10) : 'N/A'}`);
      console.log(`- # Venta: ${fuel.saleNumber || 'N/A'}`);
    });
    
    // 4. Estadísticas generales
    const unitCount = await prisma.unit.count();
    const fuelCount = await prisma.fuel.count();
    const fuelPaid = await prisma.fuel.count({
      where: {
        paymentStatus: 'PAGADA'
      }
    });
    
    console.log('\n📊 ESTADÍSTICAS:');
    console.log(`- Total de unidades: ${unitCount}`);
    console.log(`- Total de registros de combustible: ${fuelCount}`);
    console.log(`- Registros pagados: ${fuelPaid} (${Math.round(fuelPaid/fuelCount*100)}%)`);
    console.log(`- Registros por pagar: ${fuelCount - fuelPaid} (${Math.round((fuelCount-fuelPaid)/fuelCount*100)}%)`);
    
  } catch (error) {
    console.error('Error al verificar datos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyData();
