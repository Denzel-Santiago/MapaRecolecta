import { useState, type FormEvent } from "react";
import type { DatosRutaForm, RutaDiseñada } from "../models/rutaDiseñada";
import "./diseñador.css";
function fechaActual(): string { const fecha = new Date(); return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); }
export default function RutaFormModal({ camionId, ruta, onCancelar, onGuardar }: { camionId: number; ruta?: RutaDiseñada; onCancelar: () => void; onGuardar: (datos: DatosRutaForm) => void; }) {
  const [datos, setDatos] = useState<DatosRutaForm>({ nombre: ruta?.nombre ?? "", zona: ruta?.zona ?? "Centro", turno: ruta?.turno ?? "Matutino", fecha: ruta?.fecha ?? fechaActual(), estado: ruta?.estado ?? "BORRADOR" });
  const enviar = (event: FormEvent) => { event.preventDefault(); onGuardar({ ...datos, nombre: datos.nombre.trim() }); };
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><form className="modal-card ruta-form" onSubmit={enviar}><h2>Datos de la ruta</h2>
    <label>Nombre de la ruta<input required value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} placeholder="Ruta Centro Norte" /></label>
    <label>Zona<select value={datos.zona} onChange={(e) => setDatos({ ...datos, zona: e.target.value as DatosRutaForm["zona"] })}>{["Centro", "Norte", "Sur", "Oriente", "Poniente"].map((valor) => <option key={valor}>{valor}</option>)}</select></label>
    <label>Turno<select value={datos.turno} onChange={(e) => setDatos({ ...datos, turno: e.target.value as DatosRutaForm["turno"] })}>{["Matutino", "Vespertino", "Nocturno"].map((valor) => <option key={valor}>{valor}</option>)}</select></label>
    <label>Fecha<input type="date" required value={datos.fecha} onChange={(e) => setDatos({ ...datos, fecha: e.target.value })} /></label>
    <label>Estado<select value={datos.estado} onChange={(e) => setDatos({ ...datos, estado: e.target.value as DatosRutaForm["estado"] })}>{["BORRADOR", "ACTIVA", "PAUSADA"].map((valor) => <option key={valor}>{valor}</option>)}</select></label>
    <label>Camión<input value={`Camión ${camionId}`} disabled /></label><div className="acciones-modal"><button type="button" onClick={onCancelar}>Cancelar</button><button className="boton-primario" type="submit">Guardar ruta</button></div></form></div>;
}
