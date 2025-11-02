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

  // Datos de ejemplo - después se pueden cargar desde un archivo JSON o API
  const resources = [
    {
      id: 1,
      title: 'Fundamentos de Programación',
      description: 'Documentación completa sobre conceptos básicos de programación y algoritmos.',
      type: 'drive',
      url: 'https://drive.google.com/...',
      category: 'Documentación',
      tags: ['programación', 'algoritmos', 'fundamentos']
    },
    {
      id: 2,
      title: 'Proyecto Web COCOCYS',
      description: 'Repositorio del código fuente de la plataforma web oficial.',
      type: 'github',
      url: 'https://github.com/CococysLabs/web-Site',
      category: 'Código',
      tags: ['react', 'vite', 'frontend']
    },
    {
      id: 3,
      title: 'Guía de React Avanzado',
      description: 'Tutorial completo de React incluyendo hooks, context, y patrones avanzados.',
      type: 'drive',
      url: 'https://drive.google.com/...',
      category: 'Tutoriales',
      tags: ['react', 'javascript', 'hooks']
    },
    {
      id: 4,
      title: 'API Backend Node.js',
      description: 'Código del servidor backend construido con Node.js y Express.',
      type: 'github',
      url: 'https://github.com/...',
      category: 'Código',
      tags: ['nodejs', 'express', 'backend']
    },
    {
      id: 5,
      title: 'Diseño UI/UX - Recursos',
      description: 'Colección de recursos y herramientas para diseño de interfaces.',
      type: 'drive',
      url: 'https://drive.google.com/...',
      category: 'Diseño',
      tags: ['ui', 'ux', 'diseño']
    },
    {
      id: 6,
      title: 'Ejercicios de Algoritmos',
      description: 'Repositorio con ejercicios resueltos de algoritmos y estructuras de datos.',
      type: 'github',
      url: 'https://github.com/...',
      category: 'Código',
      tags: ['algoritmos', 'ejercicios', 'práctica']
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

      {/* Featured Images Section */}
      <section className="featured-section">
        <div className="container">
          <div className="featured-images">
            <div className="featured-image-container">
              <img
                src={`${import.meta.env.BASE_URL}images/featured/imagen-1.png`}
                alt="Imagen destacada 1"
                className="featured-image"
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextElementSibling.style.display = 'flex'
                }}
              />
              <div className="featured-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Imagen Destacada 1</span>
              </div>
            </div>

            <div className="featured-image-container">
              <img
                src={`${import.meta.env.BASE_URL}images/featured/imagen-2.png`}
                alt="Imagen destacada 2"
                className="featured-image"
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextElementSibling.style.display = 'flex'
                }}
              />
              <div className="featured-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Imagen Destacada 2</span>
              </div>
            </div>
          </div>
        </div>
      </section>

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
                      {resource.type === 'drive' ? (
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M7.71 3.5L1.15 15l2.85 5h5.7l2.85-5-6.56-11.5zM8.85 15l-2.85 5h11.4l2.85-5H8.85zm12 5l2.85-5-6.56-11.5L16.3 15l2.85 5H20.85z"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                      )}
                      {resource.type === 'drive' ? 'Drive' : 'GitHub'}
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
