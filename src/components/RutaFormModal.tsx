import { useState, type FormEvent } from "react";
import type { DatosRutaForm, RutaDiseñada } from "../models/rutaDiseñada";
import "./diseñador.css";
export default function RutaFormModal({ camionId, ruta, onCancelar, onGuardar }: { camionId: number; ruta?: RutaDiseñada; onCancelar: () => void; onGuardar: (datos: DatosRutaForm) => void; }) {
  const [datos, setDatos] = useState<DatosRutaForm>({ nombre: ruta?.nombre ?? "", descripcion: ruta?.descripcion ?? "" });
  const enviar = (event: FormEvent) => {
    event.preventDefault();
    onGuardar({
      nombre: datos.nombre.trim(),
      descripcion: datos.descripcion.trim(),
    });
  };
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><form className="modal-card ruta-form" onSubmit={enviar}><h2>Datos de la ruta</h2>
    <label>Nombre de la ruta<input required value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} placeholder="Ruta Centro Norte" /></label>
    <label>Descripcion<textarea required value={datos.descripcion} onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })} placeholder="Descripcion general de la ruta" rows={4} /></label>
    <label>Camión<input value={`Camión ${camionId}`} disabled /></label><div className="acciones-modal"><button type="button" onClick={onCancelar}>Cancelar</button><button className="boton-primario" type="submit">Guardar ruta</button></div></form></div>;
}
