import { ConfigService } from '@nestjs/config';
import type { Server, Socket } from 'socket.io';
import { PrintGateway } from './print.gateway';
import { PrintJobsService } from './print-jobs.service';
import type { PrintTicketResult } from './interfaces/print-ticket-result.interface';

function createSocket(
  id: string,
  printerId: string,
  token = 'secure-print-token',
) {
  const emit = jest.fn(
    (
      _event: string,
      payload: PrintTicketResult,
      callback: (
        error: Error | null,
        response: { accepted: boolean; jobId: string },
      ) => void,
    ) => {
      callback(null, { accepted: true, jobId: payload.jobId });
    },
  );
  const timeout = jest.fn().mockReturnValue({ emit });
  const disconnect = jest.fn();
  const socket = {
    id,
    handshake: {
      auth: {
        token,
        agentId: `agent-${id}`,
        printerId,
      },
    },
    timeout,
    disconnect,
  } as unknown as Socket;
  return { socket, emit, disconnect };
}

const ticket: PrintTicketResult = {
  type: 'service_order_ticket',
  jobId: 'job-1',
  printerId: 'reception-80mm',
  printerProfile: 'thermal_escpos',
  orderId: '67d0f4a5f99f719467f91a07',
  orderNumber: 'OT-0001',
  mimeType: 'text/plain',
  content: 'Ticket',
  width: 40,
  paperWidthMm: 80,
  generatedAt: new Date().toISOString(),
  tracking: {
    url: 'https://st.example.com/tracking/token',
    status: 'pending',
    statusLabelEs: 'PENDIENTE',
  },
  summary: {
    status: 'pending',
    statusLabelEs: 'PENDIENTE',
    priority: 'medium',
    priorityLabelEs: 'MEDIA',
    deviceType: 'Notebook',
    deviceBrand: 'Lenovo',
    problemDescription: 'No enciende',
    laborCost: 0,
    partsCost: 0,
    totalCost: 0,
    items: [],
  },
};

describe('PrintGateway', () => {
  function createGateway() {
    const sockets = new Map<string, Socket>();
    const gateway = new PrintGateway(
      new ConfigService({
        PRINT_TOKEN: 'secure-print-token',
        PRINT_ACK_TIMEOUT_MS: 100,
      }),
      {
        markPrinting: jest.fn().mockResolvedValue(undefined),
        markSentToPrinter: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
        markUnknown: jest.fn().mockResolvedValue(undefined),
        markActiveUnknownByPrinter: jest.fn().mockResolvedValue(undefined),
      } as unknown as PrintJobsService,
    );
    gateway.server = {
      sockets: { sockets },
    } as unknown as Server;
    return { gateway, sockets };
  }

  it('dispatches only to the agent registered for the requested printer', async () => {
    const { gateway, sockets } = createGateway();
    const reception = createSocket('socket-1', 'reception-80mm');
    const workshop = createSocket('socket-2', 'workshop-80mm');
    sockets.set('socket-1', reception.socket);
    sockets.set('socket-2', workshop.socket);
    await gateway.handleConnection(reception.socket);
    await gateway.handleConnection(workshop.socket);

    await expect(
      gateway.dispatchToPrinter('reception-80mm', ticket),
    ).resolves.toEqual({ accepted: true, jobId: ticket.jobId });
    expect(reception.emit).toHaveBeenCalledTimes(1);
    expect(workshop.emit).not.toHaveBeenCalled();
  });

  it('replaces the previous agent for the same printer', async () => {
    const { gateway, sockets } = createGateway();
    const previous = createSocket('socket-1', 'reception-80mm');
    const current = createSocket('socket-2', 'reception-80mm');
    sockets.set('socket-1', previous.socket);
    sockets.set('socket-2', current.socket);
    await gateway.handleConnection(previous.socket);
    await gateway.handleConnection(current.socket);
    await gateway.handleDisconnect(previous.socket);

    expect(previous.disconnect).toHaveBeenCalledWith(true);
    expect(gateway.isPrinterConnected('reception-80mm')).toBe(true);
  });

  it('rejects agents with an invalid token', async () => {
    const { gateway, sockets } = createGateway();
    const unauthorized = createSocket(
      'socket-1',
      'reception-80mm',
      'wrong-token',
    );
    sockets.set('socket-1', unauthorized.socket);

    await gateway.handleConnection(unauthorized.socket);

    expect(unauthorized.disconnect).toHaveBeenCalledWith(true);
    expect(gateway.isPrinterConnected('reception-80mm')).toBe(false);
  });
});
