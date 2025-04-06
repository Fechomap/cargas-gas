// src/models/unit.model.js
import mongoose from 'mongoose';

const unitSchema = new mongoose.Schema({
  operatorName: {
    type: String,
    required: [true, 'El nombre del operador es obligatorio'],
    trim: true
  },
  unitNumber: {
    type: String,
    required: [true, 'El número económico es obligatorio'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Referencia para facilitar consultas relacionadas
  buttonId: {
    type: String,
    unique: true,
    required: true
  }
}, {
  timestamps: true,
  // Agregar índices para mejorar búsquedas
  indexes: [
    { operatorName: 1 },
    { unitNumber: 1 },
    { buttonId: 1 }
  ]
});

// Método estático para generar buttonId
unitSchema.statics.generateButtonId = function(operatorName, unitNumber) {
  // Formato: unit_NombreOperador_NumeroUnidad
  return `unit_${operatorName.replace(/\s+/g, '_')}_${unitNumber}`;
};

// Método estático para buscar o crear unidad
unitSchema.statics.findOrCreateUnit = async function(unitData) {
  const buttonId = this.generateButtonId(unitData.operatorName, unitData.unitNumber);
  
  // Buscar unidad existente
  let unit = await this.findOne({ buttonId });
  
  // Si no existe, crearla
  if (!unit) {
    unit = await this.create({
      ...unitData,
      buttonId
    });
  }
  
  return unit;
};

// Crear modelo
export const Unit = mongoose.model('Unit', unitSchema);