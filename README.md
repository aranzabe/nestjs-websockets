
# 📝 Servicio de WebSockets en NestJS con Socket.IO

## 1️⃣ Crear proyecto NestJS

Si no lo tienes aún:

```bash
yarn add -g @nestjs/cli
nest new proyecto-websocket
cd proyecto-websocket
```
O usando el script de Sergio que funciona chupiguay.

Esto crea la estructura básica de NestJS.

---

## 2️⃣ Instalar dependencias necesarias

Para usar **Socket.IO con NestJS**:

```bash
# Adapter de NestJS para Socket.IO
yarn add @nestjs/platform-socket.io

# Socket.IO (server)
yarn add socket.io

# Tipos de Socket.IO para TypeScript
yarn add -D @types/socket.io

# NestJS WebSockets
yarn add @nestjs/websockets
```

💡 **Nota**: `@nestjs/websockets` depende del adaptador `@nestjs/platform-socket.io`. El adaptador permite que NestJS trabaje con Socket.IO de manera “oficial”.

Seguimos usando **socket.io** porque permite:

- rooms
- broadcast
- reconexión automática

| Paquete                      | Propósito                                         |
| ---------------------------- | ------------------------------------------------- |
| `@nestjs/platform-socket.io` | Adapter de NestJS para usar Socket.IO             |
| `socket.io`                  | Servidor real de Socket.IO                        |
| `@types/socket.io`           | Tipos para TypeScript (si tu versión no los trae) |

---

## 3️⃣ Generar un recurso para los WebSockets (opcional)

```bash
nest g res websockets
```

Esto crea:

* `websockets.gateway.ts` → el Gateway para manejar eventos.
* `websockets.service.ts` → para lógica opcional de negocio.
* `websockets.module.ts` → módulo para importar en `AppModule`.

💡 Por defecto NestJS genera un **CRUD virtual** con `@SubscribeMessage` para “crear”, “listar”, “actualizar”, etc. Esto no es necesario para un chat real, pero puedes mantener el service para almacenar mensajes en DB si quieres.

---

## 4️⃣ Crear el Gateway con Socket.IO

```ts
import { WebSocketGateway, WebSocketServer, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // Permitir todos los dominios
    methods: ['GET','POST'],
  }
})
@Injectable()
export class WebsocketsGateway {
  @WebSocketServer()
  io: Server; // El servidor Socket.IO

  private logger = new Logger('WebsocketsGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  // ----------------- Mensaje general -----------------
  @SubscribeMessage('enviar-mensaje')
  handleMensajeGeneral(@MessageBody() payload: any, @ConnectedSocket() client: Socket) {
    client.broadcast.emit('recibir-mensaje', payload);
    return { msg: 'Mensaje recibido', id: payload.id, fecha: Date.now() };
  }

  // ----------------- Mensaje privado -----------------
  @SubscribeMessage('mensaje-privado')
  handleMensajePrivado(@MessageBody() data: { destinatarioId: string; mensaje: string }, @ConnectedSocket() client: Socket) {
    client.to(data.destinatarioId).emit('recibir-mensaje', {
      de: client.id,
      mensaje: data.mensaje,
      fecha: Date.now(),
      privado: true,
      toId: data.destinatarioId
    });
  }

  // ----------------- Solicitar clientes -----------------
  @SubscribeMessage('solicitar-clientes')
  async handleSolicitarClientes(@ConnectedSocket() client: Socket) {
    const sockets = await this.io.fetchSockets();
    return sockets.map(s => s.id);
  }

  // ----------------- Salas -----------------
  @SubscribeMessage('unirse-sala')
  handleUnirseSala(@MessageBody() sala: string, @ConnectedSocket() client: Socket) {
    client.join(sala);
    return `Te has unido a la sala ${sala}`;
  }

  @SubscribeMessage('mensaje-sala')
  handleMensajeSala(@MessageBody() data: { sala: string; mensaje: string }, @ConnectedSocket() client: Socket) {
    this.io.to(data.sala).emit('recibir-mensaje', {
      de: client.id,
      mensaje: data.mensaje,
      fecha: Date.now(),
      sala: data.sala
    });
  }

  @SubscribeMessage('cambiar-sala')
  handleCambiarSala(@MessageBody() data: { salaAnterior?: string; salaNueva: string }, @ConnectedSocket() client: Socket) {
    if (data.salaAnterior) client.leave(data.salaAnterior);
    client.join(data.salaNueva);
    return `Ahora estás en la sala ${data.salaNueva}`;
  }
}
```

**Explicación**:

* `@WebSocketServer()` → acceso al server completo de Socket.IO (`io`).
* `@ConnectedSocket()` → socket individual que envió el evento (`client`).
* `@SubscribeMessage('evento')` → decorador que “escucha” eventos del cliente.
* `broadcast.emit`, `to().emit`, `join()`, `leave()` → funcionan exactamente igual que en Node.js puro.

---

## 5️⃣ Crear módulo y service (opcional)

```ts
import { Module } from '@nestjs/common';
import { WebsocketsGateway } from './websockets.gateway';
import { WebsocketsService } from './websockets.service';

@Module({
  providers: [WebsocketsGateway, WebsocketsService],
})
export class WebsocketsModule {}
```

`WebsocketsService` sirve si quieres guardar mensajes en base de datos o lógica adicional.


---
En el ejemplo hemos hecho persistencia con Mongo / mongoose. Para la configuración del proyecto para Mongo ver el ejemplo correspondiente.

En nuestro caso tendremos **websocket.service.ts**:
```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Message, MessageDocument } from './schemas/message.schema';

@Injectable()
export class WebsocketsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  // ----------------- Usuarios -----------------
  async addUser(socketId: string, name: string) {
    let user = await this.userModel.findOne({ socketId });
    if (!user) {
      user = new this.userModel({ socketId, name, connected: true });
    } else {
      user.connected = true;
    }
    return user.save();
  }

  async removeUser(socketId: string) {
    const user = await this.userModel.findOne({ socketId });
    if (user) {
      user.connected = false;
      await user.save();
    }
    return user;
  }

  async getConnectedUsers() {
    return this.userModel.find({ connected: true }).exec();
  }

  // ----------------- Mensajes -----------------
  async saveMessage(fromId: string, content: string, toId?: string, room?: string) {
    const message = new this.messageModel({ fromId, toId, content, room });
    return message.save();
  }

  async getMessagesByRoom(room: string) {
    return this.messageModel.find({ room }).sort({ createdAt: 1 }).exec();
  }

  async getPrivateMessages(userA: string, userB: string) {
    return this.messageModel
      .find({
        $or: [
          { fromId: userA, toId: userB },
          { fromId: userB, toId: userA },
        ],
      })
      .sort({ createdAt: 1 })
      .exec();
  }
}
```
Con los métodos de persistencia que serán llamados desde **websocket.gateway.ts**., por ejemplo:

```typescript
  // ----------------- Conexión / Desconexión -----------------
  handleConnection(client: Socket) {
    this.logger.verbose(`Cliente conectado: ${client.id}`);
    this.websocketsService.addUser(client.id, 'NombreUsuario');   //<-- Aquí usaríamos el servicio de websockets para la persisatencia.
  }

  handleDisconnect(client: Socket) {
    this.logger.error(`Cliente desconectado: ${client.id}`);
    this.websocketsService.removeUser(client.id); //<-- Aquí usaríamos el servicio de websockets para la persisatencia.
  }

```

## 6️⃣ Importar módulo en `app.module.ts`

```ts
import { Module } from '@nestjs/common';
import { WebsocketsModule } from './websockets/websockets.module';

@Module({
  imports: [WebsocketsModule],
})
export class AppModule {}
```



---

## 7️⃣ Cliente (TypeScript o JS)

* Puedes usar **el cliente que teníamos en TS**, funciona sin cambios.
* Conexión al servidor:

```ts
import { io } from "socket.io-client";

const socket = io("http://localhost:8090");

socket.on("connect", () => console.log(socket.id));
socket.emit("enviar-mensaje", { mensaje: "Hola", id: socket.id, fecha: Date.now() });
```

* Funciona con:

  * Mensajes generales → `enviar-mensaje`
  * Mensajes privados → `mensaje-privado`
  * Salas → `unirse-sala`, `cambiar-sala`, `mensaje-sala`
  * Lista de clientes → `solicitar-clientes`

---

## 8️⃣ Ejecutar servidor NestJS

```bash
yarn start:dev
```

* Servidor escucha en `http://localhost:3000` por defecto (ajusta puerto si quieres).
* Socket.IO escucha en el mismo puerto gracias a `@WebSocketServer()`.

---

### ✅ Resumen de dependencias

```bash
yarn add @nestjs/websockets
yarn add @nestjs/platform-socket.io
yarn add socket.io
yarn add -D @types/socket.io
```

* `@nestjs/websockets` → decoradores y estructura para gateways.
* `@nestjs/platform-socket.io` → adaptador de NestJS para Socket.IO.
* `socket.io` → servidor real de WebSockets.
* `@types/socket.io` → tipos para TypeScript.



---

# 📊 Diagrama de flujo de mensajes

```
             ┌────────────┐
             │  Cliente A │
             └─────┬──────┘
                   │ enviar-mensaje (general)
                   │
                   ▼
             ┌────────────┐
             │ Gateway    │
             │ NestJS +   │
             │ Socket.IO  │
             └─────┬──────┘
  broadcast.emit │ │ io.to(sala).emit │ client.to(id).emit
                 │ │                  │
                 │ │                  │
   ┌─────────────▼─▼─────────────┐
   │       Otros clientes        │
   │ Cliente B │ Cliente C │ ... │
   └─────────────────────────────┘
```

---

### 🔹 Flujo por tipo de mensaje

1. **Mensaje general (broadcast)**

   * Cliente A emite: `socket.emit('enviar-mensaje', payload)`
   * Gateway recibe con `@SubscribeMessage('enviar-mensaje')`
   * Gateway hace `client.broadcast.emit('recibir-mensaje', payload)`
   * Todos los demás clientes reciben `recibir-mensaje`.
   * **Cliente remitente no recibe su propio mensaje**.

---

2. **Mensaje privado**

```
Cliente A --mensaje-privado--> Gateway --to(destinatarioId)--> Cliente B
```

* Cliente A emite: `socket.emit('mensaje-privado', { destinatarioId, mensaje })`
* Gateway recibe y hace: `client.to(destinatarioId).emit('recibir-mensaje', { ... })`
* Solo el destinatario recibe el mensaje.
* El cliente que envía puede incluir callback para confirmación si quiere.

---

3. **Mensajes a sala**

```
Cliente A --mensaje-sala--> Gateway --io.to(sala).emit--> Todos en la sala
```

* Cliente se une a sala: `socket.emit('cambiar-sala', { salaAnterior, salaNueva })`
* Gateway hace `client.leave(salaAnterior)` + `client.join(salaNueva)`
* Enviar mensaje a sala: `socket.emit('mensaje-sala', { sala, mensaje })`
* Gateway hace `io.to(sala).emit('recibir-mensaje', payload)`
* Todos los sockets en esa sala reciben el mensaje (incluido quien lo envía).

---

4. **Solicitar lista de clientes**

```
Cliente A --solicitar-clientes--> Gateway --> io.fetchSockets() --> Cliente A
```

* Cliente A pide la lista de clientes conectados.
* Gateway usa `const sockets = await io.fetchSockets()` y devuelve array de IDs.
* Cliente A actualiza su `<select>` con los IDs de los otros clientes.

---

### 🔹 Resumen de funciones del Gateway

| Evento               | Acción Gateway       | Recibe/Envía a        |
| -------------------- | -------------------- | --------------------- |
| `enviar-mensaje`     | `broadcast.emit`     | Todos menos remitente |
| `mensaje-privado`    | `client.to(id).emit` | Solo destinatario     |
| `solicitar-clientes` | `io.fetchSockets()`  | Cliente que pide      |
| `unirse-sala`        | `client.join(sala)`  | Cliente               |
| `mensaje-sala`       | `io.to(sala).emit`   | Todos en sala         |
| `cambiar-sala`       | `leave()` + `join()` | Cliente               |

---

---

# 📝 Cliente TypeScript para Socket.IO

## 1️⃣ Estructura del cliente

* **Variables principales**

```ts
let clientId = "";       // ID único del cliente
let salaActual = "Aldeanos"; // Sala activa del cliente
```

* **Referencias a DOM**

```ts
const lblOn = document.querySelector("#lblOn") as HTMLElement;
const lblOff = document.querySelector("#lblOff") as HTMLElement;
const clientIdSpan = document.querySelector("#clientId") as HTMLElement;
const ulMessages = document.querySelector("#messages") as HTMLUListElement;
const selectSalas = document.querySelector("#selectSalas") as HTMLSelectElement;
const txtMensajeSala = document.querySelector("#txtMensajeSala") as HTMLInputElement;
const btnEnviarSala = document.querySelector("#btnEnviarSala") as HTMLButtonElement;

const txtMensajeGeneral = document.querySelector("#txtMensajeGeneral") as HTMLInputElement;
const btnEnviarGeneral = document.querySelector("#btnEnviarGeneral") as HTMLButtonElement;

const selectClientes = document.querySelector("#selectClientes") as HTMLSelectElement;
const txtMensajePrivado = document.querySelector("#txtMensajePrivado") as HTMLInputElement;
const btnEnviarPrivado = document.querySelector("#btnEnviarPrivado") as HTMLButtonElement;
```

---

## 2️⃣ Conexión al servidor

```ts
import { io } from "socket.io-client";

const socket = io("http://localhost:3000"); // URL del servidor NestJS
```

* `socket.on("connect", ...)` → obtiene el `clientId` y muestra el estado de conexión en la UI.
* `socket.on("disconnect", ...)` → actualiza la UI cuando se pierde la conexión.

---

## 3️⃣ Eventos principales

### 🔹 Mensaje general

* Enviar:

```ts
btnEnviarGeneral.addEventListener("click", () => {
  socket.emit("enviar-mensaje", { mensaje, id: clientId, fecha: Date.now() }, callback);
});
```

* Recibir:

```ts
socket.on("recibir-mensaje", (payload) => {
  // Se muestra en la lista <ul> de mensajes
});
```

> Todos los clientes reciben el mensaje, excepto el que lo envió (`broadcast.emit` en el servidor).

---

### 🔹 Mensaje privado

* Enviar:

```ts
btnEnviarPrivado.addEventListener("click", () => {
  socket.emit("mensaje-privado", { destinatarioId, mensaje });
});
```

* Recibir:

```ts
socket.on("recibir-mensaje", payload => {
  if (payload.privado) { /* Se muestra con color diferente */ }
});
```

> Solo el destinatario recibe el mensaje (`client.to(id).emit` en el servidor).

---

### 🔹 Salas

* Cambiar de sala:

```ts
selectSalas.addEventListener("change", () => {
  socket.emit("cambiar-sala", { salaAnterior: salaActual, salaNueva: nuevaSala }, callback);
});
```

* Enviar mensaje a sala:

```ts
btnEnviarSala.addEventListener("click", () => {
  socket.emit("mensaje-sala", { sala: salaActual, mensaje });
});
```

> Todos los sockets dentro de la sala reciben el mensaje (`io.to(sala).emit`).

---

### 🔹 Lista de clientes conectados

```ts
function actualizarClientes() {
  socket.emit("solicitar-clientes", (clientes: string[]) => {
    // Se actualiza <select> de clientes
  });
}
setInterval(actualizarClientes, 5000);
```

* El cliente solicita cada 5 segundos la lista de sockets conectados usando `io.fetchSockets()` en el servidor.

---

## 4️⃣ Recepción de mensajes

* Los mensajes se diferencian según:

  * Generales → color por defecto
  * Sala → color según nombre de sala
  * Privados → azul si los envías, rojo si los recibes

* Se usan elementos `<li>` para mostrarlos en un `<ul>`:

```ts
const li = document.createElement("li");
li.textContent = "...";
li.style.color = "...";
ulMessages.appendChild(li);
```

---

## 5️⃣ Lanzamiento del cliente con TypeScript

El cliente está en `src/socket-client-ts`. Es un cliente independiente del proyecto de NestJS realizado en TS con Vite por lo que para probarlo en desarrollo:


```bash
cd socket-client-ts
npm run dev
```

---

### 6️⃣ Resumen del flujo cliente-servidor

```
Cliente A
  | enviar-mensaje
  | enviar-mensaje-privado
  | cambiar-sala / mensaje-sala
  v
Servidor NestJS Gateway (Socket.IO)
  | broadcast.emit / client.to(id).emit / io.to(sala).emit
  v
Clientes B, C, ... reciben mensajes
```

* Todo funciona en tiempo real.
* La lista de clientes se actualiza con `solicitar-clientes`.


---

# 📊 Diagrama completo Cliente ↔ Servidor ↔ Salas

```
         ┌──────────────┐
         │  Cliente A   │
         │  (cliente.ts)│
         └─────┬────────┘
               │ Conecta a Socket.IO
               │ io("http://localhost:3000")
               │
               ▼
       ┌───────────────────┐
       │  Gateway NestJS   │
       │  @WebSocketServer │
       │  Socket.IO        │
       └─────┬─────────────┘
  handleConnection │ handleDisconnect
                   │
                   ▼
  ┌───────────┐─────────────┐─────────────┐
  │ Broadcast │ Sala        │ Privado     │
  │ general   │ mensajes    │ mensajes    │
  └─────┬─────┘─────┬───────┘─────┬───────┘
        │           │             │
        ▼           ▼             ▼
 ┌───────────┐ ┌─────────────┐ ┌─────────────┐
 │ Cliente B │ │ Clientes en │ │ Cliente B   │
 │ Cliente C │ │ sala X      │ │ destinatario│
 └───────────┘ └─────────────┘ └─────────────┘
```

---

## 🔹 Flujo por tipo de mensaje

1. **Mensaje general**

```ts
socket.emit("enviar-mensaje", payload, callback)
```

* Todos los clientes reciben el mensaje excepto el que lo envía (`broadcast.emit`).
* Se muestra en `<ul>` del cliente.

2. **Mensaje privado**

```ts
socket.emit("mensaje-privado", { destinatarioId, mensaje })
```

* Solo el destinatario recibe el mensaje (`client.to(id).emit`).
* Los clientes ven color rojo/azul según si envían o reciben.

3. **Salas**

```ts
socket.emit("cambiar-sala", { salaAnterior, salaNueva })
socket.emit("mensaje-sala", { sala, mensaje })
```

* Cliente se une a una sala (`join`) y puede enviar mensajes a esa sala (`io.to(sala).emit`).
* Todos los miembros de la sala reciben el mensaje.

4. **Lista de clientes**

```ts
socket.emit("solicitar-clientes", callback)
```

* Devuelve todos los sockets conectados (`io.fetchSockets()`).
* Se actualiza el `<select>` de clientes en el cliente TS.

---

## 🔹 Roles y responsabilidades

| Componente       | Función principal                                     |
| ---------------- | ----------------------------------------------------- |
| Cliente TS       | Enviar/recibir mensajes, cambiar salas, actualizar UI |
| Gateway NestJS   | Recibir eventos, redirigir mensajes a otros clientes  |
| Socket.IO Server | Motor real de WebSockets                              |
| UI HTML/TS       | Mostrar mensajes, salas y lista de clientes           |

---

## 🔹 Cómo lanzar todo en desarrollo

1. **Servidor NestJS**

```bash
yarn start:dev
```

* Escucha por defecto en `http://localhost:3000`.

2. **Cliente TS**

```bash
npm run dev
```

* Se conecta automáticamente a `http://localhost:3000`.
* Actualiza mensajes y lista de clientes en tiempo real.

---

### 🔹 Claves para que funcione

1. `socket.io-client` en el cliente, `socket.io` en el servidor.
2. `@WebSocketServer()` en el Gateway para exponer `io`.
3. `@SubscribeMessage('evento')` para cada tipo de evento.
4. `client.broadcast.emit` → general, `client.to(id).emit` → privado, `io.to(sala).emit` → sala.
5. `io.fetchSockets()` → lista de clientes conectados.
6. Sala por cliente: `join()` / `leave()`.

---
