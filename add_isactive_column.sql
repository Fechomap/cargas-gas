-- Script para agregar la columna isActive a la tabla Fuel
-- Si la columna no existe, la agrega con valor por defecto TRUE

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'Fuel' AND column_name = 'isActive'
    ) THEN
        ALTER TABLE "Fuel" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
        RAISE NOTICE 'Columna isActive agregada a la tabla Fuel';
    ELSE
        RAISE NOTICE 'La columna isActive ya existe en la tabla Fuel';
    END IF;
END $$;
