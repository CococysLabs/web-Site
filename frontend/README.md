# COCOCYS Frontend

Interfaz web en React para el sistema de análisis de documentos.

## 🚀 Tecnologías

- **React 19** - Framework UI
- **Vite 7** - Build tool y dev server
- **React Router** - Enrutamiento
- **Axios** - HTTP client
- **React Hook Form** - Formularios
- **Context API** - Estado global

## 📋 Requisitos

- Node.js 18+
- npm 9+

## 🛠️ Instalación

```bash
npm install
```

## 🏃‍♂️ Desarrollo

```bash
npm run dev
```

Abre http://localhost:5173/web-Site/

## 📦 Build

```bash
npm run build
```

Los archivos se generan en `dist/`

## 🧪 Testing

```bash
npm run test
```

## 🎨 Estructura

```
src/
├── components/
│   ├── auth/         # Login, Register
│   ├── documents/    # Upload, Analysis
│   ├── layout/       # Navbar, Footer
│   └── common/       # Shared components
├── contexts/         # React Context
│   └── AuthContext.jsx
├── services/         # API calls
│   └── api.js
├── utils/           # Helpers
├── App.jsx          # Main component
└── main.jsx         # Entry point
```

## 🔧 Configuración

Variables de entorno en `.env`:

```env
VITE_API_URL=http://localhost:8000
```

## 📝 Scripts

- `npm run dev` - Dev server
- `npm run build` - Build producción
- `npm run preview` - Preview build
- `npm run lint` - ESLint

## 🎯 Características

- ✅ Autenticación JWT
- ✅ Formularios validados
- ✅ Drag & drop files
- ✅ Responsive design
- ✅ Dark theme
- ✅ Animaciones
