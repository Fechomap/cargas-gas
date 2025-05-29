// scripts/fix-tenant.js
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// ID del tenant vacío que queremos eliminar
const TENANT_TO_DELETE = '30394e54-eaef-44f0-97ce-ed2c1571b5de';

// ID del tenant con datos que queremos conservar
const TENANT_TO_KEEP = '429127b2-18af-4e82-88c1-90c11e8be0b7';

// Chat ID de Telegram para el grupo actual
const CHAT_ID = '-4527368480';

async function fixTenant() {
  try {
    console.log('Iniciando corrección de tenants...');
    
    // 1. Eliminar el tenant vacío primero
    console.log(`Eliminando tenant vacío ${TENANT_TO_DELETE}...`);
    
    // Verificar si hay configuraciones asociadas para eliminarlas primero
    const tenantSettings = await prisma.tenantSettings.findFirst({
      where: { tenantId: TENANT_TO_DELETE }
    });
    
    if (tenantSettings) {
      await prisma.tenantSettings.delete({
        where: { id: tenantSettings.id }
      });
      console.log('✅ Configuraciones del tenant eliminadas.');
    }
    
    // Ahora eliminar el tenant
    await prisma.tenant.delete({
      where: { id: TENANT_TO_DELETE }
    });
    
    console.log('✅ Tenant vacío eliminado correctamente.');
    
    // 2. Ahora asociar el chat ID al tenant correcto
    console.log(`Asociando chat ID ${CHAT_ID} al tenant ${TENANT_TO_KEEP}...`);
    
    await prisma.tenant.update({
      where: { id: TENANT_TO_KEEP },
      data: { chatId: CHAT_ID }
    });
    
    console.log('✅ Chat ID asociado correctamente.');
    
    // 3. Verificar el resultado
    const remainingTenants = await prisma.tenant.findMany();
    
    console.log(`\nTenants restantes: ${remainingTenants.length}`);
    for (const tenant of remainingTenants) {
      console.log(`- ID: ${tenant.id}, Chat ID: ${tenant.chatId}, Nombre: ${tenant.name || 'Sin nombre'}`);
    }
    
    console.log('\n✅ Operación completada con éxito.');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

fixTenant();
