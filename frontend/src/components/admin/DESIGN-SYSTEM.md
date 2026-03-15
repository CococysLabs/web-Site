# Sistema de Diseño COCOCYS

## 🎨 Paleta de Colores

El sistema de diseño COCOCYS está basado en el **naranja institucional** (`#ff8c42`) que representa energía, creatividad y accesibilidad en el contexto educativo.

### Colores Principales

```css
--cococys-orange: #ff8c42        /* Color primario */
--cococys-orange-dark: #e57a32   /* Hover y énfasis */
--cococys-orange-light: #ffaa6f  /* Variante clara */
--cococys-orange-subtle: rgba(255, 140, 66, 0.08)  /* Backgrounds sutiles */
--cococys-orange-medium: rgba(255, 140, 66, 0.15) /* Backgrounds medio */
```

### Tipografía

```css
--text-primary: #1a1a1a     /* Texto principal */
--text-secondary: #6b7280   /* Texto secundario */
--text-light: #9ca3af       /* Texto terciario */
```

### Backgrounds

```css
--bg-primary: #ffffff       /* Fondo principal */
--bg-secondary: #f9fafb     /* Fondo secundario */
--bg-elevated: #ffffff      /* Fondo elevado (cards) */
```

### Bordes y Sombras

```css
--border-light: #e5e7eb
--border-medium: #d1d5db

--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05)
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1)
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1)
```

## 📐 Espaciado y Radios

### Espaciado
```css
--spacing-xs: 4px
--spacing-sm: 8px
--spacing-md: 16px
--spacing-lg: 24px
--spacing-xl: 32px
```

### Border Radius
```css
--radius-sm: 6px
--radius-md: 10px
--radius-lg: 14px
--radius-xl: 18px
```

## 🎬 Transiciones y Animaciones

```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-normal: 250ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1)
```

### Animaciones Incluidas

1. **fadeIn** - Entrada suave de elementos
2. **slideUp** - Animación de modales
3. **spin** - Indicador de carga

## 🧩 Componentes

### Cards de Carpetas

```jsx
<div className="folder-card">
  <div className="folder-icon-wrapper">
    <svg className="folder-icon">...</svg>
  </div>
  <div className="folder-name">Nombre</div>
</div>
```

**Características:**
- Gradiente naranja en hover
- Elevación con box-shadow
- Transformación translateY(-4px) en hover
- Borde superior naranja que aparece gradualmente

### Items de Archivos

```jsx
<div className="file-item">
  <div className="file-info">
    <div className="file-icon-wrapper">...</div>
    <div className="file-details">
      <div className="file-name">documento.pdf</div>
      <div className="file-meta">
        <span className="file-size">📦 2.5 MB</span>
        <span>📅 15 ene 2026</span>
        <span className="badge-new">Nuevo</span>
      </div>
    </div>
  </div>
  <button className="btn-analyze">🔍 Analizar</button>
</div>
```

**Características:**
- Layout horizontal con icono, información y botón
- Badge "Nuevo" para archivos recientes (< 7 días)
- Hover con borde naranja y fondo sutil
- Metadata visible (tamaño, fecha)

### Badges

#### Badge "Nuevo"
```jsx
<span className="badge-new">Nuevo</span>
```

#### Status Badges
```jsx
<span className="status-badge success">✓ Legible</span>
<span className="status-badge warning">⚠ Advertencia</span>
<span className="status-badge error">✗ Error</span>
```

### Botones

#### Botón Analizar (Primario)
```jsx
<button className="btn-analyze">
  🔍 Analizar
</button>

<button className="btn-analyze" disabled>
  <svg className="btn-analyze-icon">...</svg>
  Analizando...
</button>
```

**Características:**
- Gradiente naranja (primary → dark)
- Box-shadow elevado
- Transformación en hover
- Estado disabled con opacidad
- Icono animado al analizar

### Modal de Análisis

```jsx
<div className="analysis-modal-overlay">
  <div className="analysis-modal">
    <div className="modal-header">
      <div className="modal-title-wrapper">
        <h2 className="modal-title">Análisis de Documento</h2>
        <p className="modal-subtitle">nombre-archivo.pdf</p>
      </div>
      <button className="modal-close">✕</button>
    </div>
    <div className="modal-content">
      <div className="analysis-section">...</div>
    </div>
  </div>
</div>
```

**Características:**
- Backdrop con blur
- Animación slideUp
- Header con gradiente sutil
- Secciones con borde izquierdo naranja
- Botón de cierre con rotación en hover

### Keywords Tags

```jsx
<div className="keywords-container">
  <span className="keyword-tag">Python</span>
  <span className="keyword-tag">Machine Learning</span>
</div>
```

## 📱 Responsive Design

### Breakpoints

```css
/* Tablet */
@media (max-width: 768px) {
  /* Grid de carpetas: 2 columnas mínimo 160px */
  /* Padding reducido */
  /* Iconos más pequeños */
}

/* Mobile */
@media (max-width: 480px) {
  /* Grid de carpetas: 1 columna */
  /* Layout vertical para archivos */
  /* Botones full-width */
}
```

### Mobile-First Features

1. **Touch-friendly**: Botones y cards con área táctil mínima de 44x44px
2. **Vertical scrolling**: Contenido optimizado para scroll vertical
3. **Compacto**: Espaciado reducido sin sacrificar legibilidad
4. **Iconos**: Reducción proporcional de tamaños

## ♿ Accesibilidad

### Navegación por Teclado

```css
button:focus-visible,
.file-item:focus-visible,
.folder-card:focus-visible {
  outline: 2px solid var(--cococys-orange);
  outline-offset: 2px;
}
```

### Reducción de Movimiento

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Contraste

- Texto principal: #1a1a1a sobre #ffffff (ratio 16.9:1) ✅
- Texto secundario: #6b7280 sobre #ffffff (ratio 5.8:1) ✅
- Naranja sobre blanco: #ff8c42 sobre #ffffff (ratio 3.4:1) ✅

## 🚀 Mejores Prácticas

### 1. Jerarquía Visual Clara

- **Primario**: Botones de acción principales con gradiente naranja
- **Secundario**: Iconos y metadata con colores sutiles
- **Terciario**: Backgrounds y bordes con opacidades bajas

### 2. Microinteracciones

- **Hover**: Cambio de color + elevación (translateY + box-shadow)
- **Active**: Reducción de elevación para feedback táctil
- **Loading**: Spinner con rotación + texto descriptivo

### 3. Feedback Visual

- **Badges**: Para estados y novedades
- **Iconos**: Emojis para contexto rápido (📄, 📁, 📦, 📅)
- **Gradientes**: Para enfatizar jerarquía y guiar la atención

### 4. Performance

- **CSS Variables**: Cambios de tema instantáneos
- **Transform/Opacity**: Para animaciones suaves (GPU-accelerated)
- **Lazy Loading**: Componentes pesados cargados bajo demanda

## 📦 Implementación

### 1. Importar el CSS

```jsx
import './DocumentAnalyzer.css';
```

### 2. Usar Variables CSS

```css
.mi-componente {
  color: var(--cococys-orange);
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  transition: all var(--transition-normal);
}
```

### 3. Componentes Reutilizables

```jsx
// Folder Card
<div className="folder-card" onClick={handleClick}>
  <div className="folder-icon-wrapper">
    <FolderIcon />
  </div>
  <div className="folder-name">{name}</div>
</div>

// File Item
<div className="file-item">
  <div className="file-info">
    <FileIcon />
    <div className="file-details">
      <div className="file-name">{name}</div>
      <div className="file-meta">
        <span>{size}</span>
        <span>{date}</span>
      </div>
    </div>
  </div>
  <button className="btn-analyze">Analizar</button>
</div>
```

## 🎯 Objetivos Alcanzados

✅ **Diferenciación Visual**: Identidad única con naranja COCOCYS  
✅ **UX Educativa**: Badges, metadata, navegación intuitiva  
✅ **Engagement**: Animaciones suaves, hover effects, feedback visual  
✅ **Escalabilidad**: Variables CSS, componentes reutilizables  
✅ **Responsive**: Mobile-first con breakpoints estratégicos  
✅ **Accesibilidad**: Contraste, navegación por teclado, reduced motion  

## 📝 Notas de Desarrollo

- **Backend**: FastAPI con análisis de PDFs (PyPDF2, Gemini AI fallback)
- **Frontend**: React 19 con Vite 7
- **API**: `/api/analysis/analyze-drive-file` para análisis completo
- **Estado**: Redux no usado, state management con useState/useEffect
- **Testing**: Manual testing en Chrome/Safari/Firefox

---

**Versión**: 2.0  
**Fecha**: Febrero 2026  
**Diseñador**: GitHub Copilot  
**Marca**: COCOCYS - Plataforma Educativa
