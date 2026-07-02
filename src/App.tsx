import './App.css'
import { useState } from 'react'
import MapaDiseñador from './components/MapaDiseñador'
import MapaMonitoreo from './components/MapaMonitoreo'

function App() {

  const [vistaActual, setVistaActual] = useState<"diseñador" | "monitoreo">("diseñador")

  // 🔥 Ruta compartida entre vistas
  const [rutaActual, setRutaActual] = useState<[number, number][]>([])

  return (
    <>
      {vistaActual === "diseñador" && (
        <MapaDiseñador
          cambiarVista={() => setVistaActual("monitoreo")}
          guardarRuta={(ruta) => setRutaActual(ruta)}
        />
      )}

      {vistaActual === "monitoreo" && (
        <MapaMonitoreo
          regresar={() => setVistaActual("diseñador")}
          ruta={rutaActual}
        />
      )}
    </>
  )
}

export default App