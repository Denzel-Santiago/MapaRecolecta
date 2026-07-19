import { useState, type FormEvent } from "react";
import type { DatosRutaForm, RutaDiseñada } from "../models/rutaDiseñada";
import "./diseñador.css";

export default function RutaFormModal({
  camionId,
  ruta,
  onCancelar,
  onGuardar,
}: {
  camionId: number;
  ruta?: RutaDiseñada;
  onCancelar: () => void;
  onGuardar: (datos: DatosRutaForm) => void | Promise<void>;
}) {
  const [datos, setDatos] = useState<DatosRutaForm>({
    nombre: ruta?.nombre ?? "",
    descripcion: ruta?.descripcion ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onGuardar({
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la ruta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal-card ruta-form" onSubmit={enviar}>
        <h2>Datos de la ruta</h2>
        {error && <p className="ruta-form-error">{error}</p>}
        <label>
          Nombre de la ruta
          <input
            required
            value={datos.nombre}
            onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
            placeholder="Ruta Centro Norte"
            disabled={loading}
          />
        </label>
        <label>
          Descripción
          <textarea
            required
            value={datos.descripcion}
            onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })}
            placeholder="Descripción general de la ruta"
            rows={4}
            disabled={loading}
          />
        </label>
        <label>
          Camión
          <input value={`Camión ${camionId}`} disabled />
        </label>
        <div className="acciones-modal">
          <button type="button" onClick={onCancelar} disabled={loading}>
            Cancelar
          </button>
          <button className="boton-primario" type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Guardar ruta"}
          </button>
        </div>
      </form>
    </div>
  );
}
