#!/usr/bin/env node

/**
 * Script para verificar alineación entre base de datos local y producción
 * Compara estructura, datos y consistencia
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';

// Configuraciones de base de datos
const LOCAL_DB = 'postgresql://gas_bot_user:gas_bot_password@localhost:5432/gas_bot';
const PROD_DB = 'postgresql://postgres:XxsSSgKHlRkyWQQIxjQSHJdQslUlhfZp@trolley.proxy.rlwy.net:26635/railway';

const localPrisma = new PrismaClient({
  datasources: { db: { url: LOCAL_DB } }
});

const prodPrisma = new PrismaClient({
  datasources: { db: { url: PROD_DB } }
});

console.log('🔍 VERIFICACIÓN DE ALINEACIÓN DE BASES DE DATOS');
console.log('================================================');

async function compareTableCounts() {
  console.log('\n📊 1. COMPARACIÓN DE CONTEOS POR TABLA');
  console.log('--------------------------------------');
  
  const tables = ['tenant', 'unit', 'fuel', 'tenantSettings', 'registrationRequest'];
  const tableNames = ['Tenant', 'Unit', 'Fuel', 'TenantSettings', 'RegistrationRequest'];
  const results = {};
  
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    const tableName = tableNames[i];
    try {
      const localCount = await localPrisma[table].count();
      const prodCount = await prodPrisma[table].count();
      
      results[tableName] = { local: localCount, prod: prodCount, aligned: localCount === prodCount };
      
      const status = localCount === prodCount ? '✅' : '⚠️';
      console.log(`${status} ${tableName.padEnd(20)} Local: ${localCount.toString().padStart(5)} | Prod: ${prodCount.toString().padStart(5)}`);
      
    } catch (error) {
      console.log(`❌ ${tableName.padEnd(20)} Error: ${error.message}`);
      results[tableName] = { error: error.message };
    }
  }
  
  return results;
}

async function compareSchemaStructure() {
  console.log('\n🏗️  2. VERIFICACIÓN DE ESTRUCTURA DE ESQUEMA');
  console.log('---------------------------------------------');
  
  try {
    // Obtener información de columnas de tabla Fuel (la más importante)
    const localColumns = await localPrisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Fuel' 
      ORDER BY ordinal_position;
    `;
    
    const prodColumns = await prodPrisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Fuel' 
      ORDER BY ordinal_position;
    `;
    
    console.log('Columnas en tabla Fuel:');
  
    const localColumnNames = localColumns.map(c => c.column_name);
    const prodColumnNames = prodColumns.map(c => c.column_name);
    
    // Verificar columnas que existen en ambas
    const commonColumns = localColumnNames.filter(col => prodColumnNames.includes(col));
    const localOnlyColumns = localColumnNames.filter(col => !prodColumnNames.includes(col));
    const prodOnlyColumns = prodColumnNames.filter(col => !localColumnNames.includes(col));
    
    console.log(`✅ Columnas comunes: ${commonColumns.length}`);
    commonColumns.forEach(col => console.log(`   - ${col}`));
    
    if (localOnlyColumns.length > 0) {
      console.log(`⚠️  Solo en Local: ${localOnlyColumns.length}`);
      localOnlyColumns.forEach(col => console.log(`   - ${col}`));
    }
    
    if (prodOnlyColumns.length > 0) {
      console.log(`⚠️  Solo en Producción: ${prodOnlyColumns.length}`);
      prodOnlyColumns.forEach(col => console.log(`   - ${col}`));
    }
    
    return {
      common: commonColumns,
      localOnly: localOnlyColumns,
      prodOnly: prodOnlyColumns,
      aligned: localOnlyColumns.length === 0 && prodOnlyColumns.length === 0
    };
    
  } catch (error) {
    console.log(`❌ Error verificando estructura: ${error.message}`);
    return { error: error.message };
  }
}

async function compareSampleData() {
  console.log('\n🔍 3. VERIFICACIÓN DE DATOS DE MUESTRA');
  console.log('--------------------------------------');
  
  try {
    // Comparar algunos registros recientes de cada tabla
    const localFuel = await localPrisma.fuel.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, tenantId: true, unitId: true, liters: true, amount: true }
    });
    
    const prodFuel = await prodPrisma.fuel.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, tenantId: true, unitId: true, liters: true, amount: true }
    });
    
    console.log('Últimos 5 registros de Fuel:');
    console.log('Local:', localFuel.length > 0 ? `${localFuel.length} registros, último: ${localFuel[0].createdAt}` : 'Sin registros');
    console.log('Prod:', prodFuel.length > 0 ? `${prodFuel.length} registros, último: ${prodFuel[0].createdAt}` : 'Sin registros');
    
    // Verificar si hay registros comunes por ID
    const localIds = localFuel.map(f => f.id);
    const prodIds = prodFuel.map(f => f.id);
    const commonIds = localIds.filter(id => prodIds.includes(id));
    
    console.log(`Registros con IDs comunes: ${commonIds.length}`);
    
    return {
      localCount: localFuel.length,
      prodCount: prodFuel.length,
      commonIds: commonIds.length,
      recentDataExists: localFuel.length > 0 && prodFuel.length > 0
    };
    
  } catch (error) {
    console.log(`❌ Error comparando datos: ${error.message}`);
    return { error: error.message };
  }
}

async function checkMigrationStatus() {
  console.log('\n🚀 4. ESTADO DE MIGRACIONES');
  console.log('---------------------------');
  
  try {
    const localMigrations = await localPrisma.$queryRaw`
      SELECT migration_name, finished_at 
      FROM "_prisma_migrations" 
      ORDER BY finished_at DESC 
      LIMIT 5;
    `;
    
    const prodMigrations = await prodPrisma.$queryRaw`
      SELECT migration_name, finished_at 
      FROM "_prisma_migrations" 
      ORDER BY finished_at DESC 
      LIMIT 5;
    `;
    
    console.log('Últimas 5 migraciones aplicadas:');
    console.log('\nLocal:');
    localMigrations.forEach((mig, idx) => {
      console.log(`  ${idx + 1}. ${mig.migration_name} (${mig.finished_at})`);
    });
    
    console.log('\nProducción:');
    prodMigrations.forEach((mig, idx) => {
      console.log(`  ${idx + 1}. ${mig.migration_name} (${mig.finished_at})`);
    });
    
    // Verificar si las últimas migraciones coinciden
    const localLatest = localMigrations[0]?.migration_name;
    const prodLatest = prodMigrations[0]?.migration_name;
    const migrationsAligned = localLatest === prodLatest;
    
    console.log(`\n${migrationsAligned ? '✅' : '⚠️'} Estado de migraciones: ${migrationsAligned ? 'Alineadas' : 'Desalineadas'}`);
    
    return {
      localLatest,
      prodLatest,
      aligned: migrationsAligned,
      localCount: localMigrations.length,
      prodCount: prodMigrations.length
    };
    
  } catch (error) {
    console.log(`❌ Error verificando migraciones: ${error.message}`);
    return { error: error.message };
  }
}

async function generateSummaryReport(results) {
  console.log('\n📋 RESUMEN DE ALINEACIÓN');
  console.log('========================');
  
  const issues = [];
  let overallStatus = '✅ ALINEADAS';
  
  // Verificar conteos
  Object.entries(results.counts).forEach(([table, data]) => {
    if (data.error) {
      issues.push(`❌ Error en tabla ${table}: ${data.error}`);
    } else if (!data.aligned) {
      issues.push(`⚠️ Desalineación en ${table}: Local=${data.local}, Prod=${data.prod}`);
    }
  });
  
  // Verificar estructura
  if (results.schema.error) {
    issues.push(`❌ Error en estructura: ${results.schema.error}`);
  } else if (!results.schema.aligned) {
    issues.push(`⚠️ Estructura desalineada: Local=${results.schema.localOnly.length} extras, Prod=${results.schema.prodOnly.length} extras`);
  }
  
  // Verificar migraciones
  if (results.migrations.error) {
    issues.push(`❌ Error en migraciones: ${results.migrations.error}`);
  } else if (!results.migrations.aligned) {
    issues.push(`⚠️ Migraciones desalineadas: Local='${results.migrations.localLatest}', Prod='${results.migrations.prodLatest}'`);
  }
  
  if (issues.length > 0) {
    overallStatus = '⚠️ PROBLEMAS DETECTADOS';
    console.log(overallStatus);
    console.log('\nProblemas encontrados:');
    issues.forEach(issue => console.log(`  ${issue}`));
    
    console.log('\n🔧 RECOMENDACIONES:');
    console.log('  1. Ejecutar sincronización de datos si es necesario');
    console.log('  2. Aplicar migraciones faltantes');
    console.log('  3. NO CONTINUAR hasta resolver los problemas');
  } else {
    console.log(overallStatus);
    console.log('\n✅ Las bases de datos están correctamente alineadas');
    console.log('✅ Es seguro proceder con el desarrollo');
  }
  
  return {
    status: overallStatus,
    issues,
    canProceed: issues.length === 0
  };
}

async function main() {
  try {
    console.log('Conectando a ambas bases de datos...');
    
    // Verificar conexiones
    await localPrisma.$connect();
    await prodPrisma.$connect();
    console.log('✅ Conexiones establecidas\n');
    
    // Ejecutar todas las verificaciones
    const results = {
      counts: await compareTableCounts(),
      schema: await compareSchemaStructure(),
      data: await compareSampleData(),
      migrations: await checkMigrationStatus()
    };
    
    // Generar reporte final
    const summary = await generateSummaryReport(results);
    
    // Guardar resultados en archivo
    const reportData = {
      timestamp: new Date().toISOString(),
      summary,
      details: results
    };
    
    fs.writeFileSync(
      './db-alignment-report.json', 
      JSON.stringify(reportData, null, 2)
    );
    
    console.log('\n💾 Reporte detallado guardado en: db-alignment-report.json');
    
    // Exit code basado en el resultado
    process.exit(summary.canProceed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  } finally {
    await localPrisma.$disconnect();
    await prodPrisma.$disconnect();
  }
}

// Ejecutar verificación
main().catch(console.error);