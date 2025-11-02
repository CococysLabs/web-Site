import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simular carga inicial
    setTimeout(() => setIsLoading(false), 500)
  }, [])

  // Recursos reales del ecosistema COCOCYS
  const resources = [
    {
      id: 1,
      title: 'Metodología COCOCYS - Segundo Ciclo',
      description: 'Primera reunión 2025 sobre metodología para consolidación de conocimiento en ciencias y sistemas.',
      type: 'youtube',
      url: 'https://www.youtube.com/@COCOCYSECYS/videos',
      category: 'Tutoriales',
      tags: ['metodología', 'educación', 'sistemas']
    },
    {
      id: 2,
      title: 'Cómo redactar una competencia',
      description: 'Video tutorial sobre redacción de competencias según la metodología COCOCYS.',
      type: 'youtube',
      url: 'https://www.youtube.com/@COCOCYSECYS/videos',
      category: 'Tutoriales',
      tags: ['competencias', 'educación', 'metodología']
    },
    {
      id: 3,
      title: 'Calificación de Proyectos COCOCYS',
      description: 'Guía sobre calificación de proyectos con modificación de código o trabajo asignado.',
      type: 'youtube',
      url: 'https://www.youtube.com/@COCOCYSECYS/videos',
      category: 'Tutoriales',
      tags: ['evaluación', 'proyectos', 'calificación']
    },
    {
      id: 4,
      title: 'Estructura de Datos',
      description: 'Material académico completo sobre estructuras de datos según metodología COCOCYS.',
      type: 'github',
      url: 'https://github.com/CococysLabs/area-software/tree/main/772-estructura-datos',
      category: 'Código',
      tags: ['estructura-datos', 'algoritmos', 'programación']
    },
    {
      id: 5,
      title: 'Algoritmos',
      description: 'Curso completo de algoritmos con teoría, práctica y proyectos.',
      type: 'github',
      url: 'https://github.com/CococysLabs/area-software/tree/main/768-algoritmos',
      category: 'Código',
      tags: ['algoritmos', 'análisis', 'complejidad']
    },
    {
      id: 6,
      title: 'Programación de Computadoras I',
      description: 'Fundamentos de programación organizados según la metodología COCOCYS.',
      type: 'github',
      url: 'https://github.com/CococysLabs/area-software/tree/main/090-programacion-computadoras-1',
      category: 'Código',
      tags: ['programación', 'fundamentos', 'introducción']
    },
    {
      id: 7,
      title: 'Programación de Computadoras II',
      description: 'Conceptos avanzados de programación con enfoque práctico.',
      type: 'github',
      url: 'https://github.com/CococysLabs/area-software/tree/main/092-programacion-computadoras-2',
      category: 'Código',
      tags: ['programación', 'avanzado', 'poo']
    },
    {
      id: 8,
      title: 'Análisis y Diseño de Sistemas I',
      description: 'Metodologías y técnicas para análisis y diseño de sistemas de información.',
      type: 'github',
      url: 'https://github.com/CococysLabs/area-software/tree/main/283-analisis-diseno-sistemas-1',
      category: 'Documentación',
      tags: ['análisis', 'diseño', 'sistemas']
    },
    {
      id: 9,
      title: 'Software Avanzado',
      description: 'Técnicas y herramientas avanzadas para desarrollo de software.',
      type: 'github',
      url: 'https://github.com/CococysLabs/area-software/tree/main/780-software-avanzado',
      category: 'Código',
      tags: ['software', 'avanzado', 'ingeniería']
    },
    {
      id: 10,
      title: 'Manejo e Implementación de Archivos',
      description: 'Gestión de archivos, persistencia de datos y operaciones de entrada/salida.',
      type: 'github',
      url: 'https://github.com/CococysLabs/area-software/tree/main/773-manejo-implementacion-archivos',
      category: 'Código',
      tags: ['archivos', 'persistencia', 'io']
    },
    {
      id: 11,
      title: 'Repositorio Web COCOCYS',
      description: 'Código fuente de la plataforma web oficial de COCOCYS.',
      type: 'github',
      url: 'https://github.com/CococysLabs/web-Site',
      category: 'Código',
      tags: ['react', 'vite', 'frontend']
    },
    {
      id: 12,
      title: 'Canal de YouTube COCOCYS',
      description: 'Videos educativos, tutoriales y metodología COCOCYS para ingeniería en sistemas.',
      type: 'youtube',
      url: 'https://www.youtube.com/@COCOCYSECYS',
      category: 'Tutoriales',
      tags: ['videos', 'tutoriales', 'educación']
    }
  ]

  const categories = ['all', 'Documentación', 'Código', 'Tutoriales', 'Diseño']

  const filteredResources = resources.filter(resource => {
    const matchesSearch =
      resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resource.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resource.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesCategory = selectedCategory === 'all' || resource.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  const stats = [
    { label: 'Recursos', value: resources.length },
    { label: 'Categorías', value: categories.length - 1 },
    { label: 'Actualizaciones', value: 'Semanales' }
  ]

  return (
    <div className="app">
      {/* Hero Section */}
      <header className="hero">
        <div className="hero-background">
          <div className="hero-gradient"></div>
          <div className="hero-pattern"></div>
        </div>

        <div className="hero-content">
          {/* Logos Section */}
          <div className="hero-logos">
            <div className="logo-container">
              <img
                src={`${import.meta.env.BASE_URL}images/logos/logo-principal.png`}
                alt="COCOCYS Logo"
                className="logo logo-principal"
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextElementSibling.style.display = 'flex'
                }}
              />
              <div className="logo-placeholder logo-placeholder-principal">
                <span>COCOCYS</span>
              </div>
            </div>
            <div className="logo-container">
              <img
                src={`${import.meta.env.BASE_URL}images/logos/logo-secundario.png`}
                alt="Partner Logo"
                className="logo logo-secundario"
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextElementSibling.style.display = 'flex'
                }}
              />
              <div className="logo-placeholder logo-placeholder-secundario">
                <span>Partner</span>
              </div>
            </div>
          </div>

          <div className="hero-badge">
            <span className="badge-dot"></span>
            <span>Biblioteca Digital</span>
          </div>

          <h1 className="hero-title">
            <span className="gradient-text">COCOCYS</span>
            <br />
            Centro de Recursos
          </h1>

          <p className="hero-description">
            Accede a documentación, código fuente, tutoriales y más.
            Todo en un solo lugar, organizado y fácil de encontrar.
          </p>

          {/* Stats */}
          <div className="stats-grid">
            {stats.map((stat, index) => (
              <div key={index} className="stat-card">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>
      {/* Main Content */}
      <main className="main-content">
        <div className="container">
          {/* Search and Filters */}
          <div className="search-section">
            <div className="search-wrapper">
              <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por título, descripción o etiquetas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              {searchTerm && (
                <button
                  className="search-clear"
                  onClick={() => setSearchTerm('')}
                  aria-label="Limpiar búsqueda"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Category Filters */}
            <div className="category-filters">
              {categories.map((category) => (
                <button
                  key={category}
                  className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category === 'all' ? 'Todos' : category}
                </button>
              ))}
            </div>
          </div>

          {/* Results Info */}
          <div className="results-info">
            <p>
              {filteredResources.length === 0 ? (
                'No se encontraron recursos'
              ) : (
                <>
                  Mostrando <strong>{filteredResources.length}</strong> {filteredResources.length === 1 ? 'recurso' : 'recursos'}
                  {searchTerm && ` para "${searchTerm}"`}
                </>
              )}
            </p>
          </div>

          {/* Resources Grid */}
          {isLoading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Cargando recursos...</p>
            </div>
          ) : filteredResources.length > 0 ? (
            <div className="resources-grid">
              {filteredResources.map((resource, index) => (
                <article
                  key={resource.id}
                  className="resource-card"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="card-header">
                    <span className={`resource-badge ${resource.type}`}>
                      {resource.type === 'youtube' ? (
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                      ) : resource.type === 'github' ? (
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M7.71 3.5L1.15 15l2.85 5h5.7l2.85-5-6.56-11.5zM8.85 15l-2.85 5h11.4l2.85-5H8.85zm12 5l2.85-5-6.56-11.5L16.3 15l2.85 5H20.85z"/>
                        </svg>
                      )}
                      {resource.type === 'youtube' ? 'YouTube' : resource.type === 'github' ? 'GitHub' : 'Drive'}
                    </span>
                    <span className="category-tag">{resource.category}</span>
                  </div>

                  <h3 className="card-title">{resource.title}</h3>
                  <p className="card-description">{resource.description}</p>

                  <div className="card-tags">
                    {resource.tags.map((tag, i) => (
                      <span key={i} className="tag">#{tag}</span>
                    ))}
                  </div>

                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card-link"
                  >
                    <span>Ver recurso</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3>No se encontraron recursos</h3>
              <p>Intenta con otros términos de búsqueda o cambia el filtro de categoría.</p>
              <button onClick={() => { setSearchTerm(''); setSelectedCategory('all') }}>
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h4>COCOCYS</h4>
              <p>Biblioteca digital de recursos educativos y código abierto.</p>
            </div>

            <div className="footer-section">
              <h4>Enlaces</h4>
              <ul>
                <li><a href="https://github.com/CococysLabs" target="_blank" rel="noopener noreferrer">GitHub</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({top: 0, behavior: 'smooth'}) }}>Inicio</a></li>
              </ul>
            </div>

            <div className="footer-section">
              <h4>Contacto</h4>
              <p>¿Tienes sugerencias o recursos para compartir?</p>
              <a href="https://github.com/CococysLabs/web-Site/issues" target="_blank" rel="noopener noreferrer" className="footer-link">
                Contáctanos
              </a>
            </div>
          </div>

          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} COCOCYS. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
