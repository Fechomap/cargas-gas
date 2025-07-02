// src/services/report.prisma.service.js
import XLSX from 'xlsx';
import PdfPrinter from 'pdfmake';
import { FuelService } from './fuel.prisma.service.js';
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
 * Servicio para la generación de reportes usando Prisma/PostgreSQL
 */
class ReportPrismaService {
  /**
   * Genera un reporte en formato PDF
   * @param {Object} filters - Filtros aplicados al reporte
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object>} - Archivo PDF generado
   */
  async generatePdfReport(filters, tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Se requiere tenantId para generar reportes');
      }

      // Obtener datos para el reporte
      const fuels = await FuelService.findFuels(filters, tenantId);

      // Calcular resumen
      const summary = this.calculateSummary(fuels);

      // Crear estructura del documento PDF
      const docDefinition = this.createPdfDocDefinition(fuels, summary, filters);

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
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object>} - Archivo Excel generado
   */
  async generateExcelReport(filters, tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Se requiere tenantId para generar reportes');
      }

      // Obtener datos para el reporte
      const fuels = await FuelService.findFuels(filters, tenantId);

      // Calcular resumen
      const summary = this.calculateSummary(fuels);

      // Crear libro de Excel con ExcelJS
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Sistema de Cargas de Combustible';
      workbook.created = new Date();

      // Crear hoja para datos
      const worksheet = workbook.addWorksheet('Cargas de Combustible');

      // Definir columnas (nueva estructura con kilómetros y precio por litro)
      worksheet.columns = [
        { header: 'Fecha', key: 'date', width: 18 },
        { header: 'Operador', key: 'operator', width: 20 },
        { header: 'Unidad', key: 'unit', width: 15 },
        { header: 'Kilómetros', key: 'kilometers', width: 12 },
        { header: 'Tipo', key: 'type', width: 12 },
        { header: 'Litros', key: 'liters', width: 10 },
        { header: 'Precio/L', key: 'pricePerLiter', width: 10 },
        { header: 'Monto', key: 'amount', width: 12 },
        { header: 'Estado', key: 'status', width: 15 },
        { header: 'Fecha de Pago', key: 'paymentDate', width: 18 },
        { header: 'Venta #', key: 'saleNumber', width: 15 }
      ];

      // Aplicar estilo a encabezados
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };

      // Añadir filas de datos (incluyendo kilómetros y precio por litro)
      fuels.forEach(fuel => {
        worksheet.addRow({
          date: formatDate(new Date(fuel.recordDate)),
          operator: fuel.operatorName,
          unit: fuel.unitNumber,
          kilometers: fuel.kilometers ? Number(fuel.kilometers) : 'N/A',
          type: fuel.fuelType === 'GAS' ? 'Gas' : (fuel.fuelType === 'GASOLINA' ? 'Gasolina' : 'Diésel'),
          liters: Number(fuel.liters),
          pricePerLiter: fuel.pricePerLiter ? Number(fuel.pricePerLiter) : 'N/A',
          amount: Number(fuel.amount),
          status: fuel.paymentStatus === 'PAGADA' ? 'Pagada' : 'No Pagada',
          paymentDate: fuel.paymentDate ? formatDate(new Date(fuel.paymentDate)) : 'N/A',
          saleNumber: fuel.saleNumber || 'N/A'
        });
      });

      // Dar formato a números (incluyendo nuevas columnas)
      worksheet.getColumn('kilometers').numFmt = '#,##0.00';
      worksheet.getColumn('liters').numFmt = '#,##0.00';
      worksheet.getColumn('pricePerLiter').numFmt = '$#,##0.00';
      worksheet.getColumn('amount').numFmt = '$#,##0.00';

      // Agregar resumen al final (ajustado para nuevas columnas)
      worksheet.addRow([]);
      worksheet.addRow(['RESUMEN', '', '', '', '', '', '', '', '', '', '']);
      worksheet.getRow(worksheet.rowCount).font = { bold: true };

      worksheet.addRow(['Total Cargas', summary.totalEntries]);
      worksheet.addRow(['Total Litros', summary.totalLiters]);
      worksheet.addRow(['Total Monto', summary.totalAmount]);
      worksheet.addRow(['Pagadas', summary.paidCount]);
      worksheet.addRow(['No Pagadas', summary.unpaidCount]);

      // Crear archivo
      const buffer = await workbook.xlsx.writeBuffer();

      // Guardar temporalmente
      const tempFilePath = await storageService.createTempFile(buffer, 'xlsx');

      return {
        ...tempFilePath,
        filename: `Reporte_${this.getReportDateString()}.xlsx`
      };
    } catch (error) {
      logger.error(`Error al generar reporte Excel: ${error.message}`);
      throw error;
    }
  }

  /**
   * Marca como pagadas todas las cargas que cumplen con los filtros
   * @param {Object} filters - Filtros aplicados
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async markAllAsPaid(filters, tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Se requiere tenantId para marcar como pagadas');
      }

      // Preparar filtros para encontrar solo las no pagadas
      const reportFilters = {
        ...filters,
        paymentStatus: 'NO_PAGADA'
      };

      // Obtener cargas no pagadas
      const fuels = await FuelService.findFuels(reportFilters, tenantId);

      // Marcar cada una como pagada
      let count = 0;
      for (const fuel of fuels) {
        await FuelService.markAsPaid(fuel.id, tenantId);
        count++;
      }

      return {
        success: true,
        count,
        message: `Se marcaron ${count} cargas como pagadas`
      };
    } catch (error) {
      logger.error(`Error al marcar cargas como pagadas: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calcula el resumen de las cargas
   * @param {Array} fuels - Lista de cargas
   * @returns {Object} - Resumen calculado
   */
  calculateSummary(fuels) {
    const summary = {
      totalEntries: fuels.length,
      totalLiters: 0,
      totalAmount: 0,
      paidCount: 0,
      unpaidCount: 0,
      paidAmount: 0,
      unpaidAmount: 0
    };

    fuels.forEach(fuel => {
      summary.totalLiters += Number(fuel.liters);
      summary.totalAmount += Number(fuel.amount);

      if (fuel.paymentStatus === 'PAGADA') {
        summary.paidCount++;
        summary.paidAmount += Number(fuel.amount);
      } else {
        summary.unpaidCount++;
        summary.unpaidAmount += Number(fuel.amount);
      }
    });

    return summary;
  }

  /**
   * Crea la definición del documento PDF
   * @param {Array} fuels - Datos de cargas
   * @param {Object} summary - Resumen calculado
   * @param {Object} filters - Filtros aplicados
   * @returns {Object} - Definición del documento PDF
   */
  createPdfDocDefinition(fuels, summary, filters) {
    // Preparar datos para la tabla (incluyendo kilómetros y precio por litro)
    const tableData = fuels.map(fuel => [
      formatDate(new Date(fuel.recordDate)),
      fuel.operatorName,
      fuel.unitNumber,
      fuel.kilometers ? fuel.kilometers.toFixed(2) : 'N/A',
      fuel.fuelType === 'GAS' ? 'Gas' : (fuel.fuelType === 'GASOLINA' ? 'Gasolina' : 'Diésel'),
      fuel.liters.toFixed(2),
      fuel.pricePerLiter ? `$${fuel.pricePerLiter.toFixed(2)}` : 'N/A',
      `$${fuel.amount.toFixed(2)}`,
      fuel.paymentStatus === 'PAGADA' ? 'Pagada' : 'No Pagada',
      fuel.paymentDate ? formatDate(new Date(fuel.paymentDate)) : 'N/A',
      fuel.saleNumber || 'N/A'
    ]);

    // Agregar encabezados (nueva estructura con kilómetros y precio por litro)
    tableData.unshift([
      'Fecha', 'Operador', 'Unidad', 'Kilómetros', 'Tipo',
      'Litros', 'Precio/L', 'Monto', 'Estado', 'Fecha de Pago', '# Venta'
    ]);

    // Crear documento
    return {
      // Configurar página en orientación horizontal
      pageOrientation: 'landscape',
      pageSize: 'A4',
      content: [
        { text: 'Reporte de Cargas de Combustible', style: 'header' },
        { text: `Generado: ${formatDate(new Date())}`, style: 'subheader' },
        this.getFiltersDescription(filters),
        { text: ' ' },
        {
          table: {
            headerRows: 1,
            widths: [60, 80, 50, 60, 50, 40, 50, 50, 60, 70, 50],
            body: tableData
          }
        },
        { text: ' ' },
        { text: 'Resumen', style: 'subheader' },
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              ['Total de Cargas', summary.totalEntries.toString()],
              ['Total de Litros', summary.totalLiters.toFixed(2)],
              ['Monto Total', `$${summary.totalAmount.toFixed(2)}`],
              ['Cargas Pagadas', summary.paidCount.toString()],
              ['Monto Pagado', `$${summary.paidAmount.toFixed(2)}`],
              ['Cargas No Pagadas', summary.unpaidCount.toString()],
              ['Monto No Pagado', `$${summary.unpaidAmount.toFixed(2)}`]
            ]
          }
        }
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
        }
      },
      defaultStyle: {
        fontSize: 10
      }
    };
  }

  /**
   * Crea una descripción de los filtros aplicados
   * @param {Object} filters - Filtros aplicados
   * @returns {Object} - Elemento de texto para el PDF
   */
  getFiltersDescription(filters) {
    let description = 'Filtros aplicados: ';
    const filterTexts = [];

    if (filters.startDate && filters.endDate) {
      const start = formatDate(new Date(filters.startDate));
      const end = formatDate(new Date(filters.endDate));
      filterTexts.push(`Período: ${start} a ${end}`);
    }

    if (filters.operatorName) {
      filterTexts.push(`Operador: ${filters.operatorName}`);
    }

    if (filters.fuelType) {
      filterTexts.push(`Tipo: ${filters.fuelType === 'GAS' ? 'Gas' : (filters.fuelType === 'GASOLINA' ? 'Gasolina' : 'Diésel')}`);
    }

    if (filters.paymentStatus) {
      filterTexts.push(`Estado: ${filters.paymentStatus === 'PAGADA' ? 'Pagada' : 'No Pagada'}`);
    }

    return {
      text: filterTexts.length > 0 ? description + filterTexts.join(', ') : 'Sin filtros aplicados',
      style: 'subheader',
      fontSize: 10
    };
  }

  /**
   * Obtiene una cadena de fecha para nombrar el archivo
   * @returns {String} - Cadena de fecha formateada
   */
  getReportDateString() {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  }
}

// Exportar singleton
export const reportPrismaService = new ReportPrismaService();
