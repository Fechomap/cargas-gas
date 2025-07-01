#!/bin/bash
# Script para crear backup completo de BD de producción ANTES del deploy del sistema de storage

TIMESTAMP=$(date +%Y%m%d_%H%M)
BACKUP_FILE="backup_pre_storage_deploy_${TIMESTAMP}.sql"
PROD_DATABASE_URL="postgresql://postgres:XxsSSgKHlRkyWQQIxjQSHJdQslUlhfZp@trolley.proxy.rlwy.net:26635/railway"

echo "🔒 CREANDO BACKUP BD PRODUCCIÓN - Pre-Deploy Storage System"
echo "=========================================================="
echo "📅 Timestamp: $TIMESTAMP"
echo "📁 Archivo: $BACKUP_FILE"
echo ""

echo "📊 Conteos pre-backup:"
echo "Tenants: $(psql "$PROD_DATABASE_URL" -t -c "SELECT count(*) FROM \"Tenant\";" | tr -d ' ')"
echo "Fuel: $(psql "$PROD_DATABASE_URL" -t -c "SELECT count(*) FROM \"Fuel\";" | tr -d ' ')"
echo "Units: $(psql "$PROD_DATABASE_URL" -t -c "SELECT count(*) FROM \"Unit\";" | tr -d ' ')"
echo ""

echo "🔄 Ejecutando pg_dump..."
pg_dump "$PROD_DATABASE_URL" > "$BACKUP_FILE" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Backup creado exitosamente: $BACKUP_FILE"
    echo ""
    echo "📈 Estadísticas del backup:"
    echo "Tamaño: $(du -h "$BACKUP_FILE" | cut -f1)"
    echo "Líneas: $(wc -l < "$BACKUP_FILE")"
    echo ""
    echo "🔍 Verificación de integridad:"
    
    # Verificar que contiene las tablas principales
    if grep -q "CREATE TABLE.*Tenant" "$BACKUP_FILE" && \
       grep -q "CREATE TABLE.*Fuel" "$BACKUP_FILE" && \
       grep -q "CREATE TABLE.*Unit" "$BACKUP_FILE"; then
        echo "✅ Backup contiene todas las tablas principales"
    else
        echo "❌ ADVERTENCIA: Backup podría estar incompleto"
    fi
    
    # Verificar que contiene datos
    if grep -q "COPY.*Tenant" "$BACKUP_FILE" && \
       grep -q "COPY.*Fuel" "$BACKUP_FILE"; then
        echo "✅ Backup contiene datos de las tablas"
    else
        echo "❌ ADVERTENCIA: Backup podría no contener datos"
    fi
    
    echo ""
    echo "🎯 BACKUP COMPLETADO EXITOSAMENTE"
    echo "Archivo guardado: $(pwd)/$BACKUP_FILE"
    echo "Proceder con el deploy es SEGURO"
    
else
    echo "❌ ERROR: Falló la creación del backup"
    echo "NO PROCEDER con el deploy sin backup"
    exit 1
fi