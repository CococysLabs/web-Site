import { useEffect, useState } from 'react';
import api from '../../services/api';
import './ActivityStructureValidator.css';

const ACTIVITY_LABELS = {
    proyectos: 'Proyectos',
    practicas: 'Prácticas',
    tareas: 'Tareas',
};

const SEVERITY_LABEL = {
    red: 'Falta material',
    orange: 'Incompleto',
    green: 'Completo',
};

const ActivityStructureValidator = () => {
    const [areas, setAreas] = useState([]);
    const [selectedArea, setSelectedArea] = useState('');

    const [semesters, setSemesters] = useState([]);
    const [selectedSemesterId, setSelectedSemesterId] = useState('');

    const [courses, setCourses] = useState([]);
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [selectedCourseName, setSelectedCourseName] = useState('');

    const [loadingAreas, setLoadingAreas] = useState(false);
    const [loadingSemesters, setLoadingSemesters] = useState(false);
    const [loadingCourses, setLoadingCourses] = useState(false);
    const [validating, setValidating] = useState(false);

    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

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

        const loadSemesters = async () => {
            try {
                setLoadingSemesters(true);
                setError(null);
                const response = await api.get('/api/validation/activities/semesters');
                const semesterList = response.data?.semesters || [];
                setSemesters(semesterList);
                if (semesterList.length > 0) {
                    setSelectedSemesterId(semesterList[0].id);
                }
            } catch (err) {
                setError(err.response?.data?.detail || err.message || 'No se pudieron cargar los semestres');
            } finally {
                setLoadingSemesters(false);
            }
        };

        loadAreas();
        loadSemesters();
    }, []);

    useEffect(() => {
        if (!selectedArea || !selectedSemesterId) return;

        const loadCourses = async () => {
            try {
                setLoadingCourses(true);
                setError(null);
                setResult(null);
                setCourses([]);
                setSelectedCourseId('');

                const response = await api.get('/api/validation/activities/courses', {
                    params: { semester_folder_id: selectedSemesterId, area: selectedArea },
                });
                const courseList = response.data?.courses || [];
                setCourses(courseList);
                if (courseList.length > 0) {
                    setSelectedCourseId(courseList[0].id);
                    setSelectedCourseName(courseList[0].name);
                }
            } catch (err) {
                setError(err.response?.data?.detail || err.message || 'No se pudieron cargar los cursos');
            } finally {
                setLoadingCourses(false);
            }
        };

        loadCourses();
    }, [selectedArea, selectedSemesterId]);

    const handleCourseChange = (courseId) => {
        setSelectedCourseId(courseId);
        const course = courses.find((c) => c.id === courseId);
        setSelectedCourseName(course?.name || '');
    };

    const handleValidate = async () => {
        if (!selectedCourseId) {
            setError('Selecciona un curso');
            return;
        }

        try {
            setValidating(true);
            setError(null);
            setResult(null);

            const response = await api.post('/api/validation/validate-activities', {
                course_folder_id: selectedCourseId,
                course_name: selectedCourseName,
            });

            setResult(response.data);
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'No se pudo validar el curso');
        } finally {
            setValidating(false);
        }
    };

    return (
        <div className="asv-container">
            <div className="asv-header">
                <div>
                    <h2>🗂️ Validar Proyectos, Prácticas y Tareas</h2>
                    <p>
                        Revisa que los documentos de un curso tengan la estructura requerida
                        (títulos obligatorios).
                    </p>
                </div>
            </div>

            <section className="asv-card">
                <h3>1. Selecciona el curso</h3>

                <div className="asv-selectors">
                    <label className="asv-label">
                        Semestre
                        <select
                            value={selectedSemesterId}
                            disabled={loadingSemesters || validating}
                            onChange={(e) => setSelectedSemesterId(e.target.value)}
                        >
                            {semesters.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </label>

                    <label className="asv-label">
                        Área
                        <select
                            value={selectedArea}
                            disabled={loadingAreas || validating}
                            onChange={(e) => setSelectedArea(e.target.value)}
                        >
                            {areas.map((a) => (
                                <option key={a.area} value={a.area}>{a.label || a.area}</option>
                            ))}
                        </select>
                    </label>

                    <label className="asv-label">
                        Curso
                        <select
                            value={selectedCourseId}
                            disabled={loadingCourses || validating || courses.length === 0}
                            onChange={(e) => handleCourseChange(e.target.value)}
                        >
                            {courses.length === 0 && <option value="">Sin cursos</option>}
                            {courses.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </label>
                </div>

                <button
                    type="button"
                    className="asv-primary"
                    disabled={validating || !selectedCourseId}
                    onClick={handleValidate}
                >
                    {validating ? '⏳ Validando...' : 'Validar curso'}
                </button>
            </section>

            {error && (
                <div className="asv-alert error">
                    <strong>❌ Error</strong>
                    <p>{typeof error === 'string' ? error : JSON.stringify(error)}</p>
                </div>
            )}

            {result && (
                <section className="asv-results">
                    {Object.entries(ACTIVITY_LABELS).map(([key, label]) => {
                        const activity = result.activities?.[key];
                        if (!activity) return null;

                        return (
                            <div key={key} className={`asv-activity-card ${activity.severity}`}>
                                <div className="asv-activity-header">
                                    <h4>{label}</h4>
                                    <span className={`asv-badge ${activity.severity}`}>
                                        {SEVERITY_LABEL[activity.severity] || activity.severity}
                                    </span>
                                </div>

                                {activity.reason && (
                                    <p className="asv-reason">{activity.reason}</p>
                                )}

                                {activity.files?.length > 0 && (
                                    <ul className="asv-file-list">
                                        {activity.files.map((file) => (
                                            <li key={file.file_id} className={`asv-file ${file.status}`}>
                                                <div className="asv-file-name">
                                                    {file.status === 'ok' ? '✅' : file.status === 'error' ? '⚠️' : '🟠'}{' '}
                                                    {file.web_view_link ? (
                                                        <a href={file.web_view_link} target="_blank" rel="noreferrer">
                                                            {file.file_name}
                                                        </a>
                                                    ) : (
                                                        file.file_name
                                                    )}
                                                    {file.subfolder && (
                                                        <span className="asv-subfolder"> ({file.subfolder})</span>
                                                    )}
                                                </div>

                                                {file.error && (
                                                    <p className="asv-file-error">{file.error}</p>
                                                )}

                                                {file.missing_titles?.length > 0 && (
                                                    <div className="asv-missing">
                                                        <span>Falta:</span>
                                                        <ul>
                                                            {file.missing_titles.map((title) => (
                                                                <li key={title}>{title}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        );
                    })}
                </section>
            )}
        </div>
    );
};

export default ActivityStructureValidator;
