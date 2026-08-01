export type PrintJobStatus =
  | 'queued'
  | 'printing'
  | 'sent_to_printer'
  | 'sent_to_printer_with_warning'
  | 'failed'
  | 'unknown';

export type PrinterProfile = 'thermal_escpos' | 'system_pdf';
export type SystemPaperSize = 'A4' | 'LETTER';

export interface PrintTicketTrackingInfo {
  url: string;
  status: string;
  statusLabelEs: string;
}

export interface PrintDocumentSummary {
  createdAt?: string;
  status: string;
  statusLabelEs: string;
  priority: string;
  priorityLabelEs: string;
  customerName?: string;
  technicianName?: string;
  deviceType: string;
  deviceBrand: string;
  deviceModel?: string;
  serialNumber?: string;
  problemDescription: string;
  diagnosis?: string;
  workDone?: string;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  estimatedDelivery?: string;
  deliveredAt?: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface PrintTicketResult {
  type: 'service_order_ticket';
  jobId: string;
  printerId: string;
  printerProfile: PrinterProfile;
  paperSize?: SystemPaperSize;
  orderId: string;
  orderNumber: string;
  mimeType: 'text/plain';
  content: string;
  width: number;
  paperWidthMm: number;
  generatedAt: string;
  tracking: PrintTicketTrackingInfo;
  summary: PrintDocumentSummary;
}

export interface PrintTicketAcknowledgement {
  accepted: boolean;
  jobId: string;
  message?: string;
}

export interface PrintDispatchResult {
  jobId: string;
  printerId: string;
  printerProfile: PrinterProfile;
  orderId: string;
  orderNumber: string;
  status: PrintJobStatus;
  queuedAt: string;
}

export interface PrintJobResult extends PrintDispatchResult {
  startedAt?: string;
  completedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  warnings?: string[];
}
