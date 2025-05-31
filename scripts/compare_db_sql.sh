#!/bin/bash

# Script para comparar esquemas entre bases de datos local y de producción utilizando SQL directo
# Creado: Mayo 2025

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Comparador de esquemas de base de datos ===${NC}"

# Configuración de conexiones
echo -e "${BLUE}Configurando conexiones...${NC}"

# Conexión local
LOCAL_DB_USER="gas_bot_user"
LOCAL_DB_PASSWORD="gas_bot_password"
LOCAL_DB_HOST="localhost"
LOCAL_DB_PORT="5432"
LOCAL_DB_NAME="gas_bot"
LOCAL_CONN="postgresql://$LOCAL_DB_USER:$LOCAL_DB_PASSWORD@$LOCAL_DB_HOST:$LOCAL_DB_PORT/$LOCAL_DB_NAME"

# Conexión de producción (Railway)
PROD_DB_USER="postgres"
PROD_DB_PASSWORD="XxsSSgKHlRkyWQQIxjQSHJdQslUlhfZp"
PROD_DB_HOST="trolley.proxy.rlwy.net"
PROD_DB_PORT="26635"
PROD_DB_NAME="railway"
PROD_CONN="postgresql://$PROD_DB_USER:$PROD_DB_PASSWORD@$PROD_DB_HOST:$PROD_DB_PORT/$PROD_DB_NAME"

echo -e "${GREEN}✓ Conexión local:${NC} $LOCAL_DB_HOST:$LOCAL_DB_PORT/$LOCAL_DB_NAME ($LOCAL_DB_USER)"
echo -e "${GREEN}✓ Conexión producción:${NC} $PROD_DB_HOST:$PROD_DB_PORT/$PROD_DB_NAME ($PROD_DB_USER)"
echo

# Crear directorios temporales
TEMP_DIR="/tmp/db_compare_$(date +%s)"
mkdir -p $TEMP_DIR

# Función para ejecutar consulta SQL y guardar resultado
run_query() {
    local conn=$1
    local query=$2
    local output_file=$3
    
    psql "$conn" -t -c "$query" > "$output_file"
    return $?
}

# === Verificar tablas ===
echo -e "${BLUE}Comparando tablas...${NC}"

# Obtener lista de tablas
TABLE_QUERY="SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
LOCAL_TABLES_FILE="$TEMP_DIR/local_tables.txt"
PROD_TABLES_FILE="$TEMP_DIR/prod_tables.txt"

run_query "$LOCAL_CONN" "$TABLE_QUERY" "$LOCAL_TABLES_FILE"
run_query "$PROD_CONN" "$TABLE_QUERY" "$PROD_TABLES_FILE"

# Comparar tablas
DIFF_TABLES=$(diff -u "$LOCAL_TABLES_FILE" "$PROD_TABLES_FILE")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Las mismas tablas existen en ambas bases de datos${NC}"
    # Mostrar tablas encontradas
    echo "Tablas encontradas:"
    cat "$LOCAL_TABLES_FILE" | sed 's/^/ - /'
else
    echo -e "${RED}✘ Hay diferencias en las tablas:${NC}"
    echo "$DIFF_TABLES" | grep -E "^\+|^\-" | grep -v "^--- " | grep -v "^\+\+\+ " | sed 's/^+/ + /' | sed 's/^-/ - /'
fi
echo

# === Verificar enums ===
echo -e "${BLUE}Comparando tipos enumerados...${NC}"

# Obtener lista de enums
ENUM_QUERY="SELECT t.typname AS enum_name, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values 
            FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid 
            GROUP BY enum_name ORDER BY enum_name;"
LOCAL_ENUMS_FILE="$TEMP_DIR/local_enums.txt"
PROD_ENUMS_FILE="$TEMP_DIR/prod_enums.txt"

run_query "$LOCAL_CONN" "$ENUM_QUERY" "$LOCAL_ENUMS_FILE"
run_query "$PROD_CONN" "$ENUM_QUERY" "$PROD_ENUMS_FILE"

# Comparar enums
DIFF_ENUMS=$(diff -u "$LOCAL_ENUMS_FILE" "$PROD_ENUMS_FILE")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Los mismos tipos enumerados existen en ambas bases de datos${NC}"
    # Mostrar enums encontrados
    echo "Tipos enumerados encontrados:"
    cat "$LOCAL_ENUMS_FILE" | sed 's/^/ - /'
else
    echo -e "${RED}✘ Hay diferencias en los tipos enumerados:${NC}"
    echo "$DIFF_ENUMS" | grep -E "^\+|^\-" | grep -v "^--- " | grep -v "^\+\+\+ " | sed 's/^+/ + /' | sed 's/^-/ - /'
fi
echo

# Verificar específicamente el enum FuelType
echo -e "${BLUE}Verificando específicamente el enum FuelType...${NC}"
FUELTYPE_QUERY="SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values 
                FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid 
                WHERE t.typname = 'FuelType';"
LOCAL_FUELTYPE_FILE="$TEMP_DIR/local_fueltype.txt"
PROD_FUELTYPE_FILE="$TEMP_DIR/prod_fueltype.txt"

run_query "$LOCAL_CONN" "$FUELTYPE_QUERY" "$LOCAL_FUELTYPE_FILE"
run_query "$PROD_CONN" "$FUELTYPE_QUERY" "$PROD_FUELTYPE_FILE"

LOCAL_FUELTYPE=$(cat "$LOCAL_FUELTYPE_FILE")
PROD_FUELTYPE=$(cat "$PROD_FUELTYPE_FILE")
if [[ "$LOCAL_FUELTYPE" == "$PROD_FUELTYPE" ]]; then
    echo -e "${GREEN}✓ El enum FuelType tiene los mismos valores en ambas bases de datos: $LOCAL_FUELTYPE${NC}"
else
    echo -e "${RED}✘ El enum FuelType tiene valores diferentes:${NC}"
    echo -e "${YELLOW}Local:${NC} $LOCAL_FUELTYPE"
    echo -e "${YELLOW}Producción:${NC} $PROD_FUELTYPE"
fi
echo

# === Verificar columnas por tabla ===
echo -e "${BLUE}Comparando estructura de tablas...${NC}"

# Obtener estructura de columnas
COLUMNS_QUERY="SELECT table_name, column_name, data_type, is_nullable, column_default 
              FROM information_schema.columns 
              WHERE table_schema = 'public' 
              ORDER BY table_name, ordinal_position;"
LOCAL_COLUMNS_FILE="$TEMP_DIR/local_columns.txt"
PROD_COLUMNS_FILE="$TEMP_DIR/prod_columns.txt"

run_query "$LOCAL_CONN" "$COLUMNS_QUERY" "$LOCAL_COLUMNS_FILE"
run_query "$PROD_CONN" "$COLUMNS_QUERY" "$PROD_COLUMNS_FILE"

# Comparar columnas
DIFF_COLUMNS=$(diff -u "$LOCAL_COLUMNS_FILE" "$PROD_COLUMNS_FILE")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Las estructuras de tablas son idénticas${NC}"
else
    echo -e "${RED}✘ Hay diferencias en las estructuras de tablas:${NC}"
    echo "$DIFF_COLUMNS" | grep -E "^\+|^\-" | grep -v "^--- " | grep -v "^\+\+\+ " | sed 's/^+/ + /' | sed 's/^-/ - /'
fi
echo

# === Verificar índices ===
echo -e "${BLUE}Comparando índices...${NC}"

# Obtener índices
INDICES_QUERY="SELECT tablename, indexname, indexdef 
              FROM pg_indexes 
              WHERE schemaname = 'public' 
              ORDER BY tablename, indexname;"
LOCAL_INDICES_FILE="$TEMP_DIR/local_indices.txt"
PROD_INDICES_FILE="$TEMP_DIR/prod_indices.txt"

run_query "$LOCAL_CONN" "$INDICES_QUERY" "$LOCAL_INDICES_FILE"
run_query "$PROD_CONN" "$INDICES_QUERY" "$PROD_INDICES_FILE"

# Comparar índices
DIFF_INDICES=$(diff -u "$LOCAL_INDICES_FILE" "$PROD_INDICES_FILE")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Los índices son idénticos${NC}"
else
    echo -e "${RED}✘ Hay diferencias en los índices:${NC}"
    echo "$DIFF_INDICES" | grep -E "^\+|^\-" | grep -v "^--- " | grep -v "^\+\+\+ " | sed 's/^+/ + /' | sed 's/^-/ - /'
fi
echo

# === Verificar restricciones ===
echo -e "${BLUE}Comparando restricciones (foreign keys, constraints)...${NC}"

# Obtener restricciones
CONSTRAINTS_QUERY="SELECT c.conname AS constraint_name, 
                         c.contype AS constraint_type,
                         t1.relname AS table_name,
                         CASE WHEN c.contype = 'f' 
                              THEN (SELECT relname FROM pg_class WHERE oid = c.confrelid) 
                              ELSE NULL 
                         END AS referenced_table_name
                  FROM pg_constraint c
                  JOIN pg_class t1 ON c.conrelid = t1.oid
                  JOIN pg_namespace n ON n.oid = c.connamespace
                  WHERE n.nspname = 'public'
                  ORDER BY t1.relname, c.conname;"
LOCAL_CONSTRAINTS_FILE="$TEMP_DIR/local_constraints.txt"
PROD_CONSTRAINTS_FILE="$TEMP_DIR/prod_constraints.txt"

run_query "$LOCAL_CONN" "$CONSTRAINTS_QUERY" "$LOCAL_CONSTRAINTS_FILE"
run_query "$PROD_CONN" "$CONSTRAINTS_QUERY" "$PROD_CONSTRAINTS_FILE"

# Comparar restricciones
DIFF_CONSTRAINTS=$(diff -u "$LOCAL_CONSTRAINTS_FILE" "$PROD_CONSTRAINTS_FILE")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Las restricciones son idénticas${NC}"
else
    echo -e "${RED}✘ Hay diferencias en las restricciones:${NC}"
    echo "$DIFF_CONSTRAINTS" | grep -E "^\+|^\-" | grep -v "^--- " | grep -v "^\+\+\+ " | sed 's/^+/ + /' | sed 's/^-/ - /'
fi
echo

# Verificar específicamente la columna isActive en la tabla Fuel
echo -e "${BLUE}Verificando específicamente la columna isActive en la tabla Fuel...${NC}"
ISACTIVE_QUERY="SELECT column_name, data_type, is_nullable, column_default 
               FROM information_schema.columns 
               WHERE table_schema = 'public' 
                 AND table_name = 'Fuel'
                 AND column_name = 'isActive';"
LOCAL_ISACTIVE_FILE="$TEMP_DIR/local_isactive.txt"
PROD_ISACTIVE_FILE="$TEMP_DIR/prod_isactive.txt"

run_query "$LOCAL_CONN" "$ISACTIVE_QUERY" "$LOCAL_ISACTIVE_FILE"
run_query "$PROD_CONN" "$ISACTIVE_QUERY" "$PROD_ISACTIVE_FILE"

LOCAL_ISACTIVE=$(cat "$LOCAL_ISACTIVE_FILE")
PROD_ISACTIVE=$(cat "$PROD_ISACTIVE_FILE")
if [[ -z "$LOCAL_ISACTIVE" && -z "$PROD_ISACTIVE" ]]; then
    echo -e "${RED}✘ La columna isActive NO existe en ninguna base de datos${NC}"
elif [[ -z "$LOCAL_ISACTIVE" ]]; then
    echo -e "${RED}✘ La columna isActive existe en producción pero NO en local${NC}"
elif [[ -z "$PROD_ISACTIVE" ]]; then
    echo -e "${RED}✘ La columna isActive existe en local pero NO en producción${NC}"
elif [[ "$LOCAL_ISACTIVE" == "$PROD_ISACTIVE" ]]; then
    echo -e "${GREEN}✓ La columna isActive existe y coincide en ambas bases de datos:${NC}"
    echo -e "$LOCAL_ISACTIVE"
else
    echo -e "${RED}✘ La columna isActive existe en ambas bases de datos pero con diferente configuración:${NC}"
    echo -e "${YELLOW}Local:${NC}\n$LOCAL_ISACTIVE"
    echo -e "${YELLOW}Producción:${NC}\n$PROD_ISACTIVE"
fi

# Limpiar archivos temporales
rm -rf $TEMP_DIR

echo
echo -e "${GREEN}=== Comparación de bases de datos completada ===${NC}"
