#!/bin/bash

# Script para hacer backup de la base de datos de PRODUCCIÓN PostgreSQL
# CRÍTICO: Este script accede a producción - usar con precaución
# Creado: Junio 2025

# Configuración de PRODUCCIÓN
PROD_HOST="trolley.proxy.rlwy.net"
PROD_PORT="26635"
PROD_DB="railway"
PROD_USER="postgres"
PROD_PASSWORD="XxsSSgKHlRkyWQQIxjQSHJdQslUlhfZp"

BACKUP_DIR="/Users/jhonvc/NODE HEROKU/cargas-GAS/backups/production"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="production_gas_bot_backup_${DATE}"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.sql"

# Colores para output
RED='\033[1;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔒 BACKUP DE BASE DE DATOS DE PRODUCCIÓN${NC}"
echo "============================================="
echo ""

# Verificar que estamos seguros de hacer esto
echo -e "${YELLOW}⚠️ ADVERTENCIA: Este script accederá a la base de datos de PRODUCCIÓN${NC}"
echo -e "${YELLOW}⚠️ Solo realizará operaciones de LECTURA para crear el backup${NC}"
echo ""
read -p "¿Estás seguro de proceder? (escribe 'SI' para continuar): " confirmacion

if [ "$confirmacion" != "SI" ]; then
    echo -e "${RED}❌ Operación cancelada por el usuario${NC}"
    exit 1
fi

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

echo ""
echo -e "${BLUE}📋 Información del backup:${NC}"
echo "  • Host: $PROD_HOST:$PROD_PORT"
echo "  • Base de datos: $PROD_DB"
echo "  • Usuario: $PROD_USER"
echo "  • Archivo destino: $BACKUP_FILE"
echo ""

# Probar conexión primero
echo -e "${BLUE}🔌 Probando conexión a producción...${NC}"
PGPASSWORD="$PROD_PASSWORD" pg_isready -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ ERROR: No se puede conectar a la base de datos de producción${NC}"
    echo "Verifica las credenciales y la conectividad de red"
    exit 1
fi

echo -e "${GREEN}✅ Conexión exitosa${NC}"
echo ""

# Obtener información básica de la base antes del backup
echo -e "${BLUE}📊 Obteniendo información de la base de producción...${NC}"

# Contar registros en tablas principales
echo "Conteos de registros principales:"
PGPASSWORD="$PROD_PASSWORD" psql -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -d "$PROD_DB" -t -c "
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
FROM \"Fuel\"
UNION ALL
SELECT 
    'Registration Requests: ' || COUNT(*) 
FROM \"RegistrationRequest\";" 2>/dev/null | sed 's/^[ \t]*/  • /'

echo ""

# Realizar el backup
echo -e "${BLUE}💾 Iniciando backup de producción...${NC}"
start_time=$(date +%s)

# Usar pg_dump con opciones optimizadas para backup
PGPASSWORD="$PROD_PASSWORD" pg_dump \
    -h "$PROD_HOST" \
    -p "$PROD_PORT" \
    -U "$PROD_USER" \
    -d "$PROD_DB" \
    -F p \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --create \
    --verbose \
    > "$BACKUP_FILE" 2>/dev/null

# Verificar si el dump fue exitoso
if [ $? -eq 0 ]; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    echo -e "${GREEN}✅ Backup creado exitosamente en ${duration} segundos${NC}"
    echo ""
    
    # Verificar tamaño del archivo
    FILE_SIZE=$(stat -f "%z" "$BACKUP_FILE" 2>/dev/null || wc -c < "$BACKUP_FILE")
    FILE_SIZE_HUMAN=$(du -h "$BACKUP_FILE" | cut -f1)
    
    if [ $FILE_SIZE -lt 50000 ]; then  # Menos de 50KB es sospechoso para producción
        echo -e "${YELLOW}⚠️ ADVERTENCIA: El archivo de backup es pequeño ($FILE_SIZE_HUMAN)${NC}"
        echo -e "${YELLOW}   Esto puede indicar un problema con el backup${NC}"
    else
        echo -e "${GREEN}✅ Tamaño del backup: $FILE_SIZE_HUMAN${NC}"
    fi
    
    # Verificar contenido del backup
    echo ""
    echo -e "${BLUE}🔍 Verificando contenido del backup...${NC}"
    
    # Contar tablas en el backup
    TABLES_COUNT=$(grep -c "CREATE TABLE" "$BACKUP_FILE")
    if [ "$TABLES_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✅ Contiene $TABLES_COUNT definiciones de tablas${NC}"
    else
        echo -e "${RED}❌ ERROR: No contiene definiciones de tablas${NC}"
    fi
    
    # Verificar tablas críticas
    echo ""
    echo "Verificando tablas críticas:"
    
    # Lista de tablas que debe contener
    CRITICAL_TABLES=("Tenant" "Unit" "Fuel" "RegistrationRequest" "TenantSettings")
    
    for table in "${CRITICAL_TABLES[@]}"; do
        if grep -q "CREATE TABLE.*\"$table\"" "$BACKUP_FILE"; then
            echo -e "  ${GREEN}✅ $table${NC}"
        else
            echo -e "  ${RED}❌ $table (FALTANTE)${NC}"
        fi
    done
    
    # Verificar si contiene datos
    echo ""
    if grep -q "COPY.*FROM stdin" "$BACKUP_FILE"; then
        DATA_LINES=$(grep -c "COPY.*FROM stdin" "$BACKUP_FILE")
        echo -e "${GREEN}✅ Contiene datos ($DATA_LINES tablas con datos)${NC}"
    else
        echo -e "${YELLOW}⚠️ No se detectaron datos o están en formato diferente${NC}"
    fi
    
    # Información final
    echo ""
    echo -e "${GREEN}🎉 BACKUP DE PRODUCCIÓN COMPLETADO${NC}"
    echo "================================================"
    echo "📁 Ubicación: $BACKUP_FILE"
    echo "📊 Tamaño: $FILE_SIZE_HUMAN"
    echo "⏱️ Duración: ${duration}s"
    echo "🗓️ Fecha: $(date)"
    echo ""
    
    # Crear checksum para verificar integridad
    CHECKSUM=$(shasum -a 256 "$BACKUP_FILE" | cut -d' ' -f1)
    echo "🔐 Checksum SHA256: $CHECKSUM"
    echo "$CHECKSUM  $BACKUP_FILE" > "${BACKUP_FILE}.sha256"
    echo -e "${GREEN}✅ Checksum guardado en: ${BACKUP_FILE}.sha256${NC}"
    
else
    echo -e "${RED}❌ ERROR: Falló la creación del backup${NC}"
    echo "Verifica la conectividad y permisos"
    exit 1
fi

echo ""
echo -e "${BLUE}📜 Últimos backups de producción disponibles:${NC}"
ls -lht "$BACKUP_DIR" | grep ".sql" | head -n 3 | sed 's/^/  /'

echo ""
echo -e "${YELLOW}💡 IMPORTANTE:${NC}"
echo "  • Este backup contiene datos SENSIBLES de producción"
echo "  • Manténlo seguro y no lo subas a repositorios públicos"  
echo "  • Usa este backup solo para desarrollo local"
echo ""