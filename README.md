# Mapa Recolecta (Suchiapa, Chiapas)

Aplicación web desarrollada con **React + TypeScript + Vite** para visualizar un **mapa interactivo** enfocado en la planeación y representación de rutas de recolección de basura en **Suchiapa, Chiapas**.

Este proyecto es la base para un sistema de rutas donde se podrán dibujar recorridos, gestionar puntos clave y posteriormente integrar validación de rutas y control operativo.

Este proyecto esta relacionado con otro en construccion actualmente un sistema de gestion de rutas

---

## Introducción

**Mapa Recolecta** es un proyecto frontend construido con React y Leaflet que permite mostrar un mapa centrado en Suchiapa, Chiapas, y dibujar rutas mediante polilíneas.

La aplicación está pensada como un prototipo inicial para el desarrollo de un sistema completo de control y seguimiento de rutas de recolección de basura.

---

## Características Principales

- Visualización de mapa interactivo (OpenStreetMap)
- Mapa centrado en Suchiapa, Chiapas
- Pintado de rutas mediante Polyline
- Arquitectura modular basada en componentes
- Proyecto preparado para escalabilidad (rutas, puntos, camiones, validaciones)
- Compatible con React + Vite (SPA)

---

## Arquitectura

El proyecto sigue una arquitectura **SPA (Single Page Application)** basada en componentes.

- Frontend desacoplado
- Basado en componentes reutilizables
- Estructura modular por funcionalidades (feature-based)
- Preparado para futura integración con backend (API REST o WebSocket)

---

## Stack Tecnológico

### Frontend
- React
- TypeScript
- Vite

### Mapas
- Leaflet
- React Leaflet
- OpenStreetMap (tiles)

### Linting
- ESLint

---

## Requisitos

- Node.js >= 18
- npm >= 9

---

## Instalación

### 1) Clonar repositorio
```bash
git clone <https://github.com/Denzel-Santiago/MapaRecolecta.git>

### 2) Entrar a la carpeta
  cd Mapa-Rec
### 3) Instalar dependencias
  npm install
### 4) Ejecutar el proyecto
  npm run dev

### El proyecto se abrirá normalmente en:

http://localhost:

Estructura del Proyecto
Mapa-Rec/
│
├── public/                      # Archivos públicos estáticos
│
├── src/
│   ├── assets/                  # Imágenes, íconos, etc.
│   │
│   ├── components/              # Componentes reutilizables
│   │   └── MapaRutas.tsx        # Componente principal del mapa
│   │
│   ├── App.tsx                  # Componente raíz
│   ├── main.tsx                 # Entrada principal
│   └── index.css                # Estilos globales
│
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
└── README.md


## Configuración del Mapa

## El mapa utiliza tiles de OpenStreetMap o CartoDB (dependiendo de configuración).

 # Ejemplo de TileLayer:
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
### Seguridad

Actualmente el proyecto:

    No expone credenciales

    No utiliza llaves de Google Maps

    No requiere variables de entorno

    No almacena datos sensibles

### Recomendaciones si se escala a producción:

      Usar variables de entorno (.env)

      No subir archivos .env al repositorio

      Integrar autenticación (JWT / OAuth)

      Desplegar con HTTPS

### Notas Adicionales
      #Posibles despliegues

          El proyecto puede desplegarse en:

          Servidores Linux

          Docker (futuro)

          ## Scripts Disponibles

- npm run dev → Ejecuta en desarrollo
- npm run build → Genera build de producción
- npm run preview → Previsualiza build
- npm run lint → Ejecuta ESLint

