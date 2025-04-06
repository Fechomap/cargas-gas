// src/services/report.service.js
import XLSX from 'xlsx';
import PdfPrinter from 'pdfmake';
import { fuelService } from './fuel.service.js';
import { storageService } from './storage.service.js';
import { logger } from '../utils/logger.js';

// Definir fuentes para PDFMake
const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

// Crear instancia de PDFMake
const printer = new PdfPrinter(fonts);

/**
 * Servicio para la generación de reportes
 */
class ReportService {
  /**
   * Genera un reporte en formato PDF
   * @param {Object} filters - Filtros aplicados al reporte
   * @returns {Promise<Object>} - Archivo PDF generado
   */
  async generatePdfReport(filters) {
    try {
      // Obtener datos para el reporte
      const reportData = await fuelService.generateReport(filters);
      
      // Crear estructura del documento PDF
      const docDefinition = this.createPdfDocDefinition(reportData, filters);
      
      // Generar PDF
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      
      // Crear archivo temporal
      const tempFilePath = await new Promise((resolve, reject) => {
        let chunks = [];
        pdfDoc.on('data', chunk => chunks.push(chunk));
        pdfDoc.on('end', () => {
          const result = Buffer.concat(chunks);
          storageService.createTempFile(result, 'pdf')
            .then(resolve)
            .catch(reject);
        });
        pdfDoc.on('error', reject);
        pdfDoc.end();
      });
      
      return {
        ...tempFilePath,
        filename: `Reporte_${this.getReportDateString()}.pdf`
      };
    } catch (error) {
      logger.error(`Error al generar reporte PDF: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Genera un reporte en formato Excel
   * @param {Object} filters - Filtros aplicados al reporte
   * @returns {Promise<Object>} - Archivo Excel generado
   */
  async generateExcelReport(filters) {
    try {
      // Obtener datos para el reporte
      const reportData = await fuelService.generateReport(filters);
      
      // Crear libro de Excel
      const workbook = XLSX.utils.book_new();
      
      // Crear hoja de datos
      const worksheetData = reportData.entries.map(entry => ({
        'Fecha': new Date(entry.recordDate).toLocaleString(),
        'Operador': entry.operatorName,
        'Unidad': entry.unitNumber,
        'Tipo': entry.fuelType,
        'Litros': entry.liters,
        'Monto': entry.amount,
        'Estatus': entry.paymentStatus,
        'Fecha Pago': entry.paymentDate ? new Date(entry.paymentDate).toLocaleString() : 'N/A'
      }));
      
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      
      // Añadir hoja al libro
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cargas');
      
      // Crear hoja de resumen
      const summaryData = [
        { 'Concepto': 'Total de registros', 'Valor': reportData.summary.totalEntries },
        { 'Concepto': 'Total de litros', 'Valor': reportData.summary.totalLiters.toFixed(2) },
        { 'Concepto': 'Monto total', 'Valor': `$${reportData.summary.totalAmount.toFixed(2)}` },
        { 'Concepto': 'Cargas de gas', 'Valor': reportData.summary.countByFuelType.gas },
        { 'Concepto': 'Cargas de gasolina', 'Valor': reportData.summary.countByFuelType.gasolina },
        { 'Concepto': 'Cargas pagadas', 'Valor': reportData.summary.countByPaymentStatus.pagada },
        { 'Concepto': 'Cargas no pagadas', 'Valor': reportData.summary.countByPaymentStatus['no pagada'] }
      ];
      
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      
      // Añadir hoja de resumen al libro
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
      
      // Convertir a buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Crear archivo temporal
      const tempFile = await storageService.createTempFile(excelBuffer, 'xlsx');
      
      return {
        ...tempFile,
        filename: `Reporte_${this.getReportDateString()}.xlsx`
      };
    } catch (error) {
      logger.error(`Error al generar reporte Excel: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Marca todas las notas del reporte como pagadas
   * @param {Object} filters - Filtros aplicados al reporte
   * @returns {Promise<number>} - Cantidad de registros actualizados
   */
  async markAllNotesAsPaid(filters) {
    try {
      // Aplicar filtro de "no pagadas" explícitamente
      const reportFilters = {
        ...filters,
        paymentStatus: 'no pagada'
      };
      
      // Obtener todas las cargas no pagadas según los filtros
      const reportData = await fuelService.generateReport(reportFilters);
      
      // Marcar todas como pagadas
      let count = 0;
      
      for (const entry of reportData.entries) {
        await fuelService.markAsPaid(entry._id);
        count++;
      }
      
      return count;
    } catch (error) {
      logger.error(`Error al marcar notas como pagadas: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Crea la definición del documento PDF
   * @param {Object} reportData - Datos del reporte
   * @param {Object} filters - Filtros aplicados
   * @returns {Object} - Definición del documento para PDFMake
   */
  createPdfDocDefinition(reportData, filters) {
    // Convertir datos a formato tabular para PDF
    const tableBody = [
      ['Fecha', 'Operador', 'Unidad', 'Tipo', 'Litros', 'Monto', 'Estatus']
    ];
    
    reportData.entries.forEach(entry => {
      tableBody.push([
        new Date(entry.recordDate).toLocaleString(),
        entry.operatorName,
        entry.unitNumber,
        entry.fuelType,
        entry.liters.toFixed(2),
        `$${entry.amount.toFixed(2)}`,
        entry.paymentStatus
      ]);
    });
    
    // Crear bloque de filtros aplicados
    const filtersApplied = [];
    
    if (filters.startDate && filters.endDate) {
      filtersApplied.push(`Fechas: ${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`);
    }
    
    if (filters.operatorName) {
      filtersApplied.push(`Operador: ${filters.operatorName}`);
    }
    
    if (filters.fuelType) {
      filtersApplied.push(`Tipo de combustible: ${filters.fuelType}`);
    }
    
    if (filters.paymentStatus) {
      filtersApplied.push(`Estatus de pago: ${filters.paymentStatus}`);
    }
    
    // Crear resumen
    const summary = [
      `Total de registros: ${reportData.summary.totalEntries}`,
      `Total de litros: ${reportData.summary.totalLiters.toFixed(2)}`,
      `Monto total: ${reportData.summary.totalAmount.toFixed(2)}`,
      `Cargas de gas: ${reportData.summary.countByFuelType.gas}`,
      `Cargas de gasolina: ${reportData.summary.countByFuelType.gasolina}`,
      `Cargas pagadas: ${reportData.summary.countByPaymentStatus.pagada}`,
      `Cargas no pagadas: ${reportData.summary.countByPaymentStatus['no pagada']}`
    ];
    
    // Definir documento
    return {
      content: [
        { text: 'REPORTE DE CARGAS DE COMBUSTIBLE', style: 'header' },
        { text: `Generado el: ${new Date().toLocaleString()}`, style: 'subheader' },
        
        // Mostrar filtros aplicados
        filtersApplied.length > 0 ? 
          { text: 'Filtros aplicados:', style: 'subheader', margin: [0, 10, 0, 5] } : {},
        filtersApplied.length > 0 ? 
          { ul: filtersApplied } : {},
        
        // Mostrar tabla de datos
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: tableBody
          },
          layout: 'lightHorizontalLines',
          margin: [0, 15, 0, 15]
        },
        
        // Mostrar resumen
        { text: 'Resumen:', style: 'subheader', margin: [0, 10, 0, 5] },
        { ul: summary },
        
        // Agregar nota para reportes no pagados
        filters.paymentStatus === 'no pagada' ? 
          { text: 'Nota: Estas cargas están pendientes de pago.', style: 'note', margin: [0, 15, 0, 0] } : {}
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 10]
        },
        subheader: {
          fontSize: 14,
          bold: true,
          margin: [0, 10, 0, 5]
        },
        note: {
          fontSize: 12,
          italics: true,
          color: 'red'
        }
      },
      defaultStyle: {
        fontSize: 10
      }
    };
  }
  
  /**
   * Obtiene una cadena de fecha para nombres de archivos
   * @returns {string} - Fecha formateada para nombres de archivos
   */
  getReportDateString() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${day}${month}${year}_${hours}${minutes}`;
  }
}

export const reportService = new ReportService();