import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawPdfHeaderLogo } from './pdfLogo';
import { ProjectData, WorkReport } from '../App';

export interface EmailAttachment {
  filename: string;
  contentType: string;
  base64Data: string;
}

export interface SendFinishedProjectEmailOptions {
  project: ProjectData;
  reports: WorkReport[];
  recipientEmail?: string;
  additionalNotes?: string;
  accessToken: string;
}

export const DEFAULT_COMPLETION_RECIPIENT = 'm.domingogarcia29@gmail.com';

function calculateDuration(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  let mins = (eH * 60 + eM) - (sH * 60 + sM);
  if (mins < 0) mins += 24 * 60;
  return Math.max(0, mins / 60);
}

function formatDateSpanish(dateStr?: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

/**
 * Genera el documento PDF oficial con la ficha de obra terminada y el desglose de todos sus partes de trabajo.
 */
export function generateFinishedProjectPDF(project: ProjectData, reports: WorkReport[]): { doc: jsPDF; base64: string; filename: string } {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Barra superior decorativa corporativa Teal
  doc.setFillColor(0, 121, 123);
  doc.rect(0, 0, 210, 4, 'F');

  // Logotipo oficial
  drawPdfHeaderLogo(doc, { isLandscape: false, x: 14, y: 7, width: 48, height: 17.14 });

  // Encabezado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(31, 41, 55);
  doc.text(`INFORME DE OBRA TERMINADA: ${project.id}`, 196, 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(107, 114, 128);
  const nowStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  doc.text(`Fecha de emisión: ${nowStr}`, 196, 18, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 121, 123);
  doc.text(`ESTADO: CERTIFICADA Y TERMINADA`, 196, 23, { align: 'right' });

  // Línea divisoria
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.4);
  doc.line(14, 27, 196, 27);

  // Tabla con ficha de obra
  const metadataRows = [
    ['ID OBRA', project.id],
    ['NOMBRE DE OBRA', project.name],
    ['CLIENTE', project.client || '-'],
    ['TÉCNICO RESPONSABLE', project.responsibleTech || 'Sin asignar'],
    ['VALORACIÓN', project.valuation || 'POR HORAS'],
    ['Nº PRESUPUESTO', project.budgetNum || '-'],
    ['FECHA DE INICIO', formatDateSpanish(project.startDate)],
    ['FECHA DE FINALIZACIÓN', new Date().toLocaleDateString('es-ES')],
    ['FACTURADA', project.isInvoiced ? `SÍ (Factura Nº ${project.invoiceNum || '-'})` : 'PENDIENTE DE FACTURAR'],
    ['UBICACIÓN', project.location || '-']
  ];

  autoTable(doc, {
    startY: 31,
    head: [['Dato de la Obra', 'Detalle']],
    body: metadataRows,
    theme: 'striped',
    headStyles: { fillColor: [0, 121, 123] },
    styles: { fontSize: 8.5, cellPadding: 2.8 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50, textColor: [31, 41, 55] },
      1: { cellWidth: 'auto', textColor: [55, 65, 81] }
    }
  });

  let currentY = (doc as any).lastAutoTable?.finalY || 85;

  // Notas u Observaciones del texto de la obra si existen
  if (project.notes && project.notes.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 121, 123);
    doc.text('NOTAS Y OBSERVACIONES DE LA OBRA:', 14, currentY + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81);
    const splitNotes = doc.splitTextToSize(project.notes, 182);
    doc.text(splitNotes, 14, currentY + 12);
    currentY += 14 + (splitNotes.length * 4);
  }

  // Resumen de Partes
  let totalWorkedHours = 0;
  let totalOvertimeHours = 0;
  let totalFood = 0;
  let totalGas = 0;
  let totalParking = 0;
  let totalOthers = 0;

  reports.forEach(r => {
    totalWorkedHours += calculateDuration(r.startTime, r.endTime);
    totalOvertimeHours += Number(r.overtimeHours || 0);
    totalFood += Number(r.expenses?.food || 0);
    totalGas += Number(r.expenses?.gas || 0);
    totalParking += Number(r.expenses?.parking || 0);
    totalOthers += Number(r.expenses?.others || 0);
  });

  const totalExpenses = totalFood + totalGas + totalParking + totalOthers;

  // Tarjetas resumen
  const cardY = currentY + 4;
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(209, 213, 219);
  doc.roundedRect(14, cardY, 182, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('RESUMEN DE ACTIVIDAD DE LA OBRA', 18, cardY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(31, 41, 55);
  doc.text(`Total Partes: ${reports.length}`, 18, cardY + 10);
  doc.text(`Horas Regulares: ${totalWorkedHours.toFixed(2)} h`, 60, cardY + 10);
  doc.text(`Horas Extras: ${totalOvertimeHours.toFixed(2)} h`, 110, cardY + 10);
  doc.text(`Gastos/Dietas: ${totalExpenses.toFixed(2)} €`, 155, cardY + 10);

  currentY = cardY + 18;

  // Tabla con los partes de trabajo de la obra
  const sortedReports = [...reports].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const reportsTableBody = sortedReports.map(r => {
    const dur = calculateDuration(r.startTime, r.endTime);
    const ot = r.overtimeHours ? `${r.overtimeHours}h (${r.overtimeType})` : '-';
    
    // Descripción y materiales
    let descContent = r.description || 'Sin descripción';
    if (r.materials && r.materials.length > 0) {
      descContent += '\n[Mat: ' + r.materials.map(m => `${m.quantity} ${m.description}`).join(', ') + ']';
    }

    const expItems: string[] = [];
    if (r.expenses?.food) expItems.push(`Comida: ${r.expenses.food}€`);
    if (r.expenses?.gas) expItems.push(`Gas: ${r.expenses.gas}€`);
    if (r.expenses?.parking) expItems.push(`Park: ${r.expenses.parking}€`);
    if (r.expenses?.others) expItems.push(`Otros: ${r.expenses.others}€ (${r.expenses.othersDesc || '-'})`);
    const expStr = expItems.length > 0 ? expItems.join(' | ') : '-';

    return [
      formatDateSpanish(r.date),
      r.technician || '-',
      `${r.startTime} - ${r.endTime} (${dur.toFixed(1)}h)`,
      ot,
      r.vehicle ? `${r.vehicle} ${r.isDriver ? '(Conductor)' : ''}` : '-',
      expStr,
      descContent
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Fecha', 'Técnico', 'Horario', 'H. Extra', 'Vehículo', 'Gastos/Dietas', 'Trabajo Realizado / Materiales']],
    body: reportsTableBody.length > 0 ? reportsTableBody : [['-', '-', '-', '-', '-', '-', 'No se han registrado partes para esta obra']],
    theme: 'grid',
    headStyles: { fillColor: [0, 121, 123], fontSize: 7.5 },
    styles: { fontSize: 7.2, cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 24 },
      2: { cellWidth: 26 },
      3: { cellWidth: 20 },
      4: { cellWidth: 22 },
      5: { cellWidth: 26 },
      6: { cellWidth: 'auto' }
    }
  });

  // Si la obra tiene albaranes o documentos adjuntos en el proyecto, listarlos como anexo
  if (project.attachments && project.attachments.length > 0) {
    const lastY = (doc as any).lastAutoTable?.finalY || 200;
    if (lastY > 240) doc.addPage();
    const attY = lastY > 240 ? 25 : lastY + 10;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 121, 123);
    doc.text(`DOCUMENTACIÓN Y ALBARANES ADJUNTOS (${project.attachments.length} archivo/s):`, 14, attY);

    const attList = project.attachments.map(att => [att.name || 'Albarán / Archivo', att.type || 'Documento', 'Adjunto al correo']);
    autoTable(doc, {
      startY: attY + 4,
      head: [['Nombre del Albarán / Documento', 'Tipo', 'Estado']],
      body: attList,
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50], fontStyle: 'bold' }
    });
  }

  const rawDataUri = doc.output('datauristring');
  const base64 = rawDataUri.split(',')[1] || '';
  const sanitizedName = (project.name || 'obra').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
  const filename = `Obra_${project.id}_${sanitizedName}_Partes.pdf`;

  return { doc, base64, filename };
}

/**
 * Convierte un DataURI o string base64 a formato base64 limpio.
 */
function cleanBase64Data(raw: string): string {
  if (raw.includes(',')) {
    return raw.split(',')[1].replace(/[\r\n\s]/g, '');
  }
  return raw.replace(/[\r\n\s]/g, '');
}

/**
 * Construye y envía el correo electrónico a través de la API oficial de Gmail con partes y albaranes.
 */
export async function sendFinishedProjectEmail(options: SendFinishedProjectEmailOptions): Promise<{ success: boolean; messageId: string }> {
  const { project, reports, recipientEmail = DEFAULT_COMPLETION_RECIPIENT, additionalNotes, accessToken } = options;

  if (!accessToken) {
    throw new Error('Falta el token de acceso de Google. Conéctese con su cuenta de Google.');
  }

  // 1. Generar el PDF oficial con los partes de la obra
  const { base64: pdfBase64, filename: pdfFilename } = generateFinishedProjectPDF(project, reports);

  // 2. Preparar los adjuntos del email
  const attachments: EmailAttachment[] = [
    {
      filename: pdfFilename,
      contentType: 'application/pdf',
      base64Data: pdfBase64
    }
  ];

  // 3. Adjuntar albaranes y documentos del proyecto (si existen)
  if (project.attachments && project.attachments.length > 0) {
    project.attachments.forEach((att, index) => {
      if (att.data) {
        const cleanB64 = cleanBase64Data(att.data);
        const name = att.name || `Albaran_${project.id}_${index + 1}.${att.type?.includes('pdf') ? 'pdf' : 'jpg'}`;
        attachments.push({
          filename: name,
          contentType: att.type || (name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          base64Data: cleanB64
        });
      }
    });
  }

  // 4. Adjuntar tickets / albaranes asociados a partes de trabajo (si los técnicos subieron tickets/albaranes)
  reports.forEach(r => {
    if (r.tickets && r.tickets.length > 0) {
      r.tickets.forEach((ticket, tIdx) => {
        if (ticket.data) {
          const cleanB64 = cleanBase64Data(ticket.data);
          const tName = `Ticket_Albaran_${r.date}_${(r.technician || 'tecnico').replace(/\s+/g, '_')}_${tIdx + 1}.jpg`;
          attachments.push({
            filename: tName,
            contentType: 'image/jpeg',
            base64Data: cleanB64
          });
        }
      });
    }
  });

  // 5. Calcular totales para el cuerpo del correo
  let totalWorkedHours = 0;
  let totalOvertimeHours = 0;
  let totalExpenses = 0;
  reports.forEach(r => {
    totalWorkedHours += calculateDuration(r.startTime, r.endTime);
    totalOvertimeHours += Number(r.overtimeHours || 0);
    totalExpenses += (Number(r.expenses?.food || 0) + Number(r.expenses?.gas || 0) + Number(r.expenses?.parking || 0) + Number(r.expenses?.others || 0));
  });

  // 6. Construir el HTML del correo
  const subject = `[OBRA TERMINADA] ${project.id} - ${project.name} (${project.client || 'Cliente'})`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; color: #1f2937; }
    .container { max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e5e7eb; }
    .header { background: linear-gradient(135deg, #00797b 0%, #005a5b 100%); color: #ffffff; padding: 28px 24px; text-align: left; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
    .badge { display: inline-block; background-color: #b0d12a; color: #111827; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 10px; }
    .content { padding: 24px; }
    .grid { display: table; width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .grid-row { display: table-row; }
    .grid-cell { display: table-cell; padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
    .grid-cell.label { font-weight: 600; color: #4b5563; width: 35%; background: #f9fafb; }
    .grid-cell.val { color: #111827; font-weight: 500; }
    .section-title { font-size: 14px; font-weight: 700; color: #00797b; margin: 20px 0 10px 0; border-bottom: 2px solid #00797b; padding-bottom: 4px; text-transform: uppercase; }
    .box { background-color: #f9fafb; border: 1px solid #e5e7eb; border-left: 4px solid #00797b; padding: 14px; border-radius: 6px; font-size: 13px; line-height: 1.5; color: #374151; margin-bottom: 16px; white-space: pre-wrap; }
    .stat-card { display: inline-block; width: 22%; margin: 1%; background: #f3f4f6; padding: 12px 8px; border-radius: 8px; text-align: center; vertical-align: top; box-sizing: border-box; }
    .stat-num { font-size: 16px; font-weight: 700; color: #00797b; margin-top: 4px; }
    .stat-lbl { font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 600; }
    .attachment-list { list-style: none; padding: 0; margin: 0; }
    .attachment-item { padding: 8px 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 6px; font-size: 12px; display: flex; align-items: center; }
    .footer { background: #f9fafb; padding: 16px 24px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">Obra Terminada</div>
      <h1>Notificación: ${project.id} - ${project.name}</h1>
      <p>Cliente: <strong>${project.client || '-'}</strong> | Técnico: <strong>${project.responsibleTech || 'Sin asignar'}</strong></p>
    </div>

    <div class="content">
      <p style="font-size: 14px; margin-top: 0;">Se ha marcado oficialmente como <strong>TERMINADA</strong> la siguiente obra en el sistema de gestión JDG Teleco:</p>

      <div class="grid">
        <div class="grid-row"><div class="grid-cell label">ID Obra</div><div class="grid-cell val"><strong>${project.id}</strong></div></div>
        <div class="grid-row"><div class="grid-cell label">Nombre de Obra</div><div class="grid-cell val">${project.name}</div></div>
        <div class="grid-row"><div class="grid-cell label">Cliente</div><div class="grid-cell val">${project.client || '-'}</div></div>
        <div class="grid-row"><div class="grid-cell label">Técnico Responsable</div><div class="grid-cell val">${project.responsibleTech || 'Sin asignar'}</div></div>
        <div class="grid-row"><div class="grid-cell label">Valoración</div><div class="grid-cell val">${project.valuation || 'POR HORAS'}</div></div>
        <div class="grid-row"><div class="grid-cell label">Nº Presupuesto</div><div class="grid-cell val">${project.budgetNum || '-'}</div></div>
        <div class="grid-row"><div class="grid-cell label">Fecha de Inicio</div><div class="grid-cell val">${formatDateSpanish(project.startDate)}</div></div>
        <div class="grid-row"><div class="grid-cell label">Fecha de Cierre</div><div class="grid-cell val">${new Date().toLocaleDateString('es-ES')}</div></div>
        <div class="grid-row"><div class="grid-cell label">Estado Facturación</div><div class="grid-cell val">${project.isInvoiced ? `Facturada (Nº ${project.invoiceNum || '-'})` : 'Pendiente de facturación'}</div></div>
        ${project.location ? `<div class="grid-row"><div class="grid-cell label">Ubicación</div><div class="grid-cell val">${project.location}</div></div>` : ''}
      </div>

      ${project.notes && project.notes.trim() ? `
        <div class="section-title">Observaciones / Texto de la Obra</div>
        <div class="box">${project.notes}</div>
      ` : ''}

      ${additionalNotes && additionalNotes.trim() ? `
        <div class="section-title">Comentarios de Finalización</div>
        <div class="box">${additionalNotes}</div>
      ` : ''}

      <div class="section-title">Resumen de Partes Realizados</div>
      <div style="margin-bottom: 20px;">
        <div class="stat-card"><div class="stat-lbl">Partes</div><div class="stat-num">${reports.length}</div></div>
        <div class="stat-card"><div class="stat-lbl">H. Regulares</div><div class="stat-num">${totalWorkedHours.toFixed(1)} h</div></div>
        <div class="stat-card"><div class="stat-lbl">H. Extra</div><div class="stat-num">${totalOvertimeHours.toFixed(1)} h</div></div>
        <div class="stat-card"><div class="stat-lbl">Dietas/Gastos</div><div class="stat-num">${totalExpenses.toFixed(2)} €</div></div>
      </div>

      <div class="section-title">Documentos y Albaranes Adjuntos (${attachments.length})</div>
      <ul class="attachment-list">
        ${attachments.map(att => `
          <li class="attachment-item">
            📎 <strong>${att.filename}</strong> &nbsp;<span style="color:#6b7280; font-size:11px;">(${att.contentType})</span>
          </li>
        `).join('')}
      </ul>

      <p style="font-size: 12px; color: #4b5563; margin-top: 20px;">
        En el archivo adjunto <strong>${pdfFilename}</strong> se encuentra el informe completo con el desglose cronológico de cada parte, horario, vehículos y materiales empleados.
      </p>
    </div>

    <div class="footer">
      JDG Telecomunicaciones · Sistema de Control de Obras y Partes Diarios<br/>
      Este mensaje ha sido generado automáticamente al marcar la obra como terminada.
    </div>
  </div>
</body>
</html>
  `;

  // 7. Ensamblar mensaje MIME RFC 2822
  const boundary = `====boundary_${Date.now()}_${Math.random().toString(36).substring(2)}====`;

  let mime = '';
  mime += `To: ${recipientEmail}\r\n`;
  mime += `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=\r\n`;
  mime += `MIME-Version: 1.0\r\n`;
  mime += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

  // Parte HTML
  mime += `--${boundary}\r\n`;
  mime += `Content-Type: text/html; charset=UTF-8\r\n`;
  mime += `Content-Transfer-Encoding: base64\r\n\r\n`;
  mime += `${btoa(unescape(encodeURIComponent(htmlBody)))}\r\n\r\n`;

  // Archivos adjuntos
  for (const att of attachments) {
    mime += `--${boundary}\r\n`;
    mime += `Content-Type: ${att.contentType || 'application/octet-stream'}; name="${att.filename}"\r\n`;
    mime += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
    mime += `Content-Transfer-Encoding: base64\r\n\r\n`;
    mime += `${att.base64Data}\r\n\r\n`;
  }

  mime += `--${boundary}--\r\n`;

  // 8. Convertir a base64url compatible con Gmail API
  const base64Url = btoa(mime).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  // 9. Realizar la llamada a Gmail API
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: base64Url })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const errMsg = errData.error?.message || `Error del servidor de Gmail (${res.status})`;
    const customErr: any = new Error(errMsg);
    customErr.status = res.status;
    customErr.isScopeError = res.status === 403 || errMsg.includes('insufficient') || errMsg.includes('scope');
    throw customErr;
  }

  const data = await res.json();
  return { success: true, messageId: data.id };
}
