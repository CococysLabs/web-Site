import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import './CourseFolderCreator.css';

const CURRENT_YEAR = new Date().getFullYear();

const SEMESTER_OPTIONS = [
    { value: '1S', label: 'Primer semestre - 1S' },
    { value: '2S', label: 'Segundo semestre - 2S' },
    { value: '3S', label: 'Tercer semestre - 3S' },
    { value: 'custom', label: 'Otro' },
];

const sanitizeCourseName = (value) => {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/&/g, ' y ')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
};

const CourseFolderCreator = () => {
    const [areas, setAreas] = useState([]);
    const [selectedArea, setSelectedArea] = useState('');
    const [courses, setCourses] = useState([]);
    const [selectedCodes, setSelectedCodes] = useState([]);

    const [semesterOption, setSemesterOption] = useState('1S');
    const [customSemester, setCustomSemester] = useState('');
    const [year, setYear] = useState(CURRENT_YEAR);

    const [csvFile, setCsvFile] = useState(null);

    const [loadingAreas, setLoadingAreas] = useState(false);
    const [loadingCourses, setLoadingCourses] = useState(false);
    const [creating, setCreating] = useState(false);

    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    const semester = useMemo(() => {
        if (semesterOption === 'custom') {
            return customSemester.trim();
        }
        return semesterOption;
    }, [semesterOption, customSemester]);

    const selectedCourses = useMemo(() => {
        return courses.filter((course) => selectedCodes.includes(course.code));
    }, [courses, selectedCodes]);

    const allSelected = courses.length > 0 && selectedCodes.length === courses.length;

    useEffect(() => {
        const loadAreas = async () => {
            try {
                setLoadingAreas(true);
                setError(null);

                const response = await api.get('/api/course-catalog/areas');
                const areaList = response.data?.areas || [];

                setAreas(areaList);

                if (areaList.length > 0) {
                    setSelectedArea(areaList[0].area);
                }
            } catch (err) {
                setError(err.response?.data?.detail || err.message || 'No se pudieron cargar las áreas');
            } finally {
                setLoadingAreas(false);
            }
        };

        loadAreas();
    }, []);

    useEffect(() => {
        if (!selectedArea) return;

        const loadCourses = async () => {
            try {
                setLoadingCourses(true);
                setError(null);
                setResult(null);

                const response = await api.get('/api/course-catalog', {
                    params: { area: selectedArea },
                });

                const courseList = response.data?.courses || [];

                setCourses(courseList);

                // Por defecto: todos los cursos del área seleccionada.
                setSelectedCodes(courseList.map((course) => course.code));
            } catch (err) {
                setError(err.response?.data?.detail || err.message || 'No se pudieron cargar los cursos');
                setCourses([]);
                setSelectedCodes([]);
            } finally {
                setLoadingCourses(false);
            }
        };

        loadCourses();
    }, [selectedArea]);

    const toggleCourse = (code) => {
        setSelectedCodes((current) => {
            if (current.includes(code)) {
                return current.filter((item) => item !== code);
            }
            return [...current, code];
        });
    };

    const selectAllCourses = () => {
        setSelectedCodes(courses.map((course) => course.code));
    };

    const clearCourses = () => {
        setSelectedCodes([]);
    };

    const handleCreate = async () => {
        if (!csvFile) {
            setError('Selecciona el archivo CSV de estructura');
            return;
        }

        if (!selectedArea) {
            setError('Selecciona un área');
            return;
        }

        if (selectedCodes.length === 0) {
            setError('Selecciona al menos un curso');
            return;
        }

        if (!semester) {
            setError('Indica el semestre, por ejemplo 1S, 2S o XS');
            return;
        }

        if (!year || Number(year) < 2000 || Number(year) > 2100) {
            setError('Indica un año válido');
            return;
        }

        try {
            setCreating(true);
            setError(null);
            setResult(null);

            const formData = new FormData();
            formData.append('file', csvFile);
            formData.append('area', selectedArea);
            formData.append('course_codes', JSON.stringify(selectedCodes));
            formData.append('semester', semester);
            formData.append('year', String(year));

            const response = await api.post('/api/drive-structures/create-courses', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setResult(response.data);
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'No se pudieron crear las carpetas');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="course-folder-creator">
            <div className="cfc-header">
                <div>
                    <h2>📁 Crear carpetas</h2>
                    <p>
                        Crea carpetas de cursos desde una plantilla CSV, usando el catálogo de cursos por área.
                    </p>
                </div>

                <div className="cfc-header-badge">
                    {selectedCodes.length} curso{selectedCodes.length === 1 ? '' : 's'} seleccionado{selectedCodes.length === 1 ? '' : 's'}
                </div>
            </div>

            <div className="cfc-grid">
                <section className="cfc-card">
                    <h3>1. Plantilla CSV</h3>
                    <p className="cfc-muted">
                        El CSV solo debe contener la tabla de carpetas y subcarpetas. El área y los cursos se seleccionan aquí.
                    </p>

                    <input
                        className="cfc-file"
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(event) => {
                            setCsvFile(event.target.files?.[0] || null);
                            setResult(null);
                            setError(null);
                        }}
                    />

                    {csvFile && (
                        <div className="cfc-file-selected">
                            Archivo seleccionado: <strong>{csvFile.name}</strong>
                        </div>
                    )}

                    <div className="cfc-example">
                        <strong>Ejemplo de CSV esperado:</strong>
                        <pre>{`No.,Carpeta,No.,Sub Carpeta
0,Revision_de_Material,,
1,Seguridad,,
2,Contactos,,
3,Planeacion_Curricular,,
4,Diagnostico,,
5,Contenidos,2,Semana_2
5,Contenidos,3,Semana_3
5,Contenidos,4,Semana_4
6,Proyectos,,
7,Practicas,,
8,Tareas,,
9,Evaluacion_Final,,
10,Programa,,`}</pre>
                    </div>
                </section>

                <section className="cfc-card">
                    <h3>2. Área, semestre y año</h3>

                    <label className="cfc-label">
                        Área
                        <select
                            value={selectedArea}
                            disabled={loadingAreas || creating}
                            onChange={(event) => setSelectedArea(event.target.value)}
                        >
                            {areas.map((area) => (
                                <option key={area.area} value={area.area}>
                                    {area.label || area.area}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="cfc-label">
                        Semestre
                        <select
                            value={semesterOption}
                            disabled={creating}
                            onChange={(event) => {
                                setSemesterOption(event.target.value);
                                setCustomSemester('');
                            }}
                        >
                            {SEMESTER_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    {semesterOption === 'custom' && (
                        <label className="cfc-label">
                            Texto de semestre
                            <input
                                type="text"
                                placeholder="Ejemplo: XS, 4S, INTENSIVO"
                                value={customSemester}
                                disabled={creating}
                                onChange={(event) => setCustomSemester(event.target.value)}
                            />
                        </label>
                    )}

                    <label className="cfc-label">
                        Año
                        <input
                            type="number"
                            value={year}
                            min="2000"
                            max="2100"
                            disabled={creating}
                            onChange={(event) => setYear(event.target.value)}
                        />
                    </label>
                </section>
            </div>

            <section className="cfc-card">
                <div className="cfc-section-title">
                    <div>
                        <h3>3. Cursos a crear</h3>
                        <p className="cfc-muted">
                            Por defecto se seleccionan todos los cursos del área. Puedes desmarcar los que no quieras crear.
                        </p>
                    </div>

                    <div className="cfc-actions-mini">
                        <button type="button" onClick={selectAllCourses} disabled={creating || courses.length === 0}>
                            Todos
                        </button>
                        <button type="button" onClick={clearCourses} disabled={creating || courses.length === 0}>
                            Ninguno
                        </button>
                    </div>
                </div>

                {loadingCourses ? (
                    <div className="cfc-loading">Cargando cursos...</div>
                ) : courses.length === 0 ? (
                    <div className="cfc-empty">No hay cursos activos para esta área.</div>
                ) : (
                    <div className="cfc-courses">
                        {courses.map((course) => {
                            const checked = selectedCodes.includes(course.code);
                            const folderPreview = `${course.code}_${sanitizeCourseName(course.name)}_${semester || 'SEM'}_${year || CURRENT_YEAR}`;

                            return (
                                <label
                                    key={`${course.area}-${course.code}`}
                                    className={`cfc-course ${checked ? 'selected' : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={creating}
                                        onChange={() => toggleCourse(course.code)}
                                    />

                                    <div className="cfc-course-info">
                                        <div className="cfc-course-main">
                                            <strong>{course.code}</strong>
                                            <span>{course.name}</span>
                                        </div>
                                        <code>{folderPreview}</code>
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
                        disabled={creating || !csvFile || !selectedArea || selectedCodes.length === 0}
                        onClick={handleCreate}
                    >
                        {creating ? '⏳ Creando carpetas...' : `Crear ${allSelected ? 'todos los cursos' : 'cursos seleccionados'}`}
                    </button>
                </div>
            </section>

            {error && (
                <div className="cfc-alert error">
                    <strong>❌ Error</strong>
                    <p>{typeof error === 'string' ? error : JSON.stringify(error)}</p>
                </div>
            )}

            {result && (
                <section className={`cfc-result ${result.success ? 'success' : 'warning'}`}>
                    <div className="cfc-result-header">
                        <div>
                            <h3>{result.success ? '✅ Carpetas creadas' : '⚠️ Proceso con errores'}</h3>
                            <p>{result.message}</p>
                        </div>
                    </div>

                    <div className="cfc-result-grid">
                        <ResultItem label="Área" value={result.area_folder_name || result.area} />
                        <ResultItem label="Semestre" value={result.semester} />
                        <ResultItem label="Año" value={result.year} />
                        <ResultItem label="Cursos" value={result.total_courses} />
                        <ResultItem label="Creadas" value={result.summary?.created_count || 0} />
                        <ResultItem label="Existentes" value={result.summary?.existing_count || 0} />
                        <ResultItem label="Errores" value={result.summary?.error_count || 0} />
                    </div>

                    {result.courses?.length > 0 && (
                        <details className="cfc-details" open>
                            <summary>Ver resultado por curso</summary>

                            <div className="cfc-course-results">
                                {result.courses.map((course) => (
                                    <div key={course.code} className={`cfc-course-result ${course.success ? 'ok' : 'fail'}`}>
                                        <div>
                                            <strong>{course.code} — {course.name}</strong>
                                            <code>{course.folder_name}</code>
                                        </div>

                                        <div className="cfc-course-result-stats">
                                            <span>Creadas: {course.created_count}</span>
                                            <span>Existentes: {course.existing_count}</span>
                                            <span>Errores: {course.error_count}</span>
                                        </div>

                                        {course.errors?.length > 0 && (
                                            <ul>
                                                {course.errors.map((item, index) => (
                                                    <li key={index}>
                                                        {item.path}: {item.error}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}

                    {result.error_details?.length > 0 && (
                        <details className="cfc-details" open>
                            <summary>Ver errores generales</summary>
                            <ul>
                                {result.error_details.map((item, index) => (
                                    <li key={index}>
                                        {item.path}: {item.error}
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                </section>
            )}
        </div>
    );
};

const ResultItem = ({ label, value }) => (
    <div className="cfc-result-item">
        <span>{label}</span>
        <strong>{value ?? '—'}</strong>
    </div>
);

export default CourseFolderCreator;