import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../lib/utils';

interface PDFReportData {
  title: string;
  monthName: string;
  currency: string;
  stats: {
    income: number;
    expenses: number;
    projectSplit: { personal: number; shared: number };
    methods: Record<string, number>;
    catMap: Record<string, number>;
    fixed: number;
    variable: number;
  };
  transactions: any[];
  categories: any[];
  projects: any[];
  userName: string;
  userEmail: string;
  profileCurrency?: string;
  logoBase64?: string;
}

export const generateProfessionalPDF = async (data: PDFReportData) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

  // Colors
  const primaryColor: [number, number, number] = [15, 23, 42]; // Slate-900
  const accentColor: [number, number, number] = [16, 185, 129]; // Emerald-500
  const textColor: [number, number, number] = [51, 65, 85]; // Slate-600
  const lightBg: [number, number, number] = [248, 250, 252]; // Slate-50

  // 1. HEADER
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  let headerTextX = margin;
  if (data.logoBase64) {
    try {
      doc.addImage(data.logoBase64, 'PNG', margin, 12, 16, 16);
      headerTextX = margin + 22;
    } catch (e) {
      console.warn('Failed to add logo to PDF, skipping...', e);
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('FINAPP', headerTextX, 24);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('CONSOLIDATED FINANCIAL INTELLIGENCE', headerTextX, 31);
  
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`ID: #${Date.now().toString(36).toUpperCase()}`, pageWidth - margin - 35, 20);
  doc.text(`FECHA: ${new Date().toLocaleDateString()}`, pageWidth - margin - 35, 25);

  // 2. TITLE & PERIOD
  doc.setTextColor(...primaryColor);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text((data.title || 'REPORT').toUpperCase(), margin, 55);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  doc.text(`Periodo: ${data.monthName || 'N/A'}`, margin, 62);
  doc.text(`Divisa de Reporte: ${data.currency || 'USD'}`, margin, 68);

  // 3. EXECUTIVE SUMMARY
  doc.setFillColor(...lightBg);
  doc.roundedRect(margin, 75, pageWidth - (margin * 2), 40, 3, 3, 'F');
  
  // Income
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('INGRESOS TOTALES', margin + 10, 85);
  doc.setTextColor(5, 150, 105); // emerald-700
  doc.setFontSize(14);
  doc.text(`+ ${formatCurrency(data.stats.income || 0, data.currency)}`, margin + 10, 93);
  
  // Expenses
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.text('GASTOS TOTALES', margin + 80, 85);
  doc.setTextColor(190, 18, 60); // rose-700
  doc.setFontSize(14);
  doc.text(`- ${formatCurrency(data.stats.expenses || 0, data.currency)}`, margin + 80, 93);
  
  // Net Balance
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.text('BALANCE NETO', margin + 145, 85);
  const net = (data.stats.income || 0) - (data.stats.expenses || 0);
  doc.setTextColor(net >= 0 ? 5 : 190, net >= 0 ? 150 : 18, net >= 0 ? 105 : 60);
  doc.setFontSize(14);
  doc.text(`${formatCurrency(net, data.currency)}`, margin + 145, 93);

  // Divider
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(margin + 5, 100, pageWidth - margin - 5, 100);
  
  // Additional summary info
  doc.setFontSize(8);
  doc.setTextColor(...textColor);
  doc.text(`Distribución de Capital: Personal (${formatCurrency(data.stats.projectSplit?.personal || 0, data.currency)}) | Proyectos (${formatCurrency(data.stats.projectSplit?.shared || 0, data.currency)})`, margin + 10, 108);

  // 3.1 FINANCIAL STABILITY ANALYSIS
  const stabilityY = 118;
  doc.setTextColor(...primaryColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ANÁLISIS DE ESTABILIDAD', margin, stabilityY);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  const fixedPct = data.stats.expenses > 0 ? (data.stats.fixed / data.stats.expenses * 100).toFixed(0) : '0';
  const variablePct = data.stats.expenses > 0 ? (data.stats.variable / data.stats.expenses * 100).toFixed(0) : '0';
  const coverage = data.stats.fixed > 0 ? (data.stats.income / data.stats.fixed).toFixed(1) : '∞';
  
  doc.text(`Gastos Fijos: ${formatCurrency(data.stats.fixed, data.currency)} (${fixedPct}%)`, margin + 5, stabilityY + 7);
  doc.text(`Gastos Variables: ${formatCurrency(data.stats.variable, data.currency)} (${variablePct}%)`, margin + 85, stabilityY + 7);
  doc.text(`Cobertura de Fijos: ${coverage}x ingresos`, margin + 145, stabilityY + 7);

  // 4. CATEGORIES TABLE
  doc.setTextColor(...primaryColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DESGLOSE POR CATEGORÍA', margin, 140);

  const catRows = Object.entries(data.stats.catMap || {})
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => [
      name,
      formatCurrency(amount, data.currency),
      `${((amount / (data.stats.expenses || 1)) * 100).toFixed(1)}%`,
      amount > (data.stats.expenses || 0) * 0.3 ? 'CRÍTICO' : 'ESTABLE'
    ]);

  autoTable(doc, {
    startY: 145,
    head: [['Categoría', 'Monto Invertido', 'Participación', 'Estado']],
    body: catRows,
    theme: 'striped',
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 10 },
    bodyStyles: { fontSize: 9, textColor: textColor },
    margin: { left: margin, right: margin },
  });

  // 5. PAYMENT METHODS
  let finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 15 : 140;
  
  doc.setTextColor(...primaryColor);
  doc.setFontSize(14);
  doc.text('FLUJO POR MÉTODO DE PAGO', margin, finalY);

  const methodRows = Object.entries(data.stats.methods || {}).map(([method, amount]) => [
    method,
    formatCurrency(amount, data.currency),
    `${((amount / (data.stats.expenses || 1)) * 100).toFixed(1)}%`
  ]);

  autoTable(doc, {
    startY: finalY + 5,
    head: [['Método', 'Operado', 'Impacto']],
    body: methodRows,
    theme: 'grid',
    headStyles: { fillColor: [51, 65, 85], textColor: 255 },
    margin: { left: margin, right: margin },
  });

  // 6. TRANSACTION LOG (Last 20)
  finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 15 : 170;
  
  // Check if we need a new page
  if (finalY > pageHeight - 50) {
    doc.addPage();
    finalY = margin + 10;
  }

  doc.setTextColor(...primaryColor);
  doc.setFontSize(14);
  doc.text('REGISTRO DE OPERACIONES (DETALLE MENSUAL)', margin, finalY);

  const transRows = (data.transactions || [])
    .filter(t => {
      const p = (data.projects || []).find(pr => pr.id === t.projectId);
      const tCurrency = p?.currency || data.profileCurrency || 'ARS';
      return tCurrency === data.currency;
    })
    .slice(0, 30)
    .map(t => [
      new Date(t.date).toLocaleDateString(),
      t.description || 'Sin descripción',
      (data.categories || []).find(c => c.id === t.categoryId)?.name || t.categoryName || 'Varios',
      t.type === 'income' ? 'N/A' : (t.classification === 'fixed' ? 'Fijo' : 'Var'),
      t.type === 'income' ? '+' : '-',
      formatCurrency(t.amount, data.currency)
    ]);

  autoTable(doc, {
    startY: finalY + 5,
    head: [['Fecha', 'Descripción', 'Categoría', 'Clase', 'Op', 'Monto']],
    body: transRows,
    theme: 'striped',
    headStyles: { fillColor: [71, 85, 105], textColor: 255 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 8, halign: 'center' },
      5: { halign: 'right' }
    },
    margin: { left: margin, right: margin },
  });

  // 7. FOOTER
  const finalPageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= finalPageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${i} de ${finalPageCount} | Documento generado para ${data.userName} (${data.userEmail}) | Confidencial`,
      margin,
      pageHeight - 10
    );
    doc.text('FINAPP AI FINANCIAL ENGINE v2.0', pageWidth - margin - 45, pageHeight - 10);
  }

  return doc;
};
