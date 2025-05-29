// scripts/update-tenant-status.js
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateTenants() {
  try {
    console.log('Iniciando actualización de tenants existentes...');
    
    // Buscar todos los tenants que no tienen registrationStatus o lo tienen a null
    const tenantsWithoutStatus = await prisma.tenant.findMany({
      where: {
        OR: [
          { registrationStatus: null },
          { registrationStatus: '' }
        ]
      }
    });
    
    console.log(`Se encontraron ${tenantsWithoutStatus.length} tenants sin estado de registro.`);
    
    // Actualizar todos los tenants sin estado a "APPROVED"
    if (tenantsWithoutStatus.length > 0) {
      // Actualizar cada tenant individualmente
      for (const tenant of tenantsWithoutStatus) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            registrationStatus: 'APPROVED',
            isActive: true,
            isApproved: true
          }
        });
      }
      
      console.log(`Se actualizaron ${tenantsWithoutStatus.length} tenants a estado APPROVED.`);
      
      // Mostrar detalles de los tenants actualizados
      console.log('\nDetalles de tenants actualizados:');
      for (const tenant of tenantsWithoutStatus) {
        console.log(`- ID: ${tenant.id}, Nombre: ${tenant.companyName}, ChatID: ${tenant.chatId}`);
      }
    }
    
    // Verificar tenant específico
    const specificTenant = await prisma.tenant.findUnique({
      where: {
        id: '429127b2-18af-4e82-88c1-90c11e8be0b7'
      }
    });
    
    if (specificTenant) {
      console.log('\nDetalle del tenant específico:');
      console.log(`- ID: ${specificTenant.id}`);
      console.log(`- Nombre: ${specificTenant.companyName}`);
      console.log(`- ChatID: ${specificTenant.chatId}`);
      console.log(`- Estado de registro: ${specificTenant.registrationStatus || 'undefined'}`);
      console.log(`- Activo: ${specificTenant.isActive}`);
      
      // Actualizar solo si es necesario
      if (!specificTenant.registrationStatus) {
        await prisma.tenant.update({
          where: {
            id: specificTenant.id
          },
          data: {
            registrationStatus: 'APPROVED',
            isActive: true
          }
        });
        
        console.log(`\nTenant específico actualizado a APPROVED.`);
      } else {
        console.log(`\nTenant específico ya tiene estado: ${specificTenant.registrationStatus}`);
      }
    } else {
      console.log('\nNo se encontró el tenant específico con ID: 429127b2-18af-4e82-88c1-90c11e8be0b7');
    }
    
    console.log('\nProceso de actualización completado.');
  } catch (error) {
    console.error('Error al actualizar tenants:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la función
updateTenants();
