import { useState } from 'react';
import api from '../services/api';

const STRUCTURE_FOLDER_ID = '1kKtxjCV9cXxkS_BeQv95Ud5M_Q0S77aA';

const CreateFoldersFromCsv = () => {
    const [csvFile, setCsvFile] = useState(null);
    const [creating, setCreating] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleCreate = async () => {
        if (!csvFile) {
            setError('Selecciona un archivo CSV primero');
            return;
        }

        setCreating(true);
        setResult(null);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', csvFile);

            const response = await api.post('/api/drive/create-folders-from-csv', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setResult(response.data);
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Error al crear carpetas');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>📁 Crear carpetas</h2>
                <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                    Crea estructuras de cursos desde un archivo CSV dentro de Mi Carpeta.
                </p>
                <p style={{ margin: '6px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.78rem' }}>
                    Mi Carpeta: <code>{STRUCTURE_FOLDER_ID}</code>
                </p>
            </div>

            <div style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: '16px',
                padding: '1.5rem',
                marginBottom: '1rem'
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>
                    Subir CSV de estructura
                </h3>

                <p style={{
                    marginTop: 0,
                    marginBottom: '1rem',
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.9rem'
                }}>
                    El CSV debe incluir Area, Curso y la tabla No., Carpeta, No., Sub Carpeta.
                    El sistema no duplica carpetas existentes.
                </p>

                <div style={{
                    display: 'flex',
                    gap: '12px',
                    flexWrap: 'wrap',
                    alignItems: 'center'
                }}>
                    <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => {
                            setCsvFile(e.target.files?.[0] || null);
                            setResult(null);
                            setError(null);
                        }}
                    />

                    <button
                        onClick={handleCreate}
                        disabled={creating || !csvFile}
                        style={{
                            border: 0,
                            borderRadius: '10px',
                            padding: '0.75rem 1rem',
                            cursor: creating || !csvFile ? 'not-allowed' : 'pointer',
                            fontWeight: 700,
                            color: 'white',
                            background: creating || !csvFile
                                ? 'linear-gradient(135deg,#9ca3af,#6b7280)'
                                : 'linear-gradient(135deg,#10b981,#059669)'
                        }}
                    >
                        {creating ? '⏳ Creando...' : '➕ Crear carpetas'}
                    </button>
                </div>

                {csvFile && (
                    <p style={{
                        margin: '0.75rem 0 0',
                        fontSize: '0.82rem',
                        color: 'var(--color-text-secondary)'
                    }}>
                        Archivo seleccionado: <strong>{csvFile.name}</strong>
                    </p>
                )}
            </div>

            {error && (
                <div style={{
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#f87171',
                    borderRadius: '12px',
                    padding: '1rem',
                    marginBottom: '1rem'
                }}>
                    ❌ {error}
                </div>
            )}

            {result && (
                <div style={{
                    background: result.success ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                    border: result.success ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)',
                    borderRadius: '12px',
                    padding: '1rem'
                }}>
                    <h3 style={{ marginTop: 0 }}>
                        {result.success ? '✅ Estructura procesada' : '⚠️ Procesada con errores'}
                    </h3>

                    <p style={{ margin: '0 0 0.5rem' }}>
                        <strong>Área:</strong> {result.area}
                    </p>
                    <p style={{ margin: '0 0 0.5rem' }}>
                        <strong>Curso:</strong> {result.course}
                    </p>
                    <p style={{ margin: '0 0 0.5rem' }}>
                        <strong>Mi Carpeta:</strong> {result.root_folder_id}
                    </p>

                    <div style={{
                        display: 'flex',
                        gap: '10px',
                        flexWrap: 'wrap',
                        marginTop: '1rem'
                    }}>
                        <Badge label="Creadas" value={result.summary?.created_count || 0} />
                        <Badge label="Existentes" value={result.summary?.existing_count || 0} />
                        <Badge label="Errores" value={result.summary?.error_count || 0} />
                    </div>

                    {result.created?.length > 0 && (
                        <details style={{ marginTop: '1rem' }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                                Ver carpetas creadas
                            </summary>
                            <ul style={{ marginTop: '0.75rem' }}>
                                {result.created.map((item, index) => (
                                    <li key={index} style={{ marginBottom: '0.35rem' }}>
                                        {item.path}
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}

                    {result.errors?.length > 0 && (
                        <details style={{ marginTop: '1rem' }} open>
                            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                                Ver errores
                            </summary>
                            <ul style={{ marginTop: '0.75rem' }}>
                                {result.errors.map((item, index) => (
                                    <li key={index} style={{ marginBottom: '0.35rem' }}>
                                        {item.path}: {item.error}
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                </div>
            )}
        </div>
    );
};

const Badge = ({ label, value }) => (
    <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        borderRadius: '999px',
        padding: '6px 12px',
        fontSize: '0.8rem',
        fontWeight: 700,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid var(--color-border)'
    }}>
        {label}: {value}
    </span>
);

export default CreateFoldersFromCsv;