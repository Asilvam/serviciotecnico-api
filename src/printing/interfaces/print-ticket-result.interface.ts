export interface PrintTicketResult {
  orderId: string;
  orderNumber: string;
  mimeType: 'text/plain';
  content: string;
  width: number;
  paperWidthMm: number;
  generatedAt: string;
}
