import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import './CourseFolderCreator.css';
import './CourseContactsManager.css';

const CURRENT_YEAR = new Date().getFullYear();

const SEMESTERS = [
    { value: '1S', label: 'Primer semestre - 1S' },
    { value: '2S', label: 'Segundo semestre - 2S' },
];

const apiError = (error, fallback) => {
    const detail = error?.response?.data?.detail;

    if (Array.isArray(detail)) {
        return detail
            .map((item) => item.msg || JSON.stringify(item))
            .join(' ');
    }

    if (typeof detail === 'string') {
        return detail;
    }

    const baseURL = error?.config?.baseURL || api.defaults.baseURL || '';
    const requestPath = error?.config?.url || '';
    const requestURL = `${baseURL}${requestPath}`;

    if (
        error?.code === 'ECONNABORTED'
        || String(error?.message || '').toLowerCase().includes('timeout')
    ) {
        const timeoutMilliseconds = Number(
            error?.config?.timeout || 0,
        );

        const timeoutSeconds = timeoutMilliseconds > 0
            ? Math.round(timeoutMilliseconds / 1000)
            : null;

        return timeoutSeconds
            ? (
                `La API tardó más de ${timeoutSeconds} segundos en responder. `
                + `Solicitud: ${requestURL}`
            )
            : (
                `La API tardó demasiado en responder. `
                + `Solicitud: ${requestURL}`
            );
    }

    if (error?.code === 'ERR_NETWORK') {
        return (
            `El navegador no recibió respuesta de la API. `
            + `Verifica que esta dirección sea accesible: ${requestURL}`
        );
    }

    if (!error?.response) {
        return (
            `No se recibió respuesta de la API. `
            + `Solicitud: ${requestURL}`
        );
    }

    return error?.message || fallback;
};

const courseState = (course) => {
    const status = String(course?.status || '').toLowerCase();

    if (
        course?.folder_found === false
        || status === 'folder_not_found'
    ) {
        return 'folder_not_found';
    }

    if (status === 'error' || status === 'failed') {
        return 'error';
    }

    if (course?.file_exists === true) {
        return status === 'updated' ? 'updated' : 'ready';
    }

    if (
        course?.folder_found === true
        && course?.file_exists === false
    ) {
        return 'file_required';
    }

    return 'error';
};

const STATE_LABELS = {
    folder_not_found: '📁 Carpeta no encontrada',
    file_required: '📄 Archivo requerido',
    ready: '✅ Listo',
    updated: '✅ Actualizado',
    error: '❌ Error',
};

const collectErrors = (data) => {
    const errors = [
        ...(data?.errors || data?.error_details || []),
    ];

    const courseResults = data?.courses || data?.results || [];

    courseResults.forEach((course) => {
        if (course?.error) {
            errors.push({
                code: course.code,
                path: course.path,
                message: course.error,
            });
        }

        (course?.errors || []).forEach((item) => {
            errors.push({
                code: course.code || item.code,
                path: item.path || course.path,
                message: item.message || item.error,
            });
        });
    });

    return errors;
};

const CourseContactsManager = () => {
    const [areas, setAreas] = useState([]);
    const [area, setArea] = useState('');
    const [courses, setCourses] = useState([]);
    const [selectedCodes, setSelectedCodes] = useState([]);

    const [semester, setSemester] = useState('2S');
    const [year, setYear] = useState(CURRENT_YEAR);

    const [loadingAreas, setLoadingAreas] = useState(false);
    const [loadingCourses, setLoadingCourses] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [updating, setUpdating] = useState(false);

    const [sourceStatus, setSourceStatus] = useState(null);
    const [preview, setPreview] = useState(null);
    const [updateResult, setUpdateResult] = useState(null);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState('');

    const lock = useRef({
        preview: false,
        update: false,
    });

    const previewCourses = preview?.courses || [];

    const busy = (
        loadingAreas
        || loadingCourses
        || previewing
        || updating
    );

    const allReady = useMemo(() => {
        if (
            !preview
            || previewCourses.length === 0
            || previewCourses.length !== selectedCodes.length
        ) {
            return false;
        }

        const previewCodes = previewCourses
            .map((item) => String(item.code))
            .sort();

        const selected = selectedCodes
            .map(String)
            .sort();

        const sameSelection = previewCodes.every(
            (code, index) => code === selected[index],
        );

        return (
            sameSelection
            && previewCourses.every((item) => (
                item.folder_found === true
                && item.file_exists === true
                && courseState(item) === 'ready'
            ))
        );
    }, [preview, previewCourses, selectedCodes]);

    useEffect(() => {
        const loadAreas = async () => {
            try {
                setLoadingAreas(true);
                setError('');

                const response = await api.get(
                    '/api/course-catalog/areas',
                );

                const list = response.data?.areas || [];

                setAreas(list);
                setArea(list[0]?.area || '');
            } catch (requestError) {
                setError(
                    apiError(
                        requestError,
                        'No se pudieron cargar las áreas.',
                    ),
                );
            } finally {
                setLoadingAreas(false);
            }
        };

        loadAreas();
    }, []);

    useEffect(() => {
        if (!area) {
            setCourses([]);
            setSelectedCodes([]);
            return;
        }

        const loadCourses = async () => {
            try {
                setLoadingCourses(true);
                setError('');
                setPreview(null);
                setUpdateResult(null);
                setSourceStatus(null);

                const response = await api.get(
                    '/api/course-catalog',
                    {
                        params: {
                            area,
                        },
                    },
                );

                setCourses(response.data?.courses || []);

                // No seleccionar todos automáticamente.
                setSelectedCodes([]);
            } catch (requestError) {
                setCourses([]);
                setSelectedCodes([]);

                setError(
                    apiError(
                        requestError,
                        'No se pudieron cargar los cursos.',
                    ),
                );
            } finally {
                setLoadingCourses(false);
            }
        };

        loadCourses();
    }, [area]);

    const clearPreviousResult = () => {
        setPreview(null);
        setUpdateResult(null);
        setSourceStatus(null);
        setError('');
    };

    const toggleCourse = (code) => {
        clearPreviousResult();

        setSelectedCodes((current) => (
            current.includes(code)
                ? current.filter((item) => item !== code)
                : [...current, code]
        ));
    };

    const selectAllCourses = () => {
        clearPreviousResult();

        setSelectedCodes(
            courses.map((item) => item.code),
        );
    };

    const clearCourses = () => {
        clearPreviousResult();
        setSelectedCodes([]);
    };

    const buildBody = () => ({
        area,
        course_codes: selectedCodes,
        semester,
        year: Number(year),
    });

    const validate = () => {
        if (!area) {
            return 'Selecciona un área.';
        }

        if (selectedCodes.length === 0) {
            return 'Selecciona al menos un curso.';
        }

        if (!semester) {
            return 'Selecciona el semestre.';
        }

        if (
            Number(year) < 2000
            || Number(year) > 2100
        ) {
            return 'Ingresa un año válido.';
        }

        return '';
    };

    const runPreview = async () => {
        if (
            lock.current.preview
            || lock.current.update
        ) {
            return;
        }

        const validationError = validate();

        if (validationError) {
            setError(validationError);
            return;
        }

        lock.current.preview = true;

        const body = buildBody();
        const endpoint = '/api/course-contacts/preview';
        const fullURL = `${api.defaults.baseURL || ''}${endpoint}`;
        const startedAt = performance.now();

        console.info(
            '[CourseContacts] Iniciando preview',
            {
                url: fullURL,
                body,
                timeoutSeconds: 180,
                startedAt: new Date().toISOString(),
            },
        );

        try {
            setPreviewing(true);
            setError('');
            setPreview(null);
            setUpdateResult(null);
            setSourceStatus(null);

            const response = await api.post(
                endpoint,
                body,
                {
                    timeout: 180000,
                },
            );

            const elapsedSeconds = (
                (performance.now() - startedAt) / 1000
            ).toFixed(2);

            console.info(
                '[CourseContacts] Preview completado',
                {
                    elapsedSeconds,
                    response: response.data,
                },
            );

            setPreview(response.data);

            setSourceStatus({
                success: true,
                message: (
                    `La fuente ${semester} ${year} fue consultada correctamente `
                    + `en ${elapsedSeconds} segundos.`
                ),
            });
        } catch (requestError) {
            const elapsedSeconds = (
                (performance.now() - startedAt) / 1000
            ).toFixed(2);

            console.error(
                '[CourseContacts] Error de preview',
                {
                    elapsedSeconds,
                    message: requestError?.message,
                    code: requestError?.code,
                    status: requestError?.response?.status,
                    response: requestError?.response?.data,
                    baseURL: requestError?.config?.baseURL,
                    url: requestError?.config?.url,
                    timeout: requestError?.config?.timeout,
                },
            );

            setPreview(null);
            setSourceStatus(null);

            setError(
                apiError(
                    requestError,
                    'No se pudo obtener la vista previa.',
                ),
            );
        } finally {
            lock.current.preview = false;
            setPreviewing(false);
        }
    };

    const updateContacts = async () => {
        if (
            lock.current.preview
            || lock.current.update
        ) {
            return;
        }

        if (!allReady) {
            setError(
                'Todos los archivos deben aparecer con estado Listo antes de actualizar.',
            );
            return;
        }

        lock.current.update = true;

        try {
            setUpdating(true);
            setError('');
            setUpdateResult(null);

            const response = await api.post(
                '/api/course-contacts/create',
                buildBody(),
                {
                    timeout: 180000,
                },
            );

            setUpdateResult(response.data);
        } catch (requestError) {
            setError(
                apiError(
                    requestError,
                    'No se pudieron actualizar los contactos.',
                ),
            );
        } finally {
            lock.current.update = false;
            setUpdating(false);
        }
    };

    const copyName = async (filename) => {
        if (!filename) {
            return;
        }

        try {
            await navigator.clipboard.writeText(filename);

            setCopied(filename);

            window.setTimeout(() => {
                setCopied('');
            }, 1600);
        } catch {
            setError(
                'No se pudo copiar automáticamente. Selecciona el nombre y cópialo manualmente.',
            );
        }
    };

    const sourceOk = (
        sourceStatus
        && sourceStatus.success !== false
        && sourceStatus.available !== false
        && sourceStatus.source_found !== false
    );

    const updateSummary = updateResult?.summary || {};

    const updateErrors = collectErrors(updateResult);

    return (
        <div className="course-folder-creator course-contacts-manager">
            <div className="cfc-header">
                <div>
                    <h2>👥 Contactos de cursos</h2>

                    <p>
                        Comprueba los Excel existentes en Drive y
                        actualiza sus contactos desde Google Sheets.
                    </p>
                </div>

                <div className="cfc-header-badge">
                    {selectedCodes.length}{' '}
                    curso{selectedCodes.length === 1 ? '' : 's'}{' '}
                    seleccionado{selectedCodes.length === 1 ? '' : 's'}
                </div>
            </div>

            <section className="cfc-card">
                <h3>1. Área y período</h3>

                <div className="ccm-period-grid">
                    <label className="cfc-label">
                        Área

                        <select
                            value={area}
                            disabled={busy}
                            onChange={(event) => {
                                setArea(event.target.value);
                            }}
                        >
                            {loadingAreas && (
                                <option value="">
                                    Cargando...
                                </option>
                            )}

                            {!loadingAreas && areas.length === 0 && (
                                <option value="">
                                    Sin áreas disponibles
                                </option>
                            )}

                            {areas.map((item) => (
                                <option
                                    key={item.area}
                                    value={item.area}
                                >
                                    {item.label || item.area}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="cfc-label">
                        Semestre

                        <select
                            value={semester}
                            disabled={busy}
                            onChange={(event) => {
                                setSemester(event.target.value);
                                clearPreviousResult();
                            }}
                        >
                            {SEMESTERS.map((item) => (
                                <option
                                    key={item.value}
                                    value={item.value}
                                >
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="cfc-label">
                        Año

                        <input
                            type="number"
                            min="2000"
                            max="2100"
                            value={year}
                            disabled={busy}
                            onChange={(event) => {
                                setYear(event.target.value);
                                clearPreviousResult();
                            }}
                        />
                    </label>
                </div>
            </section>

            <section className="cfc-card">
                <div className="cfc-section-title">
                    <div>
                        <h3>2. Cursos</h3>

                        <p className="cfc-muted">
                            Selecciona uno o varios cursos del área.
                        </p>
                    </div>

                    <div className="cfc-actions-mini">
                        <button
                            type="button"
                            disabled={busy || courses.length === 0}
                            onClick={selectAllCourses}
                        >
                            Todos
                        </button>

                        <button
                            type="button"
                            disabled={
                                busy
                                || selectedCodes.length === 0
                            }
                            onClick={clearCourses}
                        >
                            Ninguno
                        </button>
                    </div>
                </div>

                {loadingCourses ? (
                    <div className="cfc-loading">
                        Cargando cursos...
                    </div>
                ) : courses.length === 0 ? (
                    <div className="cfc-empty">
                        No hay cursos activos para esta área.
                    </div>
                ) : (
                    <div className="cfc-courses">
                        {courses.map((course) => {
                            const checked = selectedCodes.includes(
                                course.code,
                            );

                            return (
                                <label
                                    key={`${course.area}-${course.code}`}
                                    className={
                                        `cfc-course ${checked ? 'selected' : ''}`
                                    }
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={busy}
                                        onChange={() => {
                                            toggleCourse(course.code);
                                        }}
                                    />

                                    <div className="cfc-course-info">
                                        <div className="cfc-course-main">
                                            <strong>{course.code}</strong>
                                            <span>{course.name}</span>
                                        </div>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                )}

                <div className="cfc-footer-actions">
                    <button
                        type="button"
                        className="cfc-primary"
                        disabled={
                            busy
                            || selectedCodes.length === 0
                        }
                        onClick={runPreview}
                    >
                        {previewing
                            ? '⏳ Buscando archivos...'
                            : 'Obtener vista previa'}
                    </button>
                </div>
            </section>

            {error && (
                <div
                    className="cfc-alert error"
                    role="alert"
                >
                    <strong>❌ Error</strong>
                    <p>{error}</p>
                </div>
            )}

            {sourceStatus && (
                <div
                    className={
                        `ccm-source ${sourceOk ? 'ok' : 'warning'}`
                    }
                >
                    <strong>
                        {sourceOk
                            ? '✅ Fuente disponible'
                            : '⚠️ No se pudo confirmar la fuente'}
                    </strong>

                    <p>
                        {sourceStatus.message
                            || `Docentes_${semester}_${year}_ y Auxiliares_${semester}_${year}_`}
                    </p>
                </div>
            )}

            {previewing && (
                <section className="cfc-card ccm-loading-panel">
                    <div className="ccm-spinner" />

                    <div>
                        <strong>
                            Consultando contactos y archivos
                        </strong>

                        <p>
                            Estamos comprobando Google Sheets y Google Drive.
                            Esta operación puede tardar algunos segundos.
                        </p>
                    </div>
                </section>
            )}

            {preview && !previewing && (
                <section className="cfc-result ccm-preview">
                    <div className="ccm-preview-heading">
                        <div>
                            <h3>3. Vista previa</h3>

                            <p>
                                Revisa el nombre y la ubicación de cada
                                archivo antes de actualizar.
                            </p>
                        </div>

                        <button
                            className="ccm-secondary"
                            type="button"
                            disabled={busy}
                            onClick={runPreview}
                        >
                            🔄 Volver a comprobar
                        </button>
                    </div>

                    <div className="cfc-result-grid">
                        <Result
                            label="Cursos"
                            value={
                                preview.summary?.courses_count
                                ?? previewCourses.length
                            }
                        />

                        <Result
                            label="Contactos"
                            value={
                                preview.summary?.contacts_count
                                ?? 0
                            }
                        />

                        <Result
                            label="Listos"
                            value={
                                preview.summary?.ready_files_count
                                ?? 0
                            }
                        />

                        <Result
                            label="Faltantes"
                            value={
                                preview.summary?.missing_files_count
                                ?? 0
                            }
                        />
                    </div>

                    {preview.warnings?.length > 0 && (
                        <div className="ccm-warning-list">
                            {preview.warnings.map((warning, index) => (
                                <p key={`${String(warning)}-${index}`}>
                                    ⚠️ {String(warning)}
                                </p>
                            ))}
                        </div>
                    )}

                    <div className="ccm-preview-list">
                        {previewCourses.map((course) => {
                            const state = courseState(course);

                            return (
                                <article
                                    key={course.code}
                                    className={`ccm-course-card ${state}`}
                                >
                                    <div className="ccm-course-card-header">
                                        <div>
                                            <strong>{course.code}</strong>
                                            <h4>{course.name}</h4>
                                        </div>

                                        <span
                                            className={`ccm-status ${state}`}
                                        >
                                            {STATE_LABELS[state]}
                                        </span>
                                    </div>

                                    <div className="ccm-counts">
                                        <Result
                                            label="Contactos"
                                            value={course.contacts_count ?? 0}
                                        />

                                        <Result
                                            label="Docentes"
                                            value={course.docentes_count ?? 0}
                                        />

                                        <Result
                                            label="Auxiliares"
                                            value={course.auxiliares_count ?? 0}
                                        />
                                    </div>

                                    <span className="ccm-label-text">
                                        Nombre exacto del archivo
                                    </span>

                                    <div className="ccm-copy-row">
                                        <code>
                                            {course.filename || '—'}
                                        </code>

                                        <button
                                            type="button"
                                            disabled={!course.filename}
                                            onClick={() => {
                                                copyName(course.filename);
                                            }}
                                        >
                                            {copied === course.filename
                                                ? '✓ Copiado'
                                                : 'Copiar nombre'}
                                        </button>
                                    </div>

                                    <span className="ccm-label-text">
                                        Ruta de Drive
                                    </span>

                                    <code className="ccm-path">
                                        {course.path || '—'}
                                    </code>

                                    <div className={`ccm-message ${state}`}>
                                        {state === 'file_required' && (
                                            <strong>
                                                Debes crear o subir este archivo
                                                manualmente.
                                            </strong>
                                        )}

                                        {state === 'folder_not_found' && (
                                            <strong>
                                                No se encontró la carpeta
                                                2_Contactos.
                                            </strong>
                                        )}

                                        <p>
                                            {course.message || 'Sin mensaje.'}
                                        </p>
                                    </div>

                                    <div className="ccm-links">
                                        {course.folder_link && (
                                            <a
                                                href={course.folder_link}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                📁 Abrir carpeta
                                            </a>
                                        )}

                                        {course.file_exists
                                            && course.file_link && (
                                                <a
                                                    href={course.file_link}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    📄 Abrir archivo
                                                </a>
                                            )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    <div
                        className={
                            `ccm-ready-panel ${allReady ? 'ready' : 'blocked'}`
                        }
                    >
                        <div>
                            <strong>
                                {allReady
                                    ? '✅ Todos los archivos están listos'
                                    : '⚠️ Aún faltan archivos'}
                            </strong>

                            <p>
                                {allReady
                                    ? 'Ya puedes actualizar los contactos.'
                                    : 'Crea los Excel faltantes y vuelve a comprobar.'}
                            </p>
                        </div>

                        <button
                            className="cfc-primary"
                            type="button"
                            disabled={busy || !allReady}
                            onClick={updateContacts}
                        >
                            {updating
                                ? '⏳ Actualizando...'
                                : 'Actualizar contactos'}
                        </button>
                    </div>
                </section>
            )}

            {updating && (
                <section className="cfc-card ccm-loading-panel">
                    <div className="ccm-spinner" />

                    <div>
                        <strong>
                            Actualizando contactos
                        </strong>

                        <p>
                            El backend está escribiendo sobre los Excel existentes.
                        </p>
                    </div>
                </section>
            )}

            {updateResult && !updating && (
                <section
                    className={
                        `cfc-result ${updateResult.success === false
                            ? 'warning'
                            : 'success'
                        }`
                    }
                >
                    <h3>
                        {updateResult.success === false
                            ? '⚠️ Actualización con errores'
                            : '✅ Contactos actualizados'}
                    </h3>

                    <p>
                        {updateResult.message || 'El proceso terminó.'}
                    </p>

                    <div className="cfc-result-grid">
                        <Result
                            label="Cursos procesados"
                            value={
                                updateSummary.courses_processed
                                ?? updateSummary.courses_count
                                ?? updateResult.courses?.length
                                ?? 0
                            }
                        />

                        <Result
                            label="Contactos procesados"
                            value={
                                updateSummary.contacts_processed
                                ?? updateSummary.contacts_count
                                ?? 0
                            }
                        />

                        <Result
                            label="Archivos actualizados"
                            value={
                                updateSummary.files_updated
                                ?? updateSummary.updated_files_count
                                ?? 0
                            }
                        />

                        <Result
                            label="Errores"
                            value={
                                updateSummary.errors_count
                                ?? updateSummary.error_count
                                ?? updateErrors.length
                            }
                        />
                    </div>

                    {updateErrors.length > 0 && (
                        <div className="ccm-errors">
                            <h4>Errores</h4>

                            {updateErrors.map((item, index) => (
                                <div key={`${item.code || 'error'}-${index}`}>
                                    <strong>
                                        Curso: {item.code || item.course_code || '—'}
                                    </strong>

                                    <code>
                                        {item.path || item.folder_path || '—'}
                                    </code>

                                    <p>
                                        {item.message
                                            || item.error
                                            || 'Error sin detalle'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="ccm-result-actions">
                        <button
                            type="button"
                            className="ccm-secondary"
                            disabled={busy}
                            onClick={runPreview}
                        >
                            🔄 Volver a comprobar archivos
                        </button>
                    </div>
                </section>
            )}
        </div>
    );
};

const Result = ({ label, value }) => (
    <div className="cfc-result-item">
        <span>{label}</span>
        <strong>{value ?? '—'}</strong>
    </div>
);

export default CourseContactsManager;