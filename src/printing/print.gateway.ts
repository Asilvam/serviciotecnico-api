import { WebSocketGateway, WebSocketServer, OnGatewayConnection, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class PrintGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private logger = new Logger('PrintGateway');

  private readonly AUTH_TOKEN = process.env.PRINT_TOKEN || 'tu_token_seguro';

  handleConnection(client: Socket) {
    const token = (client.handshake.auth as { token?: string } | undefined)?.token;

    if (token !== this.AUTH_TOKEN) {
      this.logger.warn(`[AUTH] Connection rejected: ${client.id}`);
      client.disconnect();
      return;
    }
    this.logger.log(`[AUTH] Print agent connected: ${client.id}`);
  }

  @SubscribeMessage('print_success')
  handlePrintSuccess(@MessageBody() data: { orderId: string }) {
    this.logger.log(`[PRINT] Order ${data.orderId} printed successfully on local agent.`);
  }

  sendToPrinter(payload: any) {
    this.server.emit('print_ticket', payload);
  }
}
