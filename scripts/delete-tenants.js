// scripts/delete-tenants.js
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger.js';

const prisma = new PrismaClient();

// ID del tenant que queremos conservar
const TENANT_TO_KEEP = '429127b2-18af-4e82-88c1-90c11e8be0b7';

async function deleteTenants() {
  try {
    logger.info('Iniciando eliminación de tenants...');
    
    // 1. Obtener todos los tenants excepto el que queremos conservar
    const tenants = await prisma.tenant.findMany({
      where: {
        id: {
          not: TENANT_TO_KEEP
        }
      },
      select: {
        id: true,
        companyName: true
      }
    });
    
    logger.info(`Se encontraron ${tenants.length} tenants para eliminar`);
    
    // Mostrar lista de tenants que se eliminarán
    tenants.forEach(tenant => {
      logger.info(`- ${tenant.id} (${tenant.companyName})`);
    });
    
    // Confirmar eliminación
    console.log(`\n¿Deseas eliminar ${tenants.length} tenants? (solo se conservará el tenant ${TENANT_TO_KEEP})`);
    console.log('Presiona Ctrl+C para cancelar o espera 5 segundos para continuar...');
    
    // Esperar 5 segundos antes de continuar
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 2. Eliminar registros relacionados primero (debido a restricciones de clave foránea)
    // Nota: Deberás ajustar esto según tu esquema de base de datos específico
    
    // 2.1 Eliminar configuraciones de tenant
    logger.info('Eliminando configuraciones de tenant...');
    await prisma.tenantSettings.deleteMany({
      where: {
        tenantId: {
          not: TENANT_TO_KEEP
        }
      }
    });
    
    // 2.2 Buscar todas las unidades asociadas a los tenants que vamos a eliminar
    const unitIds = await prisma.unit.findMany({
      where: {
        tenantId: {
          not: TENANT_TO_KEEP
        }
      },
      select: { 
        id: true 
      }
    });
    
    const unitIdsToDelete = unitIds.map(unit => unit.id);
    
    // 2.3 Eliminar cargas de combustible asociadas a esas unidades
    if (unitIdsToDelete.length > 0) {
      logger.info(`Eliminando cargas de combustible para ${unitIdsToDelete.length} unidades...`);
      await prisma.fuel.deleteMany({
        where: {
          unitId: {
            in: unitIdsToDelete
          }
        }
      });
    }
    
    // 2.4 Eliminar unidades
    logger.info('Eliminando unidades...');
    await prisma.unit.deleteMany({
      where: {
        tenantId: {
          not: TENANT_TO_KEEP
        }
      }
    });
    
    // 2.5 Eliminar solicitudes de registro pendientes
    // Nota: RegistrationRequest probablemente no tiene una relación directa con tenant
    // por lo que eliminamos todas las solicitudes pendientes excepto las que ya generaron
    // el tenant que queremos conservar
    logger.info('Eliminando solicitudes de registro no procesadas...');
    await prisma.registrationRequest.deleteMany({
      where: {
        status: 'PENDING'
      }
    });
    
    // También podríamos eliminar todas las solicitudes con status APPROVED o REJECTED
    // que no correspondan al tenant que queremos conservar, pero esto requeriría
    // conocer el ID de la solicitud que generó ese tenant específico
    
    // 3. Finalmente, eliminar los tenants
    logger.info('Eliminando tenants...');
    const result = await prisma.tenant.deleteMany({
      where: {
        id: {
          not: TENANT_TO_KEEP
        }
      }
    });
    
    logger.info(`¡Proceso completado! Se eliminaron ${result.count} tenants.`);
    logger.info(`Solo se conservó el tenant: ${TENANT_TO_KEEP}`);
    
  } catch (error) {
    logger.error(`Error al eliminar tenants: ${error.message}`);
    logger.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la función principal
deleteTenants()
  .then(() => {
    console.log('Script finalizado.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error en script:', error);
    process.exit(1);
  });
