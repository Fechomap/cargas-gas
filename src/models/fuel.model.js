// src/models/fuel.model.js
import mongoose from 'mongoose';

const fuelSchema = new mongoose.Schema({
  // Relación con la unidad
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: [true, 'La unidad es obligatoria']
  },
  
  // Datos de la carga
  liters: {
    type: Number,
    required: [true, 'La cantidad de litros es obligatoria'],
    min: [0.1, 'La cantidad de litros debe ser mayor a 0']
  },
  amount: {
    type: Number,
    required: [true, 'El monto en pesos es obligatorio'],
    min: [1, 'El monto debe ser mayor a 0']
  },
  fuelType: {
    type: String,
    enum: ['gas', 'gasolina'],
    required: [true, 'El tipo de combustible es obligatorio']
  },
  
  // Número de venta (1-6 caracteres alfanuméricos)
  saleNumber: {
    type: String,
    match: [/^[A-Za-z0-9-]{1,6}$/, 'El número de venta debe ser de 1 a 6 caracteres alfanuméricos'],
    default: null
  },
  
  // Gestión de pagos
  paymentStatus: {
    type: String,
    enum: ['pagada', 'no pagada'],
    default: 'no pagada'
  },
  paymentDate: {
    type: Date,
    default: null
  },
  
  // Documentación
  ticketPhoto: {
    type: String,  // URL o ID de la foto
    default: null
  },
  
  // Metadatos
  operatorName: String,
  unitNumber: String,
  recordDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  // Índices para mejorar rendimiento de consultas
  indexes: [
    { unitId: 1 },
    { paymentStatus: 1 },
    { fuelType: 1 },
    { recordDate: 1 },
    { operatorName: 1 },
    { saleNumber: 1 }  // Índice para número de venta
  ]
});

// Método para marcar como pagado
fuelSchema.methods.markAsPaid = function() {
  this.paymentStatus = 'pagada';
  this.paymentDate = new Date();
  return this.save();
};

// Método para calcular el total de cargas no pagadas
fuelSchema.statics.getTotalUnpaidAmount = async function() {
  const result = await this.aggregate([
    { $match: { paymentStatus: 'no pagada' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  
  return result.length > 0 ? result[0].total : 0;
};

// Método para generar reporte
fuelSchema.statics.generateReport = async function(filters = {}) {
  const query = {};
  
  // Aplicar filtros
  if (filters.startDate && filters.endDate) {
    query.recordDate = { 
      $gte: new Date(filters.startDate), 
      $lte: new Date(filters.endDate) 
    };
  }
  
  if (filters.operatorName) {
    query.operatorName = filters.operatorName;
  }
  
  if (filters.fuelType) {
    query.fuelType = filters.fuelType;
  }
  
  if (filters.paymentStatus) {
    query.paymentStatus = filters.paymentStatus;
  }
  
  // Ejecutar consulta
  return this.find(query)
    .sort({ recordDate: -1 })
    .lean();
};

// Crear modelo
export const Fuel = mongoose.model('Fuel', fuelSchema);