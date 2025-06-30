#!/bin/bash

# Script sencillo para hacer backup de la base de datos PostgreSQL
# Creado: Mayo 2025

# Configuración
DB_NAME="gas_bot"
DB_USER="gas_bot_user"
BACKUP_DIR="/Users/jhonvc/NODE HEROKU/cargas-GAS/backups"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="gas_bot_backup_${DATE}"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.sql"

# Obtener contraseña de la base de datos del archivo .env
DB_PASSWORD=$(grep DATABASE_URL .env | sed 's/.*password=\([^@]*\).*/\1/')
echo "Contraseña obtenida del archivo .env"

# Crear directorio de backups si no existe
mkdir -p $BACKUP_DIR

echo "Iniciando backup de la base de datos $DB_NAME..."

# Realizar el dump de la base de datos
PGPASSWORD="$DB_PASSWORD" pg_dump -h localhost -U "$DB_USER" -d "$DB_NAME" -F p > "$BACKUP_FILE"

# Verificar si el dump fue exitoso
if [ $? -eq 0 ]; then
    echo "Backup creado exitosamente: $BACKUP_FILE"
    
    # Verificar que el archivo tenga un tamaño razonable (más de 10KB)
    FILE_SIZE=$(stat -f "%z" "$BACKUP_FILE")
    if [ $FILE_SIZE -lt 10240 ]; then
        echo -e "\033[1;33mADVERTENCIA: El archivo de backup es sospechosamente pequeño ($FILE_SIZE bytes)\033[0m"
        echo "Esto puede indicar que el backup no contiene toda la información."
    else
        echo -e "\033[0;32m✔ El tamaño del backup parece adecuado: $(du -h "$BACKUP_FILE" | cut -f1)\033[0m"
    fi
    
    # Verificar estructura de la base de datos (tablas, secuencias, etc.)
    echo -e "\nVerificando contenido del backup..."
    
    # Contar tablas en el backup
    TABLES_COUNT=$(grep -c "CREATE TABLE" "$BACKUP_FILE")
    if [ "$TABLES_COUNT" -gt 0 ]; then
        echo -e "\033[0;32m✔ El backup contiene definiciones de $TABLES_COUNT tablas\033[0m"
        
        # Mostrar las primeras tablas encontradas (hasta 5)
        echo "Tablas encontradas (muestra):"
        grep "CREATE TABLE" "$BACKUP_FILE" | head -n 5 | sed 's/.*TABLE public.\"\([^"]*\)\".*/\1/g' | sed 's/^/ - /g'
    else
        echo -e "\033[1;31m✘ ERROR: El backup no contiene definiciones de tablas\033[0m"
        echo "Es probable que este backup no sea válido o esté incompleto."
    fi
    
    # Verificar tablas críticas del sistema multi-tenant
    echo -e "\nVerificando tablas críticas del sistema:"
    
    # Verificar tabla Tenant (empresas/clientes)
    if grep -q "CREATE TABLE.*\"Tenant\"" "$BACKUP_FILE"; then
        echo -e "\033[0;32m✔ Tabla 'Tenant' encontrada - Tabla de empresas/clientes\033[0m"
    else
        echo -e "\033[1;31m✘ Tabla 'Tenant' NO encontrada - Tabla de empresas/clientes\033[0m"
    fi
    
    # Verificar tabla Unit (unidades/operadores)
    if grep -q "CREATE TABLE.*\"Unit\"" "$BACKUP_FILE"; then
        echo -e "\033[0;32m✔ Tabla 'Unit' encontrada - Tabla de unidades/operadores\033[0m"
    else
        echo -e "\033[1;31m✘ Tabla 'Unit' NO encontrada - Tabla de unidades/operadores\033[0m"
    fi
    
    # Verificar tabla RegistrationRequest (solicitudes de registro)
    if grep -q "CREATE TABLE.*\"RegistrationRequest\"" "$BACKUP_FILE"; then
        echo -e "\033[0;32m✔ Tabla 'RegistrationRequest' encontrada - Tabla de solicitudes de registro\033[0m"
    else
        echo -e "\033[1;31m✘ Tabla 'RegistrationRequest' NO encontrada - Tabla de solicitudes de registro\033[0m"
    fi
    
    # Verificar datos en el backup
    echo -e "\nVerificando datos en el backup:"
    if grep -q "INSERT INTO" "$BACKUP_FILE" || grep -q "COPY .* FROM stdin" "$BACKUP_FILE"; then
        echo -e "\033[0;32m✔ Se encontraron datos en el backup\033[0m"
    else
        echo -e "\033[1;33mADVERTENCIA: No se encontraron datos en el backup o están en formato binario\033[0m"
    fi
    
    echo -e "\n\033[0;32m¡Backup completado con éxito!\033[0m"
else
    echo "Error al crear el backup."
    exit 1
fi

# Mostrar la ubicación del backup
echo "El backup está disponible en: $BACKUP_FILE"

# Listar los últimos 5 backups
echo -e "\nÚltimos backups disponibles:"
ls -lht "$BACKUP_DIR" | grep ".sql" | head -n 5
