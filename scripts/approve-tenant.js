// scripts/approve-tenant.js
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_ID = '429127b2-18af-4e82-88c1-90c11e8be0b7'; // ID del tenant según los logs

async function approveTenant() {
  try {
    console.log(`Buscando tenant con ID: ${TENANT_ID}...`);
    
    // Buscar el tenant
    const tenant = await prisma.tenant.findUnique({
      where: {
        id: TENANT_ID
      }
    });
    
    if (!tenant) {
      console.log(`No se encontró el tenant con ID: ${TENANT_ID}`);
      return;
    }
    
    console.log('Tenant encontrado:');
    console.log(`- ID: ${tenant.id}`);
    console.log(`- Nombre: ${tenant.companyName}`);
    console.log(`- Chat ID: ${tenant.chatId}`);
    console.log(`- Activo: ${tenant.isActive}`);
    console.log(`- Aprobado: ${tenant.isApproved}`);
    
    // Actualizar el tenant
    console.log('\nActualizando tenant...');
    const updatedTenant = await prisma.tenant.update({
      where: {
        id: TENANT_ID
      },
      data: {
        isApproved: true,
        isActive: true
      }
    });
    
    console.log('\nTenant actualizado correctamente:');
    console.log(`- ID: ${updatedTenant.id}`);
    console.log(`- Nombre: ${updatedTenant.companyName}`);
    console.log(`- Activo: ${updatedTenant.isActive}`);
    console.log(`- Aprobado: ${updatedTenant.isApproved}`);
    
  } catch (error) {
    console.error('Error al actualizar tenant:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la función
approveTenant();
