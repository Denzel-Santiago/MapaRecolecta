import { useState } from "react";
import "./diseñador.css";
export default function SeleccionCamionModal({ onConfirmar }: { onConfirmar: (camionId: number) => void }) {
  const [seleccion, setSeleccion] = useState<number | null>(null);
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card"><h2>Seleccione el camión para diseñar la ruta</h2><div className="opciones-camion">{[1, 2, 3].map((id) => <label key={id}><input type="radio" name="camion" checked={seleccion === id} onChange={() => setSeleccion(id)} /> Camión {id}</label>)}</div><button className="boton-primario" disabled={seleccion === null} onClick={() => seleccion !== null && onConfirmar(seleccion)}>Comenzar diseño</button></div></div>;
}
