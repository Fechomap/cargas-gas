// src/services/report.service.js
import XLSX from 'xlsx';
import PdfPrinter from 'pdfmake';
import { fuelService } from './fuel.service.js';
import { storageService } from './storage.service.js';
import { logger } from '../utils/logger.js';
import ExcelJS from 'exceljs';

// Función formatDate
function formatDate(date) {
  const options = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Mexico_City'
  };

  const formattedDate = new Intl.DateTimeFormat('es-MX', options).format(date);
  return formattedDate.replace(/\//g, '-');
}

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
      
      // Crear libro de Excel con ExcelJS
      const workbook = new ExcelJS.Workbook();
      
      // Configurar propiedades del documento
      workbook.creator = 'Cargas de Gas Bot';
      workbook.created = new Date();
      
      // Crear hoja de datos
      const worksheet = workbook.addWorksheet('Cargas');
      
      // Definir columnas con tipos específicos (INCLUIR NÚMERO DE VENTA)
      worksheet.columns = [
        { header: 'Fecha', key: 'fecha', width: 20 },
        { header: 'Operador', key: 'operador', width: 15 },
        { header: 'Unidad', key: 'unidad', width: 10 },
        { header: 'Tipo', key: 'tipo', width: 10 },
        { header: 'Litros', key: 'litros', width: 10 },
        { header: 'Monto', key: 'monto', width: 12 },
        { header: 'Número de Venta', key: 'numeroVenta', width: 15 }, // NUEVA COLUMNA
        { header: 'Estatus', key: 'estatus', width: 12 },
        { header: 'Fecha Pago', key: 'fechaPago', width: 20 }
      ];
      
      // Estilo para los encabezados
      worksheet.getRow(1).font = { bold: true };
      
      // Añadir datos
      reportData.entries.forEach(entry => {
        const row = worksheet.addRow({
          fecha: new Date(entry.recordDate),
          operador: entry.operatorName,
          unidad: entry.unitNumber,
          tipo: entry.fuelType,
          litros: entry.liters,
          monto: entry.amount,
          numeroVenta: entry.saleNumber || 'N/A', // INCLUIR NÚMERO DE VENTA
          estatus: entry.paymentStatus,
          fechaPago: entry.paymentDate ? new Date(entry.paymentDate) : null
        });
        
        // Formatear columnas numéricas
        row.getCell('litros').numFmt = '0.00';
        row.getCell('monto').numFmt = '$#,##0.00';
        
        // Formatear fechas
        row.getCell('fecha').numFmt = 'dd/mm/yyyy hh:mm:ss';
        if (entry.paymentDate) {
          row.getCell('fechaPago').numFmt = 'dd/mm/yyyy hh:mm:ss';
        }
      });
      
      // Crear hoja de resumen
      const summarySheet = workbook.addWorksheet('Resumen');
      
      // Configurar columnas de resumen
      summarySheet.columns = [
        { header: 'Concepto', key: 'concepto', width: 25 },
        { header: 'Valor', key: 'valor', width: 15 }
      ];
      
      // Estilo para los encabezados del resumen
      summarySheet.getRow(1).font = { bold: true };
      
      // Añadir datos de resumen
      const summaryRows = [
        { concepto: 'Total de registros', valor: reportData.summary.totalEntries },
        { concepto: 'Total de litros', valor: reportData.summary.totalLiters },
        { concepto: 'Monto total', valor: reportData.summary.totalAmount },
        { concepto: 'Cargas de gas', valor: reportData.summary.countByFuelType.gas },
        { concepto: 'Cargas de gasolina', valor: reportData.summary.countByFuelType.gasolina },
        { concepto: 'Cargas pagadas', valor: reportData.summary.countByPaymentStatus.pagada },
        { concepto: 'Cargas no pagadas', valor: reportData.summary.countByPaymentStatus['no pagada'] }
      ];
      
      summaryRows.forEach(item => {
        const row = summarySheet.addRow(item);
        if (item.concepto === 'Total de litros') {
          row.getCell('valor').numFmt = '0.00';
        } else if (item.concepto === 'Monto total') {
          row.getCell('valor').numFmt = '$#,##0.00';
        }
      });
      
      // Crear buffer para guardar archivo
      const buffer = await workbook.xlsx.writeBuffer();
      
      // Crear archivo temporal
      const tempFile = await storageService.createTempFile(buffer, 'xlsx');
      
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
    // Convertir datos a formato tabular para PDF (INCLUIR NÚMERO DE VENTA)
    const tableBody = [
      ['Fecha', 'Operador', 'Unidad', 'Tipo', 'Litros', 'Monto', 'Núm. Venta', 'Estatus']
    ];

    reportData.entries.forEach(entry => {
      tableBody.push([
        formatDate(new Date(entry.recordDate)),
        entry.operatorName,
        entry.unitNumber,
        entry.fuelType,
        entry.liters.toFixed(2),
        `$${entry.amount.toFixed(2)}`,
        entry.saleNumber || 'N/A', // INCLUIR NÚMERO DE VENTA
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
      `Monto total: $${reportData.summary.totalAmount.toFixed(2)}`,
      `Cargas de gas: ${reportData.summary.countByFuelType.gas}`,
      `Cargas de gasolina: ${reportData.summary.countByFuelType.gasolina}`,
      `Cargas pagadas: ${reportData.summary.countByPaymentStatus.pagada}`,
      `Cargas no pagadas: ${reportData.summary.countByPaymentStatus['no pagada']}`
    ];
    
    // Definir documento
    return {
      content: [
        { text: 'REPORTE DE CARGAS DE COMBUSTIBLE', style: 'header' },
        { text: `Generado el: ${formatDate(new Date())}`, style: 'subheader' },
        
        // Mostrar filtros aplicados
        filtersApplied.length > 0 ? 
          { text: 'Filtros aplicados:', style: 'subheader', margin: [0, 10, 0, 5] } : {},
        filtersApplied.length > 0 ? 
          { ul: filtersApplied } : {},
        
        // Mostrar tabla de datos con columnas ajustadas para incluir número de venta
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
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
      },
      pageSize: 'A4',
      pageOrientation: 'landscape' // Cambiar a horizontal para acomodar mejor las columnas
    };
  }
  
  /**
   * Obtiene una cadena de fecha para nombres de archivos
   * @returns {string} - Fecha formateada para nombres de archivos
   */
  getReportDateString() {
    const now = new Date();
    const options = { timeZone: 'America/Mexico_City' };
    const cdmxDate = new Date(now.toLocaleString('en-US', options));
    
    const day = String(cdmxDate.getDate()).padStart(2, '0');
    const month = String(cdmxDate.getMonth() + 1).padStart(2, '0');
    const year = cdmxDate.getFullYear();
    const hours = String(cdmxDate.getHours()).padStart(2, '0');
    const minutes = String(cdmxDate.getMinutes()).padStart(2, '0');
    
    return `${day}${month}${year}_${hours}${minutes}`;
  }
}

export const reportService = new ReportService();