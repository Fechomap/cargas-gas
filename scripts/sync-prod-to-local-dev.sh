#!/bin/bash

# Script mejorado para sincronizar producción → desarrollo
# Incluye configuración automática para entorno de desarrollo
# Evita problemas de chatIds y configuraciones de entorno

# Configuración
LOCAL_DB_NAME="gas_bot"
LOCAL_DB_USER="gas_bot_user"
LOCAL_DB_PASSWORD="gas_bot_password"
LOCAL_DB_HOST="localhost"
LOCAL_DB_PORT="5432"

BACKUP_DIR="/Users/jhonvc/NODE HEROKU/cargas-GAS/backups/production"
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.sql | head -n 1)

# Configuraciones específicas para desarrollo
DEV_CHAT_ID="-4527368480"  # Tu chat de desarrollo
DEV_BOT_TOKEN="7281931989:AAHef5kyzCAmR2e7q1rxpK1e10ZbJVibvow"

# Colores
RED='\033[1;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔄 SINCRONIZACIÓN INTELIGENTE PROD → DEV${NC}"
echo "============================================"
echo ""

# Verificar backup
if [ ! -f "$LATEST_BACKUP" ]; then
    echo -e "${RED}❌ ERROR: No se encontró backup de producción${NC}"
    echo "Ejecuta primero: ./backup_production.sh"
    exit 1
fi

echo -e "${BLUE}📋 Configuración de sincronización:${NC}"
echo "  • Backup: $(basename "$LATEST_BACKUP")"
echo "  • Chat ID desarrollo: $DEV_CHAT_ID"
echo "  • Bot token desarrollo: ${DEV_BOT_TOKEN:0:20}..."
echo ""

# Confirmación
echo -e "${YELLOW}⚠️ Este proceso:${NC}"
echo "  1. Importará datos de producción"
echo "  2. Configurará chatIds para desarrollo"
echo "  3. Mantendrá configuración de desarrollo"
echo ""
read -p "¿Continuar? (escribe 'SI'): " confirmacion

if [ "$confirmacion" != "SI" ]; then
    echo -e "${RED}❌ Operación cancelada${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🚀 Iniciando sincronización inteligente...${NC}"

# Paso 1: Recrear base de datos
echo -e "${BLUE}1️⃣ Recreando base de datos local...${NC}"

# Terminar conexiones
PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" -d postgres -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = '$LOCAL_DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null

# Eliminar y crear
PGPASSWORD="$LOCAL_DB_PASSWORD" dropdb -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" "$LOCAL_DB_NAME" 2>/dev/null
PGPASSWORD="$LOCAL_DB_PASSWORD" createdb -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" "$LOCAL_DB_NAME"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Base de datos recreada${NC}"
else
    echo -e "${RED}❌ ERROR: No se pudo recrear la base${NC}"
    exit 1
fi

# Paso 2: Importar datos
echo -e "${BLUE}2️⃣ Importando datos de producción...${NC}"
PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" < "$LATEST_BACKUP" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Datos importados exitosamente${NC}"
else
    echo -e "${RED}❌ ERROR: Falló la importación${NC}"
    exit 1
fi

# Paso 3: Configurar entorno de desarrollo
echo -e "${BLUE}3️⃣ Configurando para entorno de desarrollo...${NC}"

# Actualizar chatId del tenant principal para desarrollo
PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c "
UPDATE \"Tenant\" 
SET \"chatId\" = '$DEV_CHAT_ID', 
    \"companyName\" = 'Empresa Desarrollo',
    \"notes\" = 'Configurado automáticamente para desarrollo'
WHERE \"companyName\" = 'Empresa Migrada' OR id = '429127b2-18af-4e82-88c1-90c11e8be0b7';
" > /dev/null 2>&1

echo -e "${GREEN}✅ ChatId configurado para desarrollo${NC}"

# Paso 4: Verificar configuración
echo -e "${BLUE}4️⃣ Verificando configuración...${NC}"

# Contar registros
TENANT_COUNT=$(PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -t -c "SELECT COUNT(*) FROM \"Tenant\" WHERE \"chatId\" = '$DEV_CHAT_ID';" | tr -d ' ')

if [ "$TENANT_COUNT" -eq 1 ]; then
    echo -e "${GREEN}✅ Tenant configurado correctamente para desarrollo${NC}"
else
    echo -e "${YELLOW}⚠️ Advertencia: Configuración de tenant inesperada${NC}"
fi

# Mostrar resumen
echo ""
echo "Resumen de datos importados:"
PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -t -c "
SELECT 
    'Tenants: ' || COUNT(*) 
FROM \"Tenant\"
UNION ALL
SELECT 
    'Units: ' || COUNT(*) 
FROM \"Unit\"
UNION ALL
SELECT 
    'Fuel Records: ' || COUNT(*) 
FROM \"Fuel\";" 2>/dev/null | sed 's/^[ \t]*/  • /'

# Paso 5: Actualizar Prisma
echo -e "${BLUE}5️⃣ Actualizando Prisma...${NC}"
npx prisma db pull --force > /dev/null 2>&1
npx prisma generate > /dev/null 2>&1
echo -e "${GREEN}✅ Prisma actualizado${NC}"

# Paso 6: Verificar configuración del .env
echo -e "${BLUE}6️⃣ Verificando configuración .env...${NC}"

if grep -q "TELEGRAM_BOT_TOKEN=$DEV_BOT_TOKEN" .env; then
    echo -e "${GREEN}✅ Bot token de desarrollo configurado${NC}"
else
    echo -e "${YELLOW}⚠️ Verifica que el bot token en .env sea de desarrollo${NC}"
fi

if grep -q "NODE_ENV=development" .env; then
    echo -e "${GREEN}✅ Entorno configurado como development${NC}"
else
    echo -e "${YELLOW}⚠️ Verifica que NODE_ENV=development en .env${NC}"
fi

# Resultado final
echo ""
echo -e "${GREEN}🎉 SINCRONIZACIÓN INTELIGENTE COMPLETADA${NC}"
echo "============================================="
echo -e "${GREEN}✅ Datos de producción importados${NC}"
echo -e "${GREEN}✅ ChatId configurado para desarrollo${NC}"
echo -e "${GREEN}✅ Entorno listo para desarrollo${NC}"
echo ""

echo -e "${BLUE}📊 Configuración final:${NC}"
echo "  • Chat ID: $DEV_CHAT_ID"
echo "  • Empresa: Empresa Desarrollo"
echo "  • Fecha: $(date)"
echo ""

echo -e "${YELLOW}🚀 SIGUIENTE PASO:${NC}"
echo "  Puedes iniciar el bot con: ${BLUE}npm run dev${NC}"
echo ""

echo -e "${YELLOW}💡 NOTA IMPORTANTE:${NC}"
echo "  • Este script JAMÁS toca producción"
echo "  • Solo modifica la base de datos local"
echo "  • Producción sigue funcionando normalmente"
echo ""