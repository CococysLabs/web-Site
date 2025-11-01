import { useState } from 'react'
import './App.css'

function App() {
  const [searchTerm, setSearchTerm] = useState('')

  // Ejemplo de recursos - esto se moverá a un archivo de datos después
  const resources = [
    {
      id: 1,
      title: 'Documento de Ejemplo 1',
      description: 'Descripción del documento',
      type: 'drive',
      url: 'https://drive.google.com/...',
      category: 'Documentación'
    },
    {
      id: 2,
      title: 'Repositorio de Ejemplo',
      description: 'Código fuente del proyecto',
      type: 'github',
      url: 'https://github.com/...',
      category: 'Código'
    }
  ]

  const filteredResources = resources.filter(resource =>
    resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    resource.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="container">
      <header className="header">
        <h1>COCOCYS - Biblioteca Digital</h1>
        <p>Centro de recursos y documentación</p>
      </header>

      <div className="search-section">
        <input
          type="text"
          placeholder="Buscar recursos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="resources-grid">
        {filteredResources.length > 0 ? (
          filteredResources.map(resource => (
            <div key={resource.id} className="resource-card">
              <div className="resource-header">
                <span className={`badge badge-${resource.type}`}>
                  {resource.type === 'drive' ? '📁 Drive' : '💻 GitHub'}
                </span>
                <span className="category">{resource.category}</span>
              </div>
              <h3>{resource.title}</h3>
              <p>{resource.description}</p>
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="resource-link"
              >
                Ver recurso →
              </a>
            </div>
          ))
        ) : (
          <p className="no-results">No se encontraron recursos</p>
        )}
      </div>

      <footer className="footer">
        <p>COCOCYS &copy; 2024 - Todos los derechos reservados</p>
      </footer>
    </div>
  )
}

export default App
