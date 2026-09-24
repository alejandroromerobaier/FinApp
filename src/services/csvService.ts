import { formatCurrency } from '../lib/utils';

interface CSVReportData {
  title: string;
  monthName: string;
  currency: string;
  transactions: any[];
  categories: any[];
  projects: any[];
  userName: string;
  userNames: Record<string, string>;
}

export const generateProfessionalCSV = (data: CSVReportData): string => {
  // Define CSV headers
  const headers = [
    'Fecha',
    'Descripción',
    'Categoría',
    'Tipo',
    'Clasificación',
    'Monto',
    'Moneda',
    'Proyecto',
    'Pago',
    'Autor',
    'Estado'
  ];

  // Process rows
  const rows = data.transactions.map(t => {
    const project = data.projects.find(p => p.id === t.projectId);
    const category = data.categories.find(c => c.id === t.categoryId);
    
    return [
      new Date(t.date).toLocaleDateString(),
      `"${(t.description || 'Sin descripción').replace(/"/g, '""')}"`,
      `"${(category?.name || t.categoryName || 'Varios').replace(/"/g, '""')}"`,
      t.type === 'income' ? 'Ingreso' : 'Egreso',
      t.type === 'income' ? 'N/A' : (t.classification === 'fixed' ? 'Fijo' : 'Variable'),
      t.amount.toString().replace('.', ','),
      project?.currency || data.currency,
      `"${(project?.name || 'Personal').replace(/"/g, '""')}"`,
      `"${(t.paymentMethod || 'Efectivo').replace(/"/g, '""')}"`,
      `"${(data.userNames[t.authorId] || (t.authorId === 'me' ? data.userName : 'Desconocido')).replace(/"/g, '""')}"`,
      'Verificado'
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.join(';'))
  ].join('\n');

  // Add BOM for Excel UTF-8 support
  return '\uFEFF' + csvContent;
};

export const downloadCSV = (content: string, fileName: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
