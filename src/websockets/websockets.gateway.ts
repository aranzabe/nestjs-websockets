import { WebSocketGateway, WebSocketServer, ConnectedSocket, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // Permitimos todos los dominios
    methods: ['GET', 'POST'],
  },
})
@Injectable()
export class WebsocketsGateway {
  @WebSocketServer()
  io: Server;

  private logger = new Logger('WebsocketsGateway');

  // ----------------- Conexión / Desconexión -----------------
  handleConnection(client: Socket) {
    this.logger.verbose(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.error(`Cliente desconectado: ${client.id}`);
  }

  // ----------------- Mensaje general -----------------
  @SubscribeMessage('enviar-mensaje')
  handleMensajeGeneral(@MessageBody() payload: any, @ConnectedSocket() client: Socket) {
    client.broadcast.emit('recibir-mensaje', payload);
    return { msg: 'Mensaje recibido', id: payload.id, fecha: Date.now() };
  }

  // ----------------- Mensaje privado -----------------
  @SubscribeMessage('mensaje-privado')
  handleMensajePrivado(
    @MessageBody() data: { destinatarioId: string; mensaje: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { destinatarioId, mensaje } = data;
    client.to(destinatarioId).emit('recibir-mensaje', {
      de: client.id,
      mensaje,
      fecha: Date.now(),
      privado: true,
      toId: destinatarioId,
    });
  }

  // ----------------- Solicitar lista de clientes -----------------
  @SubscribeMessage('solicitar-clientes')
  async handleSolicitarClientes(@ConnectedSocket() client: Socket) {
    const sockets = await this.io.fetchSockets();
    const clientes = sockets.map(s => s.id);
    return clientes;
  }

  // ----------------- Unirse a sala -----------------
  @SubscribeMessage('unirse-sala')
  handleUnirseSala(@MessageBody() nombreSala: string, @ConnectedSocket() client: Socket) {
    client.join(nombreSala);
    return `Te has unido a la sala ${nombreSala}`;
  }

  // ----------------- Mensaje a sala -----------------
  @SubscribeMessage('mensaje-sala')
  handleMensajeSala(@MessageBody() data: { sala: string; mensaje: string }, @ConnectedSocket() client: Socket) {
    const { sala, mensaje } = data;
    this.io.to(sala).emit('recibir-mensaje', {
      de: client.id,
      mensaje,
      fecha: Date.now(),
      sala,
    });
  }

  // ----------------- Cambiar sala -----------------
  @SubscribeMessage('cambiar-sala')
  handleCambiarSala(
    @MessageBody() data: { salaAnterior?: string; salaNueva: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { salaAnterior, salaNueva } = data;

    if (salaAnterior) {
      client.leave(salaAnterior);
      this.logger.debug(`Socket ${client.id} salió de ${salaAnterior}`);
    }

    client.join(salaNueva);
    this.logger.debug(`Socket ${client.id} se unió a ${salaNueva}`);

    return `Ahora estás en la sala ${salaNueva}`;
  }
}
