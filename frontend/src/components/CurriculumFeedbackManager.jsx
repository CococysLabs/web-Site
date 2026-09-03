import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import api from '../services/api';
import './CurriculumFeedbackManager.css';


const CURRENT_YEAR = new Date().getFullYear();

const ALL_AREAS = '__ALL__';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 300;

const SEMESTER_OPTIONS = [
    {
        value: '1S',
        label: 'Primer semestre - 1S',
    },
    {
        value: '2S',
        label: 'Segundo semestre - 2S',
    },
    {
        value: '3S',
        label: 'Tercer semestre - 3S',
    },
];


const FEEDBACK_LABELS = {
    competencias: 'Competencias',
    semana_diagnostico: 'Semana de Diagnóstico',
    s2: 'S2',
    s3: 'S3',
    s4: 'S4',
    s5: 'S5',
    s6: 'S6',
    s7: 'S7',
    s8: 'S8',
    s9: 'S9',
    s10: 'S10',
    s11: 'S11',
    proyectos: 'Proyectos',
    practicas: 'Prácticas',
    tareas: 'Tareas',
};


const ACTIVITY_TYPE_LABELS = {
    proyectos: 'Proyectos',
    practicas: 'Prácticas',
    tareas: 'Tareas',
};


const EXPECTED_FILES = [
    {
        key: 'fortalezas_debilidades_recomendaciones',
        label: '1_Fortalezas_Debilidades_y_Recomendaciones',
        optional: true,
    },
    {
        key: 'analisis_contexto',
        label: '2_Analisis_de_Contexto',
        optional: true,
    },
    {
        key: 'criterios_expectativas',
        label: '3_Criterios y Expectativas',
        optional: true,
    },
    {
        key: 'analisis_internacional',
        label: '4_Analisis_Internacional',
        optional: true,
    },
    {
        key: 'diseno_curricular',
        label: '5_Diseño_Curricular',
        optional: false,
    },
    {
        key: 'matrix',
        label: '02_Matriz observaciones estructura',
        optional: false,
    },
];


const delay = (milliseconds) => (
    new Promise((resolve) => {
        window.setTimeout(resolve, milliseconds);
    })
);


const courseKey = (course) => (
    `${course.area}::${course.code}`
);


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


const CurriculumFeedbackManager = () => {
    const mountedRef = useRef(true);

    const [areas, setAreas] = useState([]);
    const [selectedArea, setSelectedArea] = useState('');

    const [courses, setCourses] = useState([]);
    const [selectedKeys, setSelectedKeys] = useState([]);

    const [semester, setSemester] = useState('2S');
    const [year, setYear] = useState(CURRENT_YEAR);

    const [loadingAreas, setLoadingAreas] = useState(false);
    const [loadingCourses, setLoadingCourses] = useState(false);
    const [checking, setChecking] = useState(false);
    const [processing, setProcessing] = useState(false);

    const [preview, setPreview] = useState(null);
    const [previewFingerprint, setPreviewFingerprint] = useState('');

    const [jobs, setJobs] = useState({});

    const [error, setError] = useState(null);

    // ---- Fase 2: Proyectos, Practicas y Tareas ----
    // Selección independiente de la Fase 1: Semestre → Área → Curso,
    // leídos directo de Drive (igual que el validador de estructura de
    // Proyectos/Practicas/Tareas), no del catálogo de cursos.
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


    const selectedCourses = useMemo(
        () => (
            courses.filter(
                (course) => selectedKeys.includes(
                    courseKey(course),
                ),
            )
        ),
        [
            courses,
            selectedKeys,
        ],
    );


    const selectionFingerprint = useMemo(
        () => (
            JSON.stringify({
                area: selectedArea,
                courses: selectedKeys.slice().sort(),
                semester,
                year: Number(year),
            })
        ),
        [
            selectedArea,
            selectedKeys,
            semester,
            year,
        ],
    );


    const previewIsCurrent = (
        preview
        && previewFingerprint === selectionFingerprint
    );


    const readyCourses = useMemo(() => {
        if (!previewIsCurrent) {
            return [];
        }

        return (
            preview.courses?.filter(
                (course) => course.ready_for_write,
            )
            || []
        );
    }, [
        preview,
        previewIsCurrent,
    ]);


    const allCoursesSelected = (
        courses.length > 0
        && selectedKeys.length === courses.length
    );


    const jobValues = Object.values(jobs);

    const completedJobs = jobValues.filter(
        (item) => item.status === 'completed',
    ).length;

    const failedJobs = jobValues.filter(
        (item) => item.status === 'failed',
    ).length;


    const invalidatePreview = () => {
        setPreview(null);
        setPreviewFingerprint('');
        setJobs({});
        setError(null);
    };


    // ---- Fase 2: selección propia (Semestre → Área → Curso, de Drive) ----

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
    // ÁREAS
    // ========================================================

    useEffect(() => {
        const loadAreas = async () => {
            try {
                setLoadingAreas(true);
                setError(null);

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

                if (areaList.length > 0) {
                    setSelectedArea(
                        areaList[0].area,
                    );
                }
            } catch (requestError) {
                if (!mountedRef.current) {
                    return;
                }

                setError(
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
    // CURSOS
    // ========================================================

    useEffect(() => {
        if (!selectedArea) {
            return;
        }

        const loadCourses = async () => {
            try {
                setLoadingCourses(true);
                setError(null);
                setCourses([]);
                setSelectedKeys([]);
                setPreview(null);
                setPreviewFingerprint('');
                setJobs({});

                const response = await api.get(
                    '/api/course-catalog',
                    {
                        params: (
                            selectedArea === ALL_AREAS
                                ? {}
                                : {
                                    area: selectedArea,
                                }
                        ),
                    },
                );

                if (!mountedRef.current) {
                    return;
                }

                setCourses(
                    response.data?.courses
                    || [],
                );
            } catch (requestError) {
                if (!mountedRef.current) {
                    return;
                }

                setError(
                    getErrorMessage(
                        requestError,
                        'No se pudieron cargar los cursos.',
                    ),
                );
            } finally {
                if (mountedRef.current) {
                    setLoadingCourses(false);
                }
            }
        };

        loadCourses();
    }, [selectedArea]);


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


    // ========================================================
    // SELECCIÓN
    // ========================================================

    const toggleCourse = (course) => {
        if (processing) {
            return;
        }

        const key = courseKey(course);

        setSelectedKeys((current) => {
            if (current.includes(key)) {
                return current.filter(
                    (item) => item !== key,
                );
            }

            return [
                ...current,
                key,
            ];
        });

        setPreview(null);
        setPreviewFingerprint('');
        setJobs({});
        setError(null);
    };


    const selectAllCourses = () => {
        if (processing) {
            return;
        }

        setSelectedKeys(
            courses.map(courseKey),
        );

        setPreview(null);
        setPreviewFingerprint('');
        setJobs({});
        setError(null);
    };


    const clearCourses = () => {
        if (processing) {
            return;
        }

        setSelectedKeys([]);

        setPreview(null);
        setPreviewFingerprint('');
        setJobs({});
        setError(null);
    };


    // ========================================================
    // PREVIEW
    // ========================================================

    const handlePreview = async () => {
        if (
            selectedCourses.length === 0
        ) {
            setError(
                'Selecciona al menos un curso.',
            );
            return;
        }

        if (
            !semester
        ) {
            setError(
                'Selecciona un semestre.',
            );
            return;
        }

        if (
            !year
            || Number(year) < 2000
            || Number(year) > 2100
        ) {
            setError(
                'Indica un año válido.',
            );
            return;
        }

        try {
            setChecking(true);
            setError(null);
            setPreview(null);
            setJobs({});

            /*
             * Agrupamos por área.
             *
             * Esto permite seleccionar "Todas las áreas"
             * sin perder la ubicación real de cada curso.
             */
            const grouped = selectedCourses.reduce(
                (accumulator, course) => {
                    if (
                        !accumulator[
                        course.area
                        ]
                    ) {
                        accumulator[
                            course.area
                        ] = [];
                    }

                    accumulator[
                        course.area
                    ].push(
                        course.code,
                    );

                    return accumulator;
                },
                {},
            );

            const requests = Object.entries(
                grouped,
            ).map(
                ([
                    area,
                    codes,
                ]) => (
                    api.post(
                        '/api/curriculum-feedback/preview',
                        {
                            area,
                            course_codes: codes,
                            semester,
                            year: Number(year),
                        },
                    )
                ),
            );

            const responses = await Promise.all(
                requests,
            );

            const previewCourses = (
                responses
                    .flatMap(
                        (response) => (
                            response.data?.courses
                            || []
                        ),
                    )
                    .sort(
                        (left, right) => {
                            const areaCompare = (
                                String(
                                    left.area,
                                ).localeCompare(
                                    String(
                                        right.area,
                                    ),
                                    'es',
                                )
                            );

                            if (areaCompare !== 0) {
                                return areaCompare;
                            }

                            return String(
                                left.code,
                            ).localeCompare(
                                String(
                                    right.code,
                                ),
                                'es',
                                {
                                    numeric: true,
                                },
                            );
                        },
                    )
            );

            const combinedPreview = {
                success: true,

                semester,

                year: Number(year),

                summary: {
                    total_courses: (
                        previewCourses.length
                    ),

                    ready_for_analysis: (
                        previewCourses.filter(
                            (course) => (
                                course.ready_for_analysis
                            ),
                        ).length
                    ),

                    ready_for_write: (
                        previewCourses.filter(
                            (course) => (
                                course.ready_for_write
                            ),
                        ).length
                    ),

                    with_errors: (
                        previewCourses.filter(
                            (course) => (
                                !course.success
                            ),
                        ).length
                    ),
                },

                courses: previewCourses,
            };

            if (!mountedRef.current) {
                return;
            }

            setPreview(
                combinedPreview,
            );

            setPreviewFingerprint(
                selectionFingerprint,
            );
        } catch (requestError) {
            if (!mountedRef.current) {
                return;
            }

            setError(
                getErrorMessage(
                    requestError,
                    'No se pudo comprobar la Planeación Curricular.',
                ),
            );
        } finally {
            if (mountedRef.current) {
                setChecking(false);
            }
        }
    };


    // ========================================================
    // JOB
    // ========================================================

    const updateJob = (
        key,
        patch,
    ) => {
        if (!mountedRef.current) {
            return;
        }

        setJobs(
            (current) => ({
                ...current,

                [key]: {
                    ...current[key],
                    ...patch,
                },
            }),
        );
    };


    const pollJob = async (
        course,
        jobId,
    ) => {
        const key = courseKey(
            course,
        );

        let consecutiveErrors = 0;

        for (
            let attempt = 0;
            attempt < MAX_POLL_ATTEMPTS;
            attempt += 1
        ) {
            await delay(
                POLL_INTERVAL_MS,
            );

            try {
                const response = await api.get(
                    `/api/curriculum-feedback/jobs/${jobId}`,
                );

                const serverJob = (
                    response.data?.job
                );

                if (!serverJob) {
                    throw new Error(
                        'El backend no devolvió el estado del job.',
                    );
                }

                consecutiveErrors = 0;

                updateJob(
                    key,
                    {
                        id: jobId,
                        status: serverJob.status,
                        progress: (
                            serverJob.progress
                            ?? 0
                        ),
                        serverJob,
                        error: (
                            serverJob.error
                            || null
                        ),
                    },
                );

                if (
                    serverJob.status === 'completed'
                    || serverJob.status === 'failed'
                ) {
                    return serverJob;
                }
            } catch (requestError) {
                consecutiveErrors += 1;

                if (
                    consecutiveErrors >= 5
                ) {
                    throw requestError;
                }
            }
        }

        throw new Error(
            'El análisis continúa en el servidor, pero se agotó el tiempo de seguimiento desde esta pantalla.',
        );
    };


    const processCourse = async (
        course,
    ) => {
        const key = courseKey(
            course,
        );

        updateJob(
            key,
            {
                course,
                status: 'creating',
                progress: 0,
                id: null,
                serverJob: null,
                error: null,
            },
        );

        try {
            const response = await api.post(
                '/api/curriculum-feedback/jobs',
                {
                    area: course.area,

                    course_code: (
                        course.code
                    ),

                    semester,

                    year: Number(year),

                    /*
                    * El backend escribe directamente en:
                    *
                    * 0_Revision_de_Material/
                    * 02_Matriz observaciones estructura
                    *
                    * Columna G:
                    * Observaciones Generales por la IA
                    */
                    write_output: true,
                },
            );

            const jobId = (
                response.data?.job_id
            );

            if (!jobId) {
                throw new Error(
                    'El backend no devolvió job_id.',
                );
            }

            updateJob(
                key,
                {
                    id: jobId,
                    status: (
                        response.data?.status
                        || 'queued'
                    ),
                    progress: 0,
                },
            );

            return await pollJob(
                course,
                jobId,
            );
        } catch (requestError) {
            updateJob(
                key,
                {
                    status: 'failed',
                    progress: 100,
                    error: getErrorMessage(
                        requestError,
                        'No se pudo procesar el curso.',
                    ),
                },
            );

            return null;
        }
    };


    // ========================================================
    // PROCESAR SELECCIONADOS
    // ========================================================

    const handleGenerate = async () => {
        if (!previewIsCurrent) {
            setError(
                'Debes comprobar nuevamente los archivos antes de generar las observaciones.',
            );
            return;
        }

        if (
            readyCourses.length === 0
        ) {
            setError(
                'No hay cursos listos para generar observaciones.',
            );
            return;
        }

        try {
            setProcessing(true);
            setError(null);
            setJobs({});

            /*
             * IMPORTANTE:
             *
             * Procesamos uno por uno para evitar lanzar
             * varios contextos de ~60k tokens al mismo tiempo
             * contra Gemini.
             *
             * Si un curso falla, el ciclo continúa.
             */
            for (
                const course
                of readyCourses
            ) {
                await processCourse(
                    course,
                );
            }
        } finally {
            if (mountedRef.current) {
                setProcessing(false);
            }
        }
    };


    // ========================================================
    // RETRY
    // ========================================================

    const retryCourse = async (
        course,
    ) => {
        if (processing) {
            return;
        }

        try {
            setProcessing(true);

            await processCourse(
                course,
            );
        } finally {
            if (mountedRef.current) {
                setProcessing(false);
            }
        }
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
            const response = await api.post(
                '/api/activity-content-analysis/analyze-course',
                {
                    course_folder_id: course.folder_id,
                    course_name: course.name,
                    area: course.area,
                    write_output: true,
                    activity_types: selectedActivityTypes,
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
            <div className="cfm-header">
                <div>
                    <span className="cfm-phase-badge">
                        Fase 1
                    </span>

                    <h2>
                        Revisión de Planeación Curricular
                    </h2>

                    <p>
                        Comprueba los documentos del curso,
                        analiza el Diseño Curricular y registra
                        las observaciones generadas en la matriz
                        de revisión correspondiente.
                    </p>
                </div>

                <div className="cfm-header-count">
                    <strong>
                        {selectedCourses.length}
                    </strong>

                    <span>
                        seleccionado
                        {selectedCourses.length === 1
                            ? ''
                            : 's'}
                    </span>
                </div>
            </div>


            {/* =================================================
                CONFIGURACIÓN
            ================================================= */}

            <section className="cfm-card">
                <div className="cfm-section-heading">
                    <div>
                        <span className="cfm-step">
                            1
                        </span>

                        <div>
                            <h3>
                                Período académico
                            </h3>

                            <p>
                                Selecciona el área,
                                semestre y año.
                            </p>
                        </div>
                    </div>
                </div>


                <div className="cfm-form-grid">
                    <label className="cfm-field">
                        <span>
                            Área
                        </span>

                        <select
                            value={selectedArea}
                            disabled={
                                loadingAreas
                                || processing
                            }
                            onChange={(event) => {
                                setSelectedArea(
                                    event.target.value,
                                );

                                invalidatePreview();
                            }}
                        >
                            {loadingAreas && (
                                <option value="">
                                    Cargando áreas...
                                </option>
                            )}

                            <option
                                value={ALL_AREAS}
                            >
                                Todas las áreas
                            </option>

                            {areas.map(
                                (area) => (
                                    <option
                                        key={area.area}
                                        value={area.area}
                                    >
                                        {area.label
                                            || area.area}
                                    </option>
                                ),
                            )}
                        </select>
                    </label>


                    <label className="cfm-field">
                        <span>
                            Semestre
                        </span>

                        <select
                            value={semester}
                            disabled={processing}
                            onChange={(event) => {
                                setSemester(
                                    event.target.value,
                                );

                                invalidatePreview();
                            }}
                        >
                            {SEMESTER_OPTIONS.map(
                                (option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ),
                            )}
                        </select>
                    </label>


                    <label className="cfm-field">
                        <span>
                            Año
                        </span>

                        <input
                            type="number"
                            min="2000"
                            max="2100"
                            value={year}
                            disabled={processing}
                            onChange={(event) => {
                                setYear(
                                    event.target.value,
                                );

                                invalidatePreview();
                            }}
                        />
                    </label>
                </div>
            </section>


            {/* =================================================
                CURSOS
            ================================================= */}

            <section className="cfm-card">
                <div className="cfm-section-heading">
                    <div>
                        <span className="cfm-step">
                            2
                        </span>

                        <div>
                            <h3>
                                Cursos
                            </h3>

                            <p>
                                Selecciona los cursos que
                                deseas analizar.
                            </p>
                        </div>
                    </div>

                    <div className="cfm-mini-actions">
                        <button
                            type="button"
                            disabled={
                                processing
                                || courses.length === 0
                            }
                            onClick={selectAllCourses}
                        >
                            Todos
                        </button>

                        <button
                            type="button"
                            disabled={
                                processing
                                || courses.length === 0
                            }
                            onClick={clearCourses}
                        >
                            Ninguno
                        </button>
                    </div>
                </div>


                {loadingCourses ? (
                    <div className="cfm-placeholder">
                        Cargando cursos...
                    </div>
                ) : courses.length === 0 ? (
                    <div className="cfm-placeholder">
                        No hay cursos activos.
                    </div>
                ) : (
                    <div className="cfm-course-grid">
                        {courses.map(
                            (course) => {
                                const key = courseKey(
                                    course,
                                );

                                const checked = (
                                    selectedKeys.includes(
                                        key,
                                    )
                                );

                                return (
                                    <label
                                        key={key}
                                        className={
                                            `cfm-course-option ${checked
                                                ? 'selected'
                                                : ''
                                            }`
                                        }
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={processing}
                                            onChange={() => {
                                                toggleCourse(
                                                    course,
                                                );
                                            }}
                                        />

                                        <div>
                                            <div className="cfm-course-title">
                                                <strong>
                                                    {course.code}
                                                </strong>

                                                <span>
                                                    {course.name}
                                                </span>
                                            </div>

                                            <small>
                                                {course.area}
                                            </small>
                                        </div>
                                    </label>
                                );
                            },
                        )}
                    </div>
                )}


                <div className="cfm-selection-footer">
                    <span>
                        {selectedCourses.length}
                        {' de '}
                        {courses.length}
                        {' cursos seleccionados'}
                    </span>

                    {allCoursesSelected && (
                        <strong>
                            Todos seleccionados
                        </strong>
                    )}
                </div>
            </section>


            {/* =================================================
                COMPROBAR
            ================================================= */}

            <section className="cfm-card">
                <div className="cfm-section-heading">
                    <div>
                        <span className="cfm-step">
                            3
                        </span>

                        <div>
                            <h3>
                                Comprobar archivos
                            </h3>

                            <p>
                                Se verificará la carpeta
                                3_Planeacion_Curricular antes
                                de utilizar IA.
                            </p>
                        </div>
                    </div>
                </div>


                <button
                    type="button"
                    className="cfm-primary-button"
                    disabled={
                        checking
                        || processing
                        || selectedCourses.length === 0
                    }
                    onClick={handlePreview}
                >
                    {checking
                        ? 'Comprobando archivos...'
                        : 'Comprobar cursos'}
                </button>


                {previewIsCurrent && (
                    <div className="cfm-preview">
                        <div className="cfm-summary-grid">
                            <Summary
                                label="Seleccionados"
                                value={
                                    preview.summary
                                        ?.total_courses
                                    || 0
                                }
                            />

                            <Summary
                                label="Listos para procesar"
                                value={
                                    preview.summary
                                        ?.ready_for_write
                                    || 0
                                }
                                tone="success"
                            />

                            <Summary
                                label="Listos para analizar"
                                value={
                                    preview.summary
                                        ?.ready_for_analysis
                                    || 0
                                }
                            />

                            <Summary
                                label="Con errores"
                                value={
                                    preview.summary
                                        ?.with_errors
                                    || 0
                                }
                                tone="danger"
                            />

                            <Summary
                                label="Errores"
                                value={
                                    preview.summary
                                        ?.with_errors
                                    || 0
                                }
                                tone="danger"
                            />
                        </div>


                        <div className="cfm-preview-list">
                            {preview.courses?.map(
                                (course) => (
                                    <PreviewCourse
                                        key={
                                            courseKey(
                                                course,
                                            )
                                        }
                                        course={course}
                                    />
                                ),
                            )}
                        </div>
                    </div>
                )}
            </section>


            {/* =================================================
                GENERAR
            ================================================= */}

            {previewIsCurrent && (
                <section className="cfm-card">
                    <div className="cfm-section-heading">
                        <div>
                            <span className="cfm-step">
                                4
                            </span>

                            <div>
                                <h3>
                                    Generar observaciones
                                </h3>

                                <p>
                                    Los cursos listos se procesarán uno por uno.
                                    Las observaciones generadas se escribirán
                                    automáticamente en la columna
                                    "Observaciones Generales por la IA" de
                                    02_Matriz observaciones estructura.
                                </p>
                            </div>
                        </div>
                    </div>


                    {readyCourses.length === 0 ? (
                        <div className="cfm-blocked-message">
                            Ninguno de los cursos seleccionados
                            está listo para generar y escribir
                            las observaciones.
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="cfm-generate-button"
                            disabled={processing}
                            onClick={handleGenerate}
                        >
                            {processing
                                ? 'Procesando cursos...'
                                : (
                                    readyCourses.length === 1
                                        ? 'Generar observaciones'
                                        : `Generar observaciones de ${readyCourses.length} cursos`
                                )}
                        </button>
                    )}


                    {jobValues.length > 0 && (
                        <div className="cfm-job-area">
                            <div className="cfm-job-summary">
                                <div>
                                    <strong>
                                        {completedJobs}
                                    </strong>

                                    <span>
                                        completados
                                    </span>
                                </div>

                                <div>
                                    <strong>
                                        {failedJobs}
                                    </strong>

                                    <span>
                                        con error
                                    </span>
                                </div>

                                <div>
                                    <strong>
                                        {jobValues.length}
                                    </strong>

                                    <span>
                                        iniciados
                                    </span>
                                </div>
                            </div>


                            <div className="cfm-jobs">
                                {readyCourses.map(
                                    (course) => {
                                        const job = (
                                            jobs[
                                            courseKey(
                                                course,
                                            )
                                            ]
                                        );

                                        if (!job) {
                                            return (
                                                <QueuedCourse
                                                    key={
                                                        courseKey(
                                                            course,
                                                        )
                                                    }
                                                    course={
                                                        course
                                                    }
                                                />
                                            );
                                        }

                                        return (
                                            <JobCourse
                                                key={
                                                    courseKey(
                                                        course,
                                                    )
                                                }
                                                course={course}
                                                job={job}
                                                disabled={
                                                    processing
                                                }
                                                onRetry={() => {
                                                    retryCourse(
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


            {/* =================================================
                FASE 2 — PROYECTOS, PRACTICAS Y TAREAS
            ================================================= */}

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


            {error && (
                <div className="cfm-alert error">
                    <strong>
                        Error
                    </strong>

                    <p>
                        {error}
                    </p>
                </div>
            )}
        </div>
    );
};


// ============================================================
// PREVIEW POR CURSO
// ============================================================

const PreviewCourse = ({
    course,
}) => {
    let state = 'ready';
    let stateLabel = 'Listo';

    if (!course.success) {
        state = 'blocked';
        stateLabel = 'Error';
    } else if (!course.ready_for_analysis) {
        state = 'blocked';
        stateLabel = 'Sin Diseño Curricular';
    } else if (!course.ready_for_write) {
        state = 'blocked';
        stateLabel = 'Sin matriz de observaciones';
    } else if (
        course.warnings?.length > 0
    ) {
        state = 'warning';
        stateLabel = 'Listo con advertencias';
    }


    return (
        <article
            className={
                `cfm-preview-course ${state}`
            }
        >
            <div className="cfm-preview-course-header">
                <div>
                    <strong>
                        {course.code}
                    </strong>

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


            {course.files && (
                <div className="cfm-files">
                    {EXPECTED_FILES.map(
                        (definition) => {
                            const file = (
                                course.files[
                                definition.key
                                ]
                            );

                            const found = Boolean(
                                file?.found,
                            );

                            return (
                                <div
                                    key={
                                        definition.key
                                    }
                                    className={
                                        `cfm-file ${found
                                            ? 'found'
                                            : (
                                                definition.optional
                                                    ? 'optional'
                                                    : 'missing'
                                            )
                                        }`
                                    }
                                >
                                    <span
                                        className="cfm-file-indicator"
                                    />

                                    <div>
                                        <strong>
                                            {
                                                definition.label
                                            }
                                        </strong>

                                        <small>
                                            {found
                                                ? 'Encontrado'
                                                : (
                                                    definition.optional
                                                        ? 'No encontrado — opcional'
                                                        : 'No encontrado — obligatorio'
                                                )}
                                        </small>
                                    </div>
                                </div>
                            );
                        },
                    )}
                </div>
            )}

            {course.files?.matrix?.found && (
                <div className="cfm-matrix-preview">
                    <span>
                        Matriz detectada
                    </span>

                    <strong>
                        {
                            course.files.matrix
                                .targets
                            || 0
                        }
                        {' '}
                        secciones
                    </strong>

                    {course.files.matrix
                        ?.sheet && (
                            <small>
                                Hoja: {
                                    course.files.matrix
                                        .sheet
                                }
                            </small>
                        )}
                </div>
            )}


            {course.warnings?.length > 0 && (
                <div className="cfm-warning-list">
                    {course.warnings.map(
                        (warning, index) => (
                            <p
                                key={
                                    `${course.code}-warning-${index}`
                                }
                            >
                                {String(warning)}
                            </p>
                        ),
                    )}
                </div>
            )}


            <div className="cfm-preview-links">
                {course.locations?.planning
                    ?.webViewLink && (
                        <a
                            href={
                                course.locations
                                    .planning
                                    .webViewLink
                            }
                            target="_blank"
                            rel="noreferrer"
                        >
                            Abrir Planeación Curricular
                        </a>
                    )}

                {course.files?.matrix
                    ?.webViewLink && (
                        <a
                            href={
                                course.files
                                    .matrix
                                    .webViewLink
                            }
                            target="_blank"
                            rel="noreferrer"
                        >
                            Abrir matriz de observaciones
                        </a>
                    )}
            </div>
        </article>
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
// JOB POR CURSO
// ============================================================

const JobCourse = ({
    course,
    job,
    disabled,
    onRetry,
}) => {
    const serverJob = (
        job.serverJob
    );

    const result = (
        serverJob?.result
    );

    const analysisResult = (
        result?.result
    );

    const observations = (
        analysisResult?.observaciones
        || {}
    );

    const matrixTargets = (
        result?.matrix_targets
        || []
    );

    const writeResult = (
        result?.write
    );

    /*
     * No mostramos apartados vacíos.
     *
     * Ejemplo:
     * proyecto_3 = ""
     *
     * significa que el Tercer Proyecto no existe realmente,
     * por lo que no debe aparecer en la interfaz.
     */
    const visibleTargets = (
        matrixTargets.filter(
            (target) => {
                const value = (
                    observations[
                    target.id
                    ]
                );

                return Boolean(
                    String(
                        value
                        ?? ''
                    ).trim()
                );
            },
        )
    );

    const statusLabel = {
        creating: 'Preparando',
        queued: 'En cola',
        processing: 'Procesando',
        completed: 'Completado',
        failed: 'Error',
    }[
        job.status
    ] || job.status;


    return (
        <article
            className={
                `cfm-job-card ${job.status}`
            }
        >
            <div className="cfm-job-card-header">
                <div>
                    <strong>
                        {course.code}
                    </strong>

                    <span>
                        {course.name}
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
                            Math.min(
                                100,
                                job.progress || 0,
                            ),
                        )}%`,
                    }}
                />
            </div>


            {job.status === 'processing' && (
                <p className="cfm-job-muted">
                    Analizando la Planeación Curricular
                    y generando observaciones. Puedes
                    continuar utilizando el sistema.
                </p>
            )}


            {job.status === 'failed' && (
                <div className="cfm-job-error">
                    <p>
                        {job.error
                            || 'El curso no pudo procesarse.'}
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
                                Observaciones generadas
                            </span>

                            <strong>
                                {
                                    visibleTargets.length
                                }
                            </strong>
                        </div>

                        <div>
                            <span>
                                Celdas procesadas
                            </span>

                            <strong>
                                {
                                    writeResult
                                        ?.updated
                                    ?? 0
                                }
                            </strong>
                        </div>

                        <div>
                            <span>
                                Proveedor
                            </span>

                            <strong>
                                {serverJob?.provider
                                    || '—'}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Tiempo
                            </span>

                            <strong>
                                {
                                    result?.elapsed_seconds
                                        ? `${result.elapsed_seconds} s`
                                        : '—'
                                }
                            </strong>
                        </div>
                    </div>


                    {result?.matrix && (
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

                                <small>
                                    Hoja {
                                        result.matrix.sheet
                                        || '—'
                                    }
                                    {' · '}
                                    Columna {
                                        result.matrix.column
                                        || 'G'
                                    }
                                </small>
                            </div>

                            {result.matrix
                                ?.webViewLink && (
                                    <a
                                        href={
                                            result.matrix
                                                .webViewLink
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Abrir matriz
                                    </a>
                                )}
                        </div>
                    )}


                    {analysisResult
                        ?.resumen_general && (
                            <div className="cfm-general-summary">
                                <strong>
                                    Resumen del análisis
                                </strong>

                                <p>
                                    {
                                        analysisResult
                                            .resumen_general
                                    }
                                </p>
                            </div>
                        )}


                    {analysisResult
                        ?.advertencias
                        ?.length > 0 && (
                            <div className="cfm-result-warnings">
                                <strong>
                                    Advertencias
                                </strong>

                                <ul>
                                    {
                                        analysisResult
                                            .advertencias
                                            .map(
                                                (
                                                    warning,
                                                    index,
                                                ) => (
                                                    <li
                                                        key={
                                                            `${course.code}-result-warning-${index}`
                                                        }
                                                    >
                                                        {
                                                            warning
                                                        }
                                                    </li>
                                                ),
                                            )
                                    }
                                </ul>
                            </div>
                        )}


                    {visibleTargets.length > 0 && (
                        <details className="cfm-feedback-details">
                            <summary>
                                Ver observaciones generadas
                                {' '}
                                ({visibleTargets.length})
                            </summary>

                            <div className="cfm-feedback-list">
                                {visibleTargets.map(
                                    (target) => (
                                        <div
                                            key={
                                                target.id
                                            }
                                            className="cfm-feedback-item"
                                        >
                                            <strong>
                                                {
                                                    target.label
                                                }
                                            </strong>

                                            <p>
                                                {
                                                    observations[
                                                    target.id
                                                    ]
                                                }
                                            </p>
                                        </div>
                                    ),
                                )}
                            </div>
                        </details>
                    )}
                </>
            )}
        </article>
    );
};

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
// FASE 2 — PREVIEW POR CURSO
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
// FASE 2 — JOB POR CURSO
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


export default CurriculumFeedbackManager;