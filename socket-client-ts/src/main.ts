import { io } from "socket.io-client";

// Identificador único por cliente
let clientId = "";
console.log("ID del cliente:", clientId);
let salaActual = "Aldeanos"; // sala activa

// DOM
const lblOn = document.querySelector("#lblOn") as HTMLElement;
const lblOff = document.querySelector("#lblOff") as HTMLElement;
const clientIdSpan = document.querySelector("#clientId") as HTMLElement;
const ulMessages = document.querySelector("#messages") as HTMLUListElement;
const selectSalas = document.querySelector("#selectSalas") as HTMLSelectElement;
const txtMensajeSala = document.querySelector("#txtMensajeSala") as HTMLInputElement;
const btnEnviarSala = document.querySelector("#btnEnviarSala") as HTMLButtonElement;

// Mensajes generales
const txtMensajeGeneral = document.querySelector("#txtMensajeGeneral") as HTMLInputElement;
const btnEnviarGeneral = document.querySelector("#btnEnviarGeneral") as HTMLButtonElement;

// Mensajes privados
const selectClientes = document.querySelector("#selectClientes") as HTMLSelectElement;
const txtMensajePrivado = document.querySelector("#txtMensajePrivado") as HTMLInputElement;
const btnEnviarPrivado = document.querySelector("#btnEnviarPrivado") as HTMLButtonElement;



// Conexión al servidor
const socket = io("http://localhost:3000");

socket.on("connect", () => {
  clientId = socket.id!;
  // Mostrar ID en azul
  clientIdSpan.textContent = clientId;
  lblOff.style.display = "none";
  lblOn.style.display = "inline";
  actualizarClientes();
});

// socket.on("mensaje-bienvenida", (data) => {
//   console.log("Bienvenida del servidor:", data);
// });

socket.on("disconnect", () => {
  lblOff.style.display = "inline";
  lblOn.style.display = "none";
});

// -------- Enviar mensaje general ----------
btnEnviarGeneral.addEventListener("click", () => {
  const mensaje = txtMensajeGeneral.value;
  if (!mensaje) return;

  const payload = {
    mensaje,
    id: clientId,
    fecha: new Date().getTime(),
  };

  socket.emit("enviar-mensaje", payload, (confirmacion: any) => {
    console.log("Confirmación servidor:", confirmacion);
  });

  txtMensajeGeneral.value = "";
});

// -------- Enviar mensaje privado ----------
btnEnviarPrivado.addEventListener("click", () => {
  const mensaje = txtMensajePrivado.value;
  const destinatarioId = selectClientes.value;
  if (!mensaje || !destinatarioId) return;

  socket.emit("mensaje-privado", { destinatarioId, mensaje });
  txtMensajePrivado.value = "";
});



// --------------- Unirse a sala al cargar ---------------------
selectSalas.addEventListener("change", () => {
  const nuevaSala = selectSalas.value;

  socket.emit("cambiar-sala", { salaAnterior: salaActual, salaNueva: nuevaSala }, (msg: any) => {
    console.log(msg);
    salaActual = nuevaSala; // actualizar sala actual
  });
});

// -------------------- Enviar mensaje a sala -------------------
btnEnviarSala.addEventListener("click", () => {
  //const sala = selectSalas.value;
  const sala = salaActual;
  const mensaje = txtMensajeSala.value;
  if (!mensaje) return;

  socket.emit("mensaje-sala", { sala, mensaje });
  txtMensajeSala.value = "";
});

// ------------------- Recibir mensajes  -------------------
socket.on("recibir-mensaje", (payload: any) => {
  const fecha = new Date(payload.fecha).toLocaleDateString("es-ES");
  const li = document.createElement("li");

  if (payload.sala) {
    // Mensaje de sala
    li.textContent = `[${payload.sala.toUpperCase()}] ${fecha}: ${payload.mensaje}`;
    li.style.color = payload.sala === "Aldeanos" ? "blue" : "orange";
  } else if (payload.privado && payload.de === clientId) {
    li.textContent = `[PRIVADO a ${payload.toId}] ${fecha}: ${payload.mensaje}`;
    li.style.color = "blue";
  } else if (payload.privado) {
    li.textContent = `[PRIVADO de ${payload.de}] ${fecha}: ${payload.mensaje}`;
    li.style.color = "red";
  } else {
    li.textContent = `[${payload.id}] ${fecha}: ${payload.mensaje}`;
  }

  ulMessages.appendChild(li);
});
// -------- Recibir mensajes ----------
// socket.on("recibir-mensaje", (payload: any) => {
//   const fecha = new Date(payload.fecha).toLocaleDateString("es-ES");
//   const li = document.createElement("li");

//   if (payload.privado && payload.de === clientId) {
//     li.textContent = `[PRIVADO a ${payload.toId}] ${fecha}: ${payload.mensaje}`;
//     li.style.color = "blue";
//   } else if (payload.privado) {
//     li.textContent = `[PRIVADO de ${payload.de}] ${fecha}: ${payload.mensaje}`;
//     li.style.color = "red";
//   } else {
//     li.textContent = `[${payload.id}] ${fecha}: ${payload.mensaje}`;
//   }

//   ulMessages.appendChild(li);
// });




// -------- Función para actualizar lista de clientes ----------
function actualizarClientes() {
  socket.emit("solicitar-clientes", (clientes: string[]) => {
    // Guardamos la selección actual
    const seleccionado = selectClientes.value;

    selectClientes.innerHTML = "";
    clientes.forEach(c => {
      if (c !== clientId) {
        const option = document.createElement("option");
        option.value = c;
        option.textContent = c;
        selectClientes.appendChild(option);
      }
    });

    // Restauramos la selección si todavía existe
    if (clientes.includes(seleccionado)) {
      selectClientes.value = seleccionado;
    }
  });
}


// Actualizar cada 5 segundos
setInterval(actualizarClientes, 5000);
