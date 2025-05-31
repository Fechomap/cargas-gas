-- AlterEnum
-- This migration adds a new value to an existing enum. It's executed
-- as a single transaction with a table creation, creating a new
-- version of the enum and then updating all references to it.

-- Step 1: Create a new version of the enum type
CREATE TYPE "FuelType_new" AS ENUM ('GAS', 'GASOLINA', 'DIESEL');

-- Step 2: Update all columns using the enum to use the new version
ALTER TABLE "Fuel" ALTER COLUMN "fuelType" TYPE "FuelType_new" USING ("fuelType"::text::"FuelType_new");

-- Step 3: Drop the old version of the enum
DROP TYPE "FuelType";

-- Step 4: Rename the new enum to the old name
ALTER TYPE "FuelType_new" RENAME TO "FuelType";
