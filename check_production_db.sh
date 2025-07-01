#!/bin/bash
# Script para verificar estado de BD de producción ANTES del deploy

echo "🔍 VERIFICANDO ESTADO BD PRODUCCIÓN - Railway"
echo "=============================================="

# URL de BD de producción (comentada en .env)
PROD_DATABASE_URL="postgresql://postgres:XxsSSgKHlRkyWQQIxjQSHJdQslUlhfZp@trolley.proxy.rlwy.net:26635/railway"

echo "📊 1. Verificando tablas existentes..."
psql "$PROD_DATABASE_URL" -c "\dt" 2>/dev/null || echo "❌ Error conectando a BD producción"

echo ""
echo "📊 2. Verificando conteos críticos..."
echo "Tenants:"
psql "$PROD_DATABASE_URL" -c "SELECT count(*) FROM \"Tenant\";" 2>/dev/null || echo "❌ Tabla Tenant no encontrada"

echo "Fuel records:"
psql "$PROD_DATABASE_URL" -c "SELECT count(*) FROM \"Fuel\";" 2>/dev/null || echo "❌ Tabla Fuel no encontrada"

echo "Units:"
psql "$PROD_DATABASE_URL" -c "SELECT count(*) FROM \"Unit\";" 2>/dev/null || echo "❌ Tabla Unit no encontrada"

echo ""
echo "📊 3. Verificando si FileStorage ya existe..."
psql "$PROD_DATABASE_URL" -c "\d \"FileStorage\"" 2>/dev/null && echo "⚠️  FileStorage YA EXISTE" || echo "✅ FileStorage NO EXISTE (correcto)"

echo ""
echo "📊 4. Verificando últimas migraciones aplicadas..."
psql "$PROD_DATABASE_URL" -c "SELECT * FROM \"_prisma_migrations\" ORDER BY finished_at DESC LIMIT 5;" 2>/dev/null || echo "❌ No se puede acceder a tabla de migraciones"

echo ""
echo "✅ Verificación completada. Revisa los resultados antes de continuar."