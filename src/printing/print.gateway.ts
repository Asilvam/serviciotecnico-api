import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import type {
  PrintTicketAcknowledgement,
  PrintTicketResult,
} from './interfaces/print-ticket-result.interface';
import { PrintJobsService } from './print-jobs.service';

type RegisteredAgent = {
  socketId: string;
  agentId: string;
  printerId: string;
};

type PrintStartedPayload = {
  jobId: string;
  printerId: string;
};

type PrintSentPayload = PrintStartedPayload & {
  sentAt?: string;
  warnings?: string[];
};

type PrintErrorPayload = PrintStartedPayload & {
  code?: string;
  message?: string;
  outcomeUncertain?: boolean;
};

export class PrintDispatchException extends ServiceUnavailableException {
  constructor(
    message: string,
    readonly outcomeUncertain: boolean,
  ) {
    super(message);
  }
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class PrintGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(PrintGateway.name);
  private readonly agentsByPrinter = new Map<string, RegisteredAgent>();
  private readonly agentsBySocket = new Map<string, RegisteredAgent>();

  constructor(
    private readonly configService: ConfigService,
    private readonly printJobsService: PrintJobsService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const auth = client.handshake.auth as
      { token?: string; agentId?: string; printerId?: string } | undefined;
    const expectedToken = this.configService.getOrThrow<string>('PRINT_TOKEN');
    const token = auth?.token?.trim();
    const agentId = auth?.agentId?.trim();
    const printerId = auth?.printerId?.trim();

    if (
      !expectedToken ||
      !token ||
      token !== expectedToken ||
      !agentId ||
      !printerId
    ) {
      this.logger.warn(`agent.connection_rejected socketId=${client.id}`);
      client.disconnect(true);
      return;
    }

    const previous = this.agentsByPrinter.get(printerId);
    if (previous && previous.socketId !== client.id) {
      this.logger.warn(
        `agent.replaced printerId=${printerId} oldAgentId=${previous.agentId} newAgentId=${agentId}`,
      );
      await this.printJobsService.markActiveUnknownByPrinter(
        printerId,
        'AGENT_REPLACED',
        'El agente fue reemplazado mientras tenia trabajos pendientes.',
      );
      this.server.sockets.sockets.get(previous.socketId)?.disconnect(true);
    }

    const registration = { socketId: client.id, agentId, printerId };
    this.agentsByPrinter.set(printerId, registration);
    this.agentsBySocket.set(client.id, registration);
    this.logger.log(
      `agent.connected agentId=${agentId} printerId=${printerId} socketId=${client.id}`,
    );
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const registration = this.agentsBySocket.get(client.id);
    if (!registration) {
      return;
    }
    this.agentsBySocket.delete(client.id);
    const active = this.agentsByPrinter.get(registration.printerId);
    const wasActiveAgent = active?.socketId === client.id;
    if (wasActiveAgent) {
      this.agentsByPrinter.delete(registration.printerId);
      await this.printJobsService.markActiveUnknownByPrinter(
        registration.printerId,
      );
    }
    this.logger.warn(
      `agent.disconnected agentId=${registration.agentId} printerId=${registration.printerId}`,
    );
  }

  isPrinterConnected(printerId: string): boolean {
    const registration = this.agentsByPrinter.get(printerId);
    if (!registration) {
      return false;
    }
    return Boolean(this.server.sockets.sockets.get(registration.socketId));
  }

  async dispatchToPrinter(
    printerId: string,
    payload: PrintTicketResult,
  ): Promise<PrintTicketAcknowledgement> {
    const registration = this.agentsByPrinter.get(printerId);
    const socket = registration
      ? this.server.sockets.sockets.get(registration.socketId)
      : undefined;
    if (!registration || !socket) {
      throw new PrintDispatchException(
        'El agente de impresion no esta conectado.',
        false,
      );
    }

    const timeoutMs = this.configService.get<number>(
      'PRINT_ACK_TIMEOUT_MS',
      5000,
    );
    return new Promise((resolve, reject) => {
      socket
        .timeout(timeoutMs)
        .emit(
          'print_ticket',
          payload,
          (
            error: Error | null,
            acknowledgement?: PrintTicketAcknowledgement,
          ) => {
            if (error) {
              reject(
                new PrintDispatchException(
                  'El agente de impresion no confirmo la recepcion.',
                  true,
                ),
              );
              return;
            }
            if (
              !acknowledgement?.accepted ||
              acknowledgement.jobId !== payload.jobId
            ) {
              reject(
                new PrintDispatchException(
                  acknowledgement?.message ??
                    'El agente rechazo el trabajo de impresion.',
                  false,
                ),
              );
              return;
            }
            resolve(acknowledgement);
          },
        );
    });
  }

  @SubscribeMessage('print_started')
  async handlePrintStarted(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PrintStartedPayload,
  ): Promise<void> {
    const agent = this.getAuthorizedAgent(client, data);
    if (!agent) {
      return;
    }
    await this.printJobsService.markPrinting(data.jobId, agent.printerId);
  }

  @SubscribeMessage('print_sent')
  async handlePrintSent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PrintSentPayload,
  ): Promise<void> {
    const agent = this.getAuthorizedAgent(client, data);
    if (!agent) {
      return;
    }
    await this.printJobsService.markSentToPrinter(
      data.jobId,
      agent.printerId,
      data.warnings,
    );
    this.logger.log(
      `print.sent_to_printer jobId=${data.jobId} printerId=${agent.printerId}`,
    );
  }

  @SubscribeMessage('print_error')
  async handlePrintError(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PrintErrorPayload,
  ): Promise<void> {
    const agent = this.getAuthorizedAgent(client, data);
    if (!agent) {
      return;
    }
    const code = data.code ?? 'PRINT_FAILED';
    const message =
      data.message ?? 'La impresora no pudo completar el trabajo.';
    if (data.outcomeUncertain) {
      await this.printJobsService.markUnknown(
        data.jobId,
        agent.printerId,
        code,
        message,
      );
    } else {
      await this.printJobsService.markFailed(
        data.jobId,
        agent.printerId,
        code,
        message,
      );
    }
    this.logger.error(
      `print.${data.outcomeUncertain ? 'unknown' : 'failed'} jobId=${data.jobId} printerId=${agent.printerId} code=${code}`,
    );
  }

  private getAuthorizedAgent(
    client: Socket,
    data: PrintStartedPayload,
  ): RegisteredAgent | undefined {
    const agent = this.agentsBySocket.get(client.id);
    if (!agent || agent.printerId !== data.printerId || !data.jobId) {
      this.logger.warn(`agent.event_rejected socketId=${client.id}`);
      return undefined;
    }
    return agent;
  }
}
