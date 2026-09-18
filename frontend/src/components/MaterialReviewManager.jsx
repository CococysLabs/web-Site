import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import api from '../services/api';
import './CurriculumFeedbackManager.css';


const ACTIVITY_TYPE_LABELS = {
    proyectos: 'Proyectos',
    practicas: 'Prácticas',
    tareas: 'Tareas',
};


const activityCourseKey = (course) => (
    `${course.area}::${course.folder_id}`
);


const getErrorMessage = (
    error,
    fallback = 'Ocurrió un error inesperado.',
) => {
    const detail = error?.response?.data?.detail;

    if (typeof detail === 'string') {
        return detail;
    }

    if (detail) {
        try {
            return JSON.stringify(detail);
        } catch {
            return fallback;
        }
    }

    return error?.message || fallback;
};


const MaterialReviewManager = () => {
    const mountedRef = useRef(true);

    const [areas, setAreas] = useState([]);
    const [loadingAreas, setLoadingAreas] = useState(false);

    // ---- Fase 2: Proyectos, Practicas y Tareas ----
    // Selección propia: Semestre → Área → Curso, leídos directo de
    // Drive (igual que el validador de estructura de Proyectos/
    // Practicas/Tareas), no del catálogo de cursos.
    const [activitySemesters, setActivitySemesters] = useState([]);
    const [loadingActivitySemesters, setLoadingActivitySemesters] = useState(false);
    const [selectedActivitySemesterId, setSelectedActivitySemesterId] = useState('');

    const [activityArea, setActivityArea] = useState('');

    const [activityCourseOptions, setActivityCourseOptions] = useState([]);
    const [loadingActivityCourses, setLoadingActivityCourses] = useState(false);
    const [selectedActivityCourseIds, setSelectedActivityCourseIds] = useState([]);

    // Qué tipo(s) analizar por corrida — separarlos reduce el tiempo
    // por petición y la carga sobre la IA.
    const [selectedActivityTypes, setSelectedActivityTypes] = useState(
        Object.keys(ACTIVITY_TYPE_LABELS),
    );

    // Archivos reales de cada carpeta (Proyectos/Practicas/Tareas) por
    // curso, para poder elegir cuáles analizar en vez de la carpeta
    // completa. Clave: `${folder_id}::${activity_type}`.
    const [activityFileGroups, setActivityFileGroups] = useState({});

    const [activityPreview, setActivityPreview] = useState(null);
    const [activityPreviewFingerprint, setActivityPreviewFingerprint] = useState('');

    const [activityChecking, setActivityChecking] = useState(false);
    const [activityProcessing, setActivityProcessing] = useState(false);

    const [activityJobs, setActivityJobs] = useState({});

    const [activityError, setActivityError] = useState(null);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
        };
    }, []);


    const selectedActivityCourses = useMemo(
        () => (
            activityCourseOptions
                .filter(
                    (course) => selectedActivityCourseIds.includes(course.id),
                )
                .map(
                    (course) => ({
                        folder_id: course.id,
                        name: course.name,
                        area: activityArea,
                    }),
                )
        ),
        [
            activityCourseOptions,
            selectedActivityCourseIds,
            activityArea,
        ],
    );


    const activitySelectionFingerprint = useMemo(
        () => (
            JSON.stringify({
                semesterId: selectedActivitySemesterId,
                area: activityArea,
                courses: selectedActivityCourseIds.slice().sort(),
            })
        ),
        [
            selectedActivitySemesterId,
            activityArea,
            selectedActivityCourseIds,
        ],
    );


    const invalidateActivityPreview = () => {
        setActivityPreview(null);
        setActivityPreviewFingerprint('');
        setActivityJobs({});
        setActivityError(null);
    };


    const activityPreviewIsCurrent = (
        activityPreview
        && activityPreviewFingerprint === activitySelectionFingerprint
    );


    const activityReadyCourses = useMemo(() => {
        if (!activityPreviewIsCurrent) {
            return [];
        }

        return (
            activityPreview.courses?.filter(
                (course) => course.ready_for_write,
            )
            || []
        );
    }, [
        activityPreview,
        activityPreviewIsCurrent,
    ]);


    const activityJobValues = Object.values(activityJobs);

    const activityCompletedJobs = activityJobValues.filter(
        (item) => item.status === 'completed',
    ).length;

    const activityFailedJobs = activityJobValues.filter(
        (item) => item.status === 'failed',
    ).length;


    // ========================================================
    // ÁREAS (mismo catálogo que usa Planeación Curricular)
    // ========================================================

    useEffect(() => {
        const loadAreas = async () => {
            try {
                setLoadingAreas(true);
                setActivityError(null);

                const response = await api.get(
                    '/api/course-catalog/areas',
                );

                const areaList = (
                    response.data?.areas
                    || []
                );

                if (!mountedRef.current) {
                    return;
                }

                setAreas(areaList);
            } catch (requestError) {
                if (!mountedRef.current) {
                    return;
                }

                setActivityError(
                    getErrorMessage(
                        requestError,
                        'No se pudieron cargar las áreas.',
                    ),
                );
            } finally {
                if (mountedRef.current) {
                    setLoadingAreas(false);
                }
            }
        };

        loadAreas();
    }, []);


    // ========================================================
    // FASE 2 — SEMESTRES (desde Recursos Educativos en Drive)
    // ========================================================

    useEffect(() => {
        const loadActivitySemesters = async () => {
            try {
                setLoadingActivitySemesters(true);
                setActivityError(null);

                const response = await api.get(
                    '/api/validation/activities/semesters',
                );

                const semesterList = response.data?.semesters || [];

                if (!mountedRef.current) {
                    return;
                }

                setActivitySemesters(semesterList);

                if (semesterList.length > 0) {
                    setSelectedActivitySemesterId(semesterList[0].id);
                }
            } catch (requestError) {
                if (!mountedRef.current) {
                    return;
                }

                setActivityError(
                    getErrorMessage(
                        requestError,
                        'No se pudieron cargar los semestres disponibles en Recursos Educativos.',
                    ),
                );
            } finally {
                if (mountedRef.current) {
                    setLoadingActivitySemesters(false);
                }
            }
        };

        loadActivitySemesters();
    }, []);


    useEffect(() => {
        if (!activityArea && areas.length > 0) {
            setActivityArea(areas[0].area);
        }
    }, [areas, activityArea]);


    // ========================================================
    // FASE 2 — CURSOS (dentro del semestre + área seleccionados)
    // ========================================================

    useEffect(() => {
        if (!selectedActivitySemesterId || !activityArea) {
            setActivityCourseOptions([]);
            return;
        }

        const loadActivityCourses = async () => {
            try {
                setLoadingActivityCourses(true);
                setActivityError(null);
                setActivityCourseOptions([]);
                setSelectedActivityCourseIds([]);
                invalidateActivityPreview();

                const response = await api.get(
                    '/api/validation/activities/courses',
                    {
                        params: {
                            semester_folder_id: selectedActivitySemesterId,
                            area: activityArea,
                        },
                    },
                );

                if (!mountedRef.current) {
                    return;
                }

                setActivityCourseOptions(response.data?.courses || []);
            } catch (requestError) {
                if (!mountedRef.current) {
                    return;
                }

                setActivityError(
                    getErrorMessage(
                        requestError,
                        'No se pudieron cargar los cursos de esta área/semestre.',
                    ),
                );
            } finally {
                if (mountedRef.current) {
                    setLoadingActivityCourses(false);
                }
            }
        };

        loadActivityCourses();
    }, [selectedActivitySemesterId, activityArea]);


    const toggleActivityCourse = (courseId) => {
        if (activityProcessing) {
            return;
        }

        setSelectedActivityCourseIds((current) => {
            if (current.includes(courseId)) {
                return current.filter((id) => id !== courseId);
            }

            return [...current, courseId];
        });

        invalidateActivityPreview();
    };


    const selectAllActivityCourses = () => {
        if (activityProcessing) {
            return;
        }

        setSelectedActivityCourseIds(
            activityCourseOptions.map((course) => course.id),
        );

        invalidateActivityPreview();
    };


    const clearActivityCourses = () => {
        if (activityProcessing) {
            return;
        }

        setSelectedActivityCourseIds([]);
        invalidateActivityPreview();
    };


    const toggleActivityType = (typeKey) => {
        if (activityProcessing) {
            return;
        }

        setSelectedActivityTypes((current) => {
            if (current.includes(typeKey)) {
                return current.filter((key) => key !== typeKey);
            }

            return [...current, typeKey];
        });
    };


    // ---- Fase 2: archivos reales por carpeta (Proyectos/Practicas/Tareas) ----

    const activityFileGroupKey = (course, typeKey) => (
        `${course.folder_id}::${typeKey}`
    );


    const loadActivityFiles = async (course, typeKey) => {
        const groupKey = activityFileGroupKey(course, typeKey);

        setActivityFileGroups((current) => ({
            ...current,
            [groupKey]: {
                loading: true,
                error: null,
                files: current[groupKey]?.files || [],
                selectedIds: current[groupKey]?.selectedIds || [],
            },
        }));

        try {
            const response = await api.get(
                '/api/activity-content-analysis/files',
                {
                    params: {
                        course_folder_id: course.folder_id,
                        activity_type: typeKey,
                    },
                },
            );

            const files = response.data?.files || [];

            if (!mountedRef.current) {
                return;
            }

            setActivityFileGroups((current) => ({
                ...current,
                [groupKey]: {
                    loading: false,
                    error: null,
                    files,
                    // Por defecto, todos seleccionados — mismo
                    // comportamiento que analizar la carpeta completa.
                    selectedIds: files.map((f) => f.id),
                },
            }));
        } catch (requestError) {
            if (!mountedRef.current) {
                return;
            }

            setActivityFileGroups((current) => ({
                ...current,
                [groupKey]: {
                    loading: false,
                    error: getErrorMessage(
                        requestError,
                        'No se pudieron cargar los archivos.',
                    ),
                    files: [],
                    selectedIds: [],
                },
            }));
        }
    };


    useEffect(() => {
        if (!activityPreviewIsCurrent) {
            return;
        }

        // Secuencial, no en paralelo: el cliente de Google Drive del
        // backend no soporta peticiones concurrentes desde el mismo
        // proceso — lanzarlas todas juntas corrompe la conexión SSL
        // compartida y las llamadas a Drive fallan en silencio.
        let cancelled = false;

        const loadSequentially = async () => {
            for (const course of activityReadyCourses) {
                for (const typeKey of selectedActivityTypes) {
                    if (cancelled) {
                        return;
                    }

                    const groupKey = activityFileGroupKey(course, typeKey);

                    if (!activityFileGroups[groupKey]) {
                        await loadActivityFiles(course, typeKey);
                    }
                }
            }
        };

        loadSequentially();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        activityPreviewIsCurrent,
        activityReadyCourses,
        selectedActivityTypes,
    ]);


    const toggleActivityFile = (course, typeKey, fileId) => {
        if (activityProcessing) {
            return;
        }

        const groupKey = activityFileGroupKey(course, typeKey);

        setActivityFileGroups((current) => {
            const group = current[groupKey];

            if (!group) {
                return current;
            }

            const selectedIds = group.selectedIds.includes(fileId)
                ? group.selectedIds.filter((id) => id !== fileId)
                : [...group.selectedIds, fileId];

            return {
                ...current,
                [groupKey]: { ...group, selectedIds },
            };
        });
    };


    const selectAllActivityFiles = (course, typeKey) => {
        if (activityProcessing) {
            return;
        }

        const groupKey = activityFileGroupKey(course, typeKey);

        setActivityFileGroups((current) => {
            const group = current[groupKey];

            if (!group) {
                return current;
            }

            return {
                ...current,
                [groupKey]: {
                    ...group,
                    selectedIds: group.files.map((f) => f.id),
                },
            };
        });
    };


    const clearActivityFiles = (course, typeKey) => {
        if (activityProcessing) {
            return;
        }

        const groupKey = activityFileGroupKey(course, typeKey);

        setActivityFileGroups((current) => {
            const group = current[groupKey];

            if (!group) {
                return current;
            }

            return {
                ...current,
                [groupKey]: { ...group, selectedIds: [] },
            };
        });
    };


    // ========================================================
    // FASE 2 — PREVIEW
    // ========================================================

    const handleActivityPreview = async () => {
        if (selectedActivityCourses.length === 0) {
            setActivityError('Selecciona al menos un curso.');
            return;
        }

        try {
            setActivityChecking(true);
            setActivityError(null);
            setActivityPreview(null);
            setActivityJobs({});

            const response = await api.post(
                '/api/activity-content-analysis/preview',
                {
                    courses: selectedActivityCourses.map((course) => ({
                        folder_id: course.folder_id,
                        name: course.name,
                        area: course.area,
                    })),
                },
            );

            if (!mountedRef.current) {
                return;
            }

            setActivityPreview(response.data);
            setActivityPreviewFingerprint(activitySelectionFingerprint);
        } catch (requestError) {
            if (!mountedRef.current) {
                return;
            }

            setActivityError(
                getErrorMessage(
                    requestError,
                    'No se pudo comprobar Proyectos/Practicas/Tareas.',
                ),
            );
        } finally {
            if (mountedRef.current) {
                setActivityChecking(false);
            }
        }
    };


    // ========================================================
    // FASE 2 — JOB
    // ========================================================

    const updateActivityJob = (key, patch) => {
        if (!mountedRef.current) {
            return;
        }

        setActivityJobs(
            (current) => ({
                ...current,
                [key]: {
                    ...current[key],
                    ...patch,
                },
            }),
        );
    };


    const processActivityCourse = async (course) => {
        const key = activityCourseKey(course);

        updateActivityJob(key, {
            course,
            status: 'processing',
            progress: 50,
            result: null,
            error: null,
        });

        try {
            const selectedFileIds = {};

            selectedActivityTypes.forEach((typeKey) => {
                const group = activityFileGroups[
                    activityFileGroupKey(course, typeKey)
                ];

                if (group) {
                    selectedFileIds[typeKey] = group.selectedIds;
                }
            });

            const response = await api.post(
                '/api/activity-content-analysis/analyze-course',
                {
                    course_folder_id: course.folder_id,
                    course_name: course.name,
                    area: course.area,
                    write_output: true,
                    activity_types: selectedActivityTypes,
                    selected_file_ids: selectedFileIds,
                },
            );

            updateActivityJob(key, {
                status: 'completed',
                progress: 100,
                result: response.data,
                error: null,
            });

            return response.data;
        } catch (requestError) {
            updateActivityJob(key, {
                status: 'failed',
                progress: 100,
                error: getErrorMessage(
                    requestError,
                    'No se pudo procesar el curso.',
                ),
            });

            return null;
        }
    };


    const handleActivityGenerate = async () => {
        if (!activityPreviewIsCurrent) {
            setActivityError(
                'Debes comprobar nuevamente los archivos antes de generar las observaciones.',
            );
            return;
        }

        if (activityReadyCourses.length === 0) {
            setActivityError(
                'No hay cursos listos para generar observaciones.',
            );
            return;
        }

        if (selectedActivityTypes.length === 0) {
            setActivityError(
                'Selecciona al menos un tipo de actividad (Proyectos, Prácticas o Tareas).',
            );
            return;
        }

        try {
            setActivityProcessing(true);
            setActivityError(null);
            setActivityJobs({});

            for (const course of activityReadyCourses) {
                await processActivityCourse(course);
            }
        } finally {
            if (mountedRef.current) {
                setActivityProcessing(false);
            }
        }
    };


    const retryActivityCourse = async (course) => {
        if (activityProcessing) {
            return;
        }

        try {
            setActivityProcessing(true);

            await processActivityCourse(course);
        } finally {
            if (mountedRef.current) {
                setActivityProcessing(false);
            }
        }
    };


    return (
        <div className="cfm-container">
            <div className="cfm-header cfm-phase2-header">
                <div>
                    <span className="cfm-phase-badge">
                        Fase 2
                    </span>

                    <h2>
                        Proyectos, Prácticas y Tareas
                    </h2>

                    <p>
                        Compara los documentos reales de Proyectos,
                        Prácticas y Tareas con la Planeación Curricular
                        del curso, y registra el resultado en las hojas
                        correspondientes de la matriz de observaciones.
                        Elige semestre, área y curso desde Recursos
                        Educativos.
                    </p>
                </div>
            </div>

            <section className="cfm-card">
                <div className="cfm-section-heading">
                    <div>
                        <span className="cfm-step">
                            5
                        </span>

                        <div>
                            <h3>
                                Semestre, área y curso
                            </h3>

                            <p>
                                Se leen directo de la carpeta "Recursos
                                Educativos" en Drive — igual que el
                                validador de estructura de Proyectos,
                                Prácticas y Tareas.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="cfm-form-grid">
                    <label className="cfm-field">
                        <span>
                            Semestre
                        </span>

                        <select
                            value={selectedActivitySemesterId}
                            disabled={
                                loadingActivitySemesters
                                || activityProcessing
                            }
                            onChange={(event) => {
                                setSelectedActivitySemesterId(
                                    event.target.value,
                                );
                            }}
                        >
                            {loadingActivitySemesters && (
                                <option value="">
                                    Cargando semestres...
                                </option>
                            )}

                            {!loadingActivitySemesters
                                && activitySemesters.length === 0 && (
                                <option value="">
                                    No hay semestres disponibles
                                </option>
                            )}

                            {activitySemesters.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="cfm-field">
                        <span>
                            Área
                        </span>

                        <select
                            value={activityArea}
                            disabled={
                                loadingAreas
                                || activityProcessing
                                || areas.length === 0
                            }
                            onChange={(event) => {
                                setActivityArea(event.target.value);
                            }}
                        >
                            {areas.map((item) => (
                                <option key={item.area} value={item.area}>
                                    {item.area}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="cfm-section-heading">
                    <div>
                        <div>
                            <h3>
                                Cursos
                            </h3>

                            <p>
                                Cursos encontrados en el semestre y área
                                seleccionados.
                            </p>
                        </div>
                    </div>

                    <div className="cfm-mini-actions">
                        <button
                            type="button"
                            disabled={
                                activityProcessing
                                || activityCourseOptions.length === 0
                            }
                            onClick={selectAllActivityCourses}
                        >
                            Todos
                        </button>

                        <button
                            type="button"
                            disabled={
                                activityProcessing
                                || activityCourseOptions.length === 0
                            }
                            onClick={clearActivityCourses}
                        >
                            Ninguno
                        </button>
                    </div>
                </div>

                {loadingActivityCourses ? (
                    <div className="cfm-placeholder">
                        Cargando cursos...
                    </div>
                ) : activityCourseOptions.length === 0 ? (
                    <div className="cfm-placeholder">
                        No hay cursos en este semestre/área.
                    </div>
                ) : (
                    <div className="cfm-course-grid">
                        {activityCourseOptions.map((course) => {
                            const checked = selectedActivityCourseIds.includes(
                                course.id,
                            );

                            return (
                                <label
                                    key={course.id}
                                    className={
                                        `cfm-course-option ${checked ? 'selected' : ''}`
                                    }
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={activityProcessing}
                                        onChange={() => {
                                            toggleActivityCourse(course.id);
                                        }}
                                    />

                                    <div>
                                        <div className="cfm-course-title">
                                            <span>
                                                {course.name}
                                            </span>
                                        </div>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                )}

                <div className="cfm-selection-footer">
                    <span>
                        {selectedActivityCourseIds.length}
                        {' de '}
                        {activityCourseOptions.length}
                        {' cursos seleccionados'}
                    </span>
                </div>
            </section>

            <section className="cfm-card">
                <div className="cfm-section-heading">
                    <div>
                        <span className="cfm-step">
                            6
                        </span>

                        <div>
                            <h3>
                                Comprobar archivos
                            </h3>

                            <p>
                                Se verificarán las carpetas de Proyectos,
                                Prácticas y Tareas, y la Planeación
                                Curricular de los cursos seleccionados.
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    className="cfm-primary-button"
                    disabled={
                        activityChecking
                        || activityProcessing
                        || selectedActivityCourses.length === 0
                    }
                    onClick={handleActivityPreview}
                >
                    {activityChecking
                        ? 'Comprobando archivos...'
                        : 'Comprobar cursos'}
                </button>

                {activityPreviewIsCurrent && (
                    <div className="cfm-preview">
                        <div className="cfm-summary-grid">
                            <Summary
                                label="Seleccionados"
                                value={
                                    activityPreview.summary
                                        ?.total_courses
                                    || 0
                                }
                            />

                            <Summary
                                label="Listos para procesar"
                                value={
                                    activityPreview.summary
                                        ?.ready_for_write
                                    || 0
                                }
                                tone="success"
                            />

                            <Summary
                                label="Listos para analizar"
                                value={
                                    activityPreview.summary
                                        ?.ready_for_analysis
                                    || 0
                                }
                            />

                            <Summary
                                label="Con errores"
                                value={
                                    activityPreview.summary
                                        ?.with_errors
                                    || 0
                                }
                                tone="danger"
                            />
                        </div>

                        <div className="cfm-preview-list">
                            {activityPreview.courses?.map(
                                (course) => (
                                    <ActivityPreviewCourse
                                        key={activityCourseKey(course)}
                                        course={course}
                                    />
                                ),
                            )}
                        </div>
                    </div>
                )}
            </section>

            {activityPreviewIsCurrent && (
                <section className="cfm-card">
                    <div className="cfm-section-heading">
                        <div>
                            <span className="cfm-step">
                                7
                            </span>

                            <div>
                                <h3>
                                    Generar observaciones
                                </h3>

                                <p>
                                    Los cursos listos se procesarán uno
                                    por uno. Los resultados se escribirán
                                    automáticamente en las hojas
                                    "Proyectos", "Practicas" y "Tareas"
                                    de 02_Matriz observaciones estructura.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="cfm-activity-type-picker">
                        <span>
                            Qué analizar
                        </span>

                        <div className="cfm-activity-type-options">
                            {Object.entries(ACTIVITY_TYPE_LABELS).map(
                                ([key, label]) => (
                                    <label key={key}>
                                        <input
                                            type="checkbox"
                                            checked={
                                                selectedActivityTypes.includes(key)
                                            }
                                            disabled={activityProcessing}
                                            onChange={() => {
                                                toggleActivityType(key);
                                            }}
                                        />

                                        {label}
                                    </label>
                                ),
                            )}
                        </div>

                        <small>
                            Analizar por separado reduce el tiempo de
                            espera y la carga sobre la IA.
                        </small>
                    </div>

                    {selectedActivityTypes.length > 0
                        && activityReadyCourses.map((course) => (
                            <div
                                key={activityCourseKey(course)}
                                className="cfm-activity-file-picker"
                            >
                                <span className="cfm-activity-file-picker-course">
                                    {course.name}
                                </span>

                                {selectedActivityTypes.map((typeKey) => {
                                    const group = activityFileGroups[
                                        activityFileGroupKey(course, typeKey)
                                    ];

                                    return (
                                        <div
                                            key={typeKey}
                                            className="cfm-activity-file-group"
                                        >
                                            <div className="cfm-section-heading">
                                                <div>
                                                    <h4>
                                                        {ACTIVITY_TYPE_LABELS[typeKey]
                                                            || typeKey}
                                                    </h4>
                                                </div>

                                                <div className="cfm-mini-actions">
                                                    <button
                                                        type="button"
                                                        disabled={
                                                            activityProcessing
                                                            || !group?.files?.length
                                                        }
                                                        onClick={() => {
                                                            selectAllActivityFiles(
                                                                course,
                                                                typeKey,
                                                            );
                                                        }}
                                                    >
                                                        Todos
                                                    </button>

                                                    <button
                                                        type="button"
                                                        disabled={
                                                            activityProcessing
                                                            || !group?.files?.length
                                                        }
                                                        onClick={() => {
                                                            clearActivityFiles(
                                                                course,
                                                                typeKey,
                                                            );
                                                        }}
                                                    >
                                                        Ninguno
                                                    </button>
                                                </div>
                                            </div>

                                            {!group || group.loading ? (
                                                <div className="cfm-placeholder">
                                                    Cargando archivos...
                                                </div>
                                            ) : group.error ? (
                                                <div className="cfm-blocked-message">
                                                    {group.error}
                                                </div>
                                            ) : group.files.length === 0 ? (
                                                <div className="cfm-placeholder">
                                                    No hay archivos en esta
                                                    carpeta.
                                                </div>
                                            ) : (
                                                <div className="cfm-activity-file-list">
                                                    {group.files.map((file) => {
                                                        const checked = (
                                                            group.selectedIds
                                                                .includes(file.id)
                                                        );

                                                        return (
                                                            <label
                                                                key={file.id}
                                                                className={
                                                                    `cfm-activity-file-option ${
                                                                        checked ? 'selected' : ''
                                                                    } ${
                                                                        file.supported
                                                                            ? ''
                                                                            : 'unsupported'
                                                                    }`
                                                                }
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    disabled={activityProcessing}
                                                                    onChange={() => {
                                                                        toggleActivityFile(
                                                                            course,
                                                                            typeKey,
                                                                            file.id,
                                                                        );
                                                                    }}
                                                                />

                                                                <span>
                                                                    {file.name}
                                                                </span>

                                                                {!file.supported && (
                                                                    <small>
                                                                        (formato no
                                                                        analizable)
                                                                    </small>
                                                                )}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}

                    {activityReadyCourses.length === 0 ? (
                        <div className="cfm-blocked-message">
                            Ninguno de los cursos seleccionados está
                            listo para generar y escribir las
                            observaciones.
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="cfm-generate-button"
                            disabled={
                                activityProcessing
                                || selectedActivityTypes.length === 0
                            }
                            onClick={handleActivityGenerate}
                        >
                            {activityProcessing
                                ? 'Procesando cursos...'
                                : (
                                    activityReadyCourses.length === 1
                                        ? 'Generar observaciones'
                                        : `Generar observaciones de ${activityReadyCourses.length} cursos`
                                )}
                        </button>
                    )}

                    {activityJobValues.length > 0 && (
                        <div className="cfm-job-area">
                            <div className="cfm-job-summary">
                                <div>
                                    <strong>
                                        {activityCompletedJobs}
                                    </strong>

                                    <span>
                                        completados
                                    </span>
                                </div>

                                <div>
                                    <strong>
                                        {activityFailedJobs}
                                    </strong>

                                    <span>
                                        con error
                                    </span>
                                </div>

                                <div>
                                    <strong>
                                        {activityJobValues.length}
                                    </strong>

                                    <span>
                                        iniciados
                                    </span>
                                </div>
                            </div>

                            <div className="cfm-jobs">
                                {activityReadyCourses.map(
                                    (course) => {
                                        const job = activityJobs[
                                            activityCourseKey(course)
                                        ];

                                        if (!job) {
                                            return (
                                                <QueuedCourse
                                                    key={activityCourseKey(course)}
                                                    course={course}
                                                />
                                            );
                                        }

                                        return (
                                            <ActivityJobCourse
                                                key={activityCourseKey(course)}
                                                course={course}
                                                job={job}
                                                disabled={activityProcessing}
                                                onRetry={() => {
                                                    retryActivityCourse(
                                                        course,
                                                    );
                                                }}
                                            />
                                        );
                                    },
                                )}
                            </div>
                        </div>
                    )}
                </section>
            )}

            {activityError && (
                <div className="cfm-alert error">
                    <strong>
                        Error
                    </strong>

                    <p>
                        {activityError}
                    </p>
                </div>
            )}
        </div>
    );
};


// ============================================================
// CURSO AÚN NO INICIADO
// ============================================================

const QueuedCourse = ({
    course,
}) => (
    <article className="cfm-job-card waiting">
        <div className="cfm-job-card-header">
            <div>
                {course.code && (
                    <strong>
                        {course.code}
                    </strong>
                )}

                <span>
                    {course.name}
                </span>
            </div>

            <span className="cfm-job-status waiting">
                Pendiente
            </span>
        </div>

        <p className="cfm-job-muted">
            Esperando que finalice el curso anterior.
        </p>
    </article>
);


// ============================================================
// SUMMARY
// ============================================================

const Summary = ({
    label,
    value,
    tone = '',
}) => (
    <div
        className={
            `cfm-summary ${tone}`
        }
    >
        <strong>
            {value}
        </strong>

        <span>
            {label}
        </span>
    </div>
);


// ============================================================
// PREVIEW POR CURSO
// ============================================================

const ActivityPreviewCourse = ({
    course,
}) => {
    let state = 'ready';
    let stateLabel = 'Listo';

    if (!course.success) {
        state = 'blocked';
        stateLabel = 'Error';
    } else if (!course.ready_for_analysis) {
        state = 'blocked';
        stateLabel = 'Sin planeación ni documentos';
    } else if (!course.ready_for_write) {
        state = 'blocked';
        stateLabel = 'Sin matriz de observaciones';
    }

    const activities = course.activities || {};

    return (
        <article
            className={
                `cfm-preview-course ${state}`
            }
        >
            <div className="cfm-preview-course-header">
                <div>
                    <h4>
                        {course.name}
                    </h4>

                    <small>
                        {course.area}
                    </small>
                </div>

                <span
                    className={
                        `cfm-status ${state}`
                    }
                >
                    {stateLabel}
                </span>
            </div>

            {course.error && (
                <div className="cfm-course-error">
                    {course.error}
                </div>
            )}

            {course.success && (
                <div className="cfm-files">
                    <div
                        className={
                            `cfm-file ${course.planning_found ? 'found' : 'missing'}`
                        }
                    >
                        <span className="cfm-file-indicator" />

                        <div>
                            <strong>
                                5_Diseño_Curricular
                            </strong>

                            <small>
                                {course.planning_found
                                    ? 'Encontrado'
                                    : 'No encontrado — obligatorio'}
                            </small>
                        </div>
                    </div>

                    <div
                        className={
                            `cfm-file ${course.matrix_found ? 'found' : 'missing'}`
                        }
                    >
                        <span className="cfm-file-indicator" />

                        <div>
                            <strong>
                                02_Matriz observaciones estructura
                            </strong>

                            <small>
                                {course.matrix_found
                                    ? 'Encontrado'
                                    : 'No encontrado — obligatorio'}
                            </small>
                        </div>
                    </div>

                    {Object.entries(activities).map(
                        ([key, info]) => (
                            <div
                                key={key}
                                className={
                                    `cfm-file ${info.folder_found ? 'found' : 'optional'}`
                                }
                            >
                                <span className="cfm-file-indicator" />

                                <div>
                                    <strong>
                                        {ACTIVITY_TYPE_LABELS[key] || info.label}
                                    </strong>

                                    <small>
                                        {info.folder_found
                                            ? (
                                                `${info.document_count} documento${
                                                    info.document_count === 1 ? '' : 's'
                                                }`
                                            )
                                            : 'Carpeta no encontrada'}
                                    </small>
                                </div>
                            </div>
                        ),
                    )}
                </div>
            )}
        </article>
    );
};


// ============================================================
// JOB POR CURSO
// ============================================================

const ActivityJobCourse = ({
    course,
    job,
    disabled,
    onRetry,
}) => {
    const result = job.result;
    const activities = result?.activities || {};

    const statusLabel = {
        processing: 'Procesando',
        completed: 'Completado',
        failed: 'Error',
    }[job.status] || job.status;

    return (
        <article
            className={
                `cfm-job-card ${job.status}`
            }
        >
            <div className="cfm-job-card-header">
                <div>
                    <strong>
                        {course.name}
                    </strong>

                    <span>
                        {course.area}
                    </span>
                </div>

                <span
                    className={
                        `cfm-job-status ${job.status}`
                    }
                >
                    {statusLabel}
                </span>
            </div>

            <div className="cfm-progress-track">
                <div
                    className="cfm-progress-value"
                    style={{
                        width: `${Math.max(
                            0,
                            Math.min(100, job.progress || 0),
                        )}%`,
                    }}
                />
            </div>

            {job.status === 'processing' && (
                <p className="cfm-job-muted">
                    Analizando Proyectos, Prácticas y Tareas.
                    Puedes continuar utilizando el sistema.
                </p>
            )}

            {job.status === 'failed' && (
                <div className="cfm-job-error">
                    <p>
                        {job.error || 'El curso no pudo procesarse.'}
                    </p>

                    <button
                        type="button"
                        disabled={disabled}
                        onClick={onRetry}
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {job.status === 'completed' && (
                <>
                    <div className="cfm-completed-info">
                        <div>
                            <span>
                                Campos escritos
                            </span>

                            <strong>
                                {result?.fields_written ?? 0}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Matriz actualizada
                            </span>

                            <strong>
                                {result?.matrix_updated ? 'Sí' : 'No'}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Proveedor
                            </span>

                            <strong>
                                {result?.provider?.name || '—'}
                            </strong>
                        </div>
                    </div>

                    {result?.matrix?.webViewLink && (
                        <div className="cfm-matrix-result">
                            <div>
                                <span>
                                    Destino
                                </span>

                                <strong>
                                    {
                                        result.matrix.name
                                        || '02_Matriz observaciones estructura'
                                    }
                                </strong>
                            </div>

                            <a
                                href={result.matrix.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Abrir matriz
                            </a>
                        </div>
                    )}

                    {Object.keys(activities).length > 0 && (
                        <div className="cfm-activity-breakdown">
                            {Object.entries(activities).map(
                                ([key, info]) => (
                                    <div
                                        key={key}
                                        className="cfm-activity-row"
                                    >
                                        <strong>
                                            {ACTIVITY_TYPE_LABELS[key] || key}
                                        </strong>

                                        {info.success ? (
                                            <span>
                                                {info.items_analyzed ?? 0}
                                                {' ítem(s) analizados · '}
                                                {info.items_skipped ?? 0}
                                                {' sin planeación · '}
                                                {info.fields_written ?? 0}
                                                {' campo(s) escritos'}
                                            </span>
                                        ) : (
                                            <span className="cfm-activity-error">
                                                {info.error || info.note}
                                            </span>
                                        )}
                                    </div>
                                ),
                            )}
                        </div>
                    )}
                </>
            )}
        </article>
    );
};


export default MaterialReviewManager;
