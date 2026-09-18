import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import api from '../../services/api';

import WeekCourseSelector from './WeekCourseSelector';
import WeekPreview from './WeekPreview';
import WeekJobs from './WeekJobs';

import './WeekContentAnalysisManager.css';


const POLL_INTERVAL_MS = 3000;

/*
 * 600 intentos * 3 segundos
 * ≈ 30 minutos máximos de seguimiento desde esta pantalla.
 *
 * Un curso analiza:
 * - Diagnóstico
 * - Semanas 2..11
 *
 * por lo que puede tomar varios minutos.
 */
const MAX_POLL_ATTEMPTS = 600;


const delay = (milliseconds) => (
    new Promise((resolve) => {
        window.setTimeout(
            resolve,
            milliseconds,
        );
    })
);


const getErrorMessage = (
    error,
    fallback = 'Ocurrió un error inesperado.',
) => {
    const detail = (
        error?.response?.data?.detail
    );

    if (
        typeof detail === 'string'
    ) {
        return detail;
    }

    if (detail) {
        if (
            typeof detail?.message
            === 'string'
        ) {
            return detail.message;
        }

        try {
            return JSON.stringify(
                detail,
            );
        } catch {
            return fallback;
        }
    }

    return (
        error?.message
        || fallback
    );
};


const folderIdOf = (
    course,
) => (
    course?.course?.folder_id
    || course?.folder_id
    || ''
);


const courseCodeOf = (
    course,
) => (
    course?.course?.code
    || course?.code
    || ''
);


const courseNameOf = (
    course,
) => (
    course?.course?.name
    || course?.name
    || course?.folder_name
    || 'Curso'
);


const jobKey = (
    course,
) => (
    folderIdOf(course)
    || `${courseCodeOf(course)}::${courseNameOf(course)}`
);


const WeekContentAnalysisManager = () => {
    const mountedRef = useRef(
        true,
    );


    // ========================================================
    // SEMESTRES
    // ========================================================

    const [
        semesters,
        setSemesters,
    ] = useState([]);

    const [
        selectedSemesterId,
        setSelectedSemesterId,
    ] = useState('');

    const [
        loadingSemesters,
        setLoadingSemesters,
    ] = useState(false);


    // ========================================================
    // ÁREAS
    // ========================================================

    const [
        areas,
        setAreas,
    ] = useState([]);

    const [
        selectedAreaId,
        setSelectedAreaId,
    ] = useState('');

    const [
        loadingAreas,
        setLoadingAreas,
    ] = useState(false);


    // ========================================================
    // CURSOS
    // ========================================================

    const [
        courses,
        setCourses,
    ] = useState([]);

    const [
        selectedCourseIds,
        setSelectedCourseIds,
    ] = useState([]);

    const [
        loadingCourses,
        setLoadingCourses,
    ] = useState(false);


    const [
        invalidCourses,
        setInvalidCourses,
    ] = useState([]);

    const [
        ignoredFolders,
        setIgnoredFolders,
    ] = useState([]);


    // ========================================================
    // PREVIEW
    // ========================================================

    const [
        checking,
        setChecking,
    ] = useState(false);

    const [
        preview,
        setPreview,
    ] = useState(null);

    const [
        previewFingerprint,
        setPreviewFingerprint,
    ] = useState('');


    // ========================================================
    // JOBS
    // ========================================================

    const [
        jobs,
        setJobs,
    ] = useState({});

    const [
        processing,
        setProcessing,
    ] = useState(false);


    // ========================================================
    // ERROR
    // ========================================================

    const [
        error,
        setError,
    ] = useState(null);


    // ========================================================
    // MOUNT
    // ========================================================

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
        };
    }, []);


    // ========================================================
    // SELECCIONADOS
    // ========================================================

    const selectedCourses = useMemo(
        () => (
            courses.filter(
                (course) => (
                    selectedCourseIds.includes(
                        course.folder_id,
                    )
                ),
            )
        ),
        [
            courses,
            selectedCourseIds,
        ],
    );


    const allCoursesSelected = (
        courses.length > 0
        && selectedCourseIds.length
        === courses.length
    );


    // ========================================================
    // FINGERPRINT
    // ========================================================

    const selectionFingerprint = useMemo(
        () => (
            JSON.stringify({
                semesterFolderId: (
                    selectedSemesterId
                ),

                areaFolderId: (
                    selectedAreaId
                ),

                courseFolderIds: (
                    selectedCourseIds
                        .slice()
                        .sort()
                ),
            })
        ),
        [
            selectedSemesterId,
            selectedAreaId,
            selectedCourseIds,
        ],
    );


    const previewIsCurrent = Boolean(
        preview
        && previewFingerprint
        === selectionFingerprint
    );


    // ========================================================
    // CURSOS LISTOS
    // ========================================================

    const readyCourses = useMemo(
        () => {
            if (
                !previewIsCurrent
            ) {
                return [];
            }

            return (
                preview?.courses?.filter(
                    (course) => (
                        course.success
                        && course.ready_for_analysis
                        && course.ready_for_write
                    ),
                )
                || []
            );
        },
        [
            preview,
            previewIsCurrent,
        ],
    );


    // ========================================================
    // INVALIDAR PREVIEW
    // ========================================================

    const invalidateWorkflow = () => {
        setPreview(
            null,
        );

        setPreviewFingerprint(
            '',
        );

        setJobs(
            {},
        );

        setError(
            null,
        );
    };


    // ========================================================
    // CARGAR SEMESTRES
    // ========================================================

    useEffect(() => {
        let cancelled = false;


        const loadSemesters = async () => {
            try {
                setLoadingSemesters(
                    true,
                );

                setError(
                    null,
                );


                const response = (
                    await api.get(
                        '/api/week-content-analysis/semesters',
                    )
                );


                if (
                    cancelled
                    || !mountedRef.current
                ) {
                    return;
                }


                const semesterList = (
                    response.data?.semesters
                    || []
                );


                setSemesters(
                    semesterList,
                );


                if (
                    semesterList.length > 0
                ) {
                    setSelectedSemesterId(
                        semesterList[0].id,
                    );
                } else {
                    setSelectedSemesterId(
                        '',
                    );
                }

            } catch (
            requestError
            ) {
                if (
                    cancelled
                    || !mountedRef.current
                ) {
                    return;
                }

                setError(
                    getErrorMessage(
                        requestError,
                        'No se pudieron cargar los semestres de Recursos Educativos.',
                    ),
                );

            } finally {
                if (
                    !cancelled
                    && mountedRef.current
                ) {
                    setLoadingSemesters(
                        false,
                    );
                }
            }
        };


        loadSemesters();


        return () => {
            cancelled = true;
        };
    }, []);


    // ========================================================
    // CARGAR ÁREAS
    // ========================================================

    useEffect(() => {
        let cancelled = false;


        if (
            !selectedSemesterId
        ) {
            setAreas([]);
            setSelectedAreaId('');

            setCourses([]);
            setSelectedCourseIds([]);

            return undefined;
        }


        const loadAreas = async () => {
            try {
                setLoadingAreas(
                    true,
                );

                setError(
                    null,
                );


                setAreas([]);
                setSelectedAreaId('');

                setCourses([]);
                setSelectedCourseIds([]);

                setInvalidCourses([]);
                setIgnoredFolders([]);

                setPreview(null);
                setPreviewFingerprint('');

                setJobs({});


                const response = (
                    await api.get(
                        '/api/week-content-analysis/areas',
                        {
                            params: {
                                semester_folder_id: (
                                    selectedSemesterId
                                ),
                            },
                        },
                    )
                );


                if (
                    cancelled
                    || !mountedRef.current
                ) {
                    return;
                }


                const areaList = (
                    response.data?.areas
                    || []
                );


                setAreas(
                    areaList,
                );


                if (
                    areaList.length > 0
                ) {
                    setSelectedAreaId(
                        areaList[0].id,
                    );
                }

            } catch (
            requestError
            ) {
                if (
                    cancelled
                    || !mountedRef.current
                ) {
                    return;
                }


                setError(
                    getErrorMessage(
                        requestError,
                        'No se pudieron cargar las áreas del semestre seleccionado.',
                    ),
                );

            } finally {
                if (
                    !cancelled
                    && mountedRef.current
                ) {
                    setLoadingAreas(
                        false,
                    );
                }
            }
        };


        loadAreas();


        return () => {
            cancelled = true;
        };

    }, [
        selectedSemesterId,
    ]);


    // ========================================================
    // CARGAR CURSOS
    // ========================================================

    useEffect(() => {
        let cancelled = false;


        if (
            !selectedSemesterId
            || !selectedAreaId
        ) {
            setCourses([]);
            setSelectedCourseIds([]);

            return undefined;
        }


        const loadCourses = async () => {
            try {
                setLoadingCourses(
                    true,
                );

                setError(
                    null,
                );


                setCourses([]);
                setSelectedCourseIds([]);

                setInvalidCourses([]);
                setIgnoredFolders([]);

                setPreview(null);
                setPreviewFingerprint('');

                setJobs({});


                const response = (
                    await api.get(
                        '/api/week-content-analysis/courses',
                        {
                            params: {
                                semester_folder_id: (
                                    selectedSemesterId
                                ),

                                area_folder_id: (
                                    selectedAreaId
                                ),
                            },
                        },
                    )
                );


                if (
                    cancelled
                    || !mountedRef.current
                ) {
                    return;
                }


                setCourses(
                    response.data?.courses
                    || [],
                );


                setInvalidCourses(
                    response.data?.invalid_courses
                    || [],
                );


                setIgnoredFolders(
                    response.data?.ignored_folders
                    || [],
                );

            } catch (
            requestError
            ) {
                if (
                    cancelled
                    || !mountedRef.current
                ) {
                    return;
                }


                setError(
                    getErrorMessage(
                        requestError,
                        'No se pudieron cargar los cursos del área seleccionada.',
                    ),
                );

            } finally {
                if (
                    !cancelled
                    && mountedRef.current
                ) {
                    setLoadingCourses(
                        false,
                    );
                }
            }
        };


        loadCourses();


        return () => {
            cancelled = true;
        };

    }, [
        selectedSemesterId,
        selectedAreaId,
    ]);


    // ========================================================
    // CAMBIAR SEMESTRE
    // ========================================================

    const handleSemesterChange = (
        semesterId,
    ) => {
        if (
            processing
        ) {
            return;
        }


        setSelectedSemesterId(
            semesterId,
        );

        setSelectedAreaId('');

        setCourses([]);
        setSelectedCourseIds([]);

        setInvalidCourses([]);
        setIgnoredFolders([]);

        invalidateWorkflow();
    };


    // ========================================================
    // CAMBIAR ÁREA
    // ========================================================

    const handleAreaChange = (
        areaId,
    ) => {
        if (
            processing
        ) {
            return;
        }


        setSelectedAreaId(
            areaId,
        );

        setCourses([]);
        setSelectedCourseIds([]);

        setInvalidCourses([]);
        setIgnoredFolders([]);

        invalidateWorkflow();
    };


    // ========================================================
    // CURSO
    // ========================================================

    const toggleCourse = (
        folderId,
    ) => {
        if (
            processing
        ) {
            return;
        }


        setSelectedCourseIds(
            (current) => {
                if (
                    current.includes(
                        folderId,
                    )
                ) {
                    return current.filter(
                        (item) => (
                            item !== folderId
                        ),
                    );
                }

                return [
                    ...current,
                    folderId,
                ];
            },
        );


        invalidateWorkflow();
    };


    // ========================================================
    // TODOS
    // ========================================================

    const selectAllCourses = () => {
        if (
            processing
        ) {
            return;
        }


        setSelectedCourseIds(
            courses.map(
                (course) => (
                    course.folder_id
                ),
            ),
        );


        invalidateWorkflow();
    };


    // ========================================================
    // NINGUNO
    // ========================================================

    const clearCourses = () => {
        if (
            processing
        ) {
            return;
        }


        setSelectedCourseIds(
            [],
        );


        invalidateWorkflow();
    };


    // ========================================================
    // PREVIEW
    // ========================================================

    const handlePreview = async () => {
        if (
            selectedCourseIds.length === 0
        ) {
            setError(
                'Selecciona al menos un curso.',
            );

            return;
        }


        if (
            !selectedSemesterId
            || !selectedAreaId
        ) {
            setError(
                'Selecciona semestre y área.',
            );

            return;
        }


        try {
            setChecking(
                true,
            );

            setError(
                null,
            );

            setPreview(
                null,
            );

            setJobs(
                {},
            );


            const response = (
                await api.post(
                    '/api/week-content-analysis/preview',
                    {
                        semester_folder_id: (
                            selectedSemesterId
                        ),

                        area_folder_id: (
                            selectedAreaId
                        ),

                        course_folder_ids: (
                            selectedCourseIds
                        ),
                    },
                )
            );


            if (
                !mountedRef.current
            ) {
                return;
            }


            setPreview(
                response.data,
            );


            setPreviewFingerprint(
                selectionFingerprint,
            );

        } catch (
        requestError
        ) {
            if (
                !mountedRef.current
            ) {
                return;
            }


            setError(
                getErrorMessage(
                    requestError,
                    'No se pudieron comprobar los materiales de las semanas.',
                ),
            );

        } finally {
            if (
                mountedRef.current
            ) {
                setChecking(
                    false,
                );
            }
        }
    };


    // ========================================================
    // ACTUALIZAR JOB LOCAL
    // ========================================================

    const updateJob = (
        key,
        patch,
    ) => {
        if (
            !mountedRef.current
        ) {
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


    // ========================================================
    // POLLING
    // ========================================================

    const pollJob = async (
        course,
        jobId,
    ) => {
        const key = (
            jobKey(
                course,
            )
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
                const response = (
                    await api.get(
                        `/api/week-content-analysis/jobs/${jobId}`,
                    )
                );


                const serverJob = (
                    response.data?.job
                );


                if (
                    !serverJob
                ) {
                    throw new Error(
                        'El backend no devolvió el estado del job.',
                    );
                }


                consecutiveErrors = 0;


                updateJob(
                    key,
                    {
                        id: (
                            jobId
                        ),

                        status: (
                            serverJob.status
                        ),

                        progress: (
                            serverJob.progress
                            ?? 0
                        ),

                        currentStage: (
                            serverJob.current_stage
                            || ''
                        ),

                        currentWeek: (
                            serverJob.current_week
                            ?? null
                        ),

                        serverJob: (
                            serverJob
                        ),

                        error: (
                            serverJob.error
                            || null
                        ),
                    },
                );


                if (
                    serverJob.status
                    === 'completed'
                    ||
                    serverJob.status
                    === 'failed'
                ) {
                    return serverJob;
                }

            } catch (
            requestError
            ) {
                consecutiveErrors += 1;


                if (
                    consecutiveErrors
                    >= 5
                ) {
                    throw requestError;
                }
            }
        }


        throw new Error(
            'El análisis continúa en el servidor, pero se agotó el tiempo de seguimiento desde esta pantalla.',
        );
    };


    // ========================================================
    // PROCESAR CURSO
    // ========================================================

    const processCourse = async (
        course,
    ) => {
        const key = (
            jobKey(
                course,
            )
        );


        const courseFolderId = (
            folderIdOf(
                course,
            )
        );


        updateJob(
            key,
            {
                course,
                id: null,
                status: 'creating',
                progress: 0,
                currentStage: 'Preparando análisis',
                currentWeek: null,
                serverJob: null,
                error: null,
            },
        );


        try {
            const response = (
                await api.post(
                    '/api/week-content-analysis/jobs',
                    {
                        semester_folder_id: (
                            selectedSemesterId
                        ),

                        area_folder_id: (
                            selectedAreaId
                        ),

                        course_folder_id: (
                            courseFolderId
                        ),

                        /*
                         * La escritura final va a:
                         *
                         * 02_Matriz observaciones estructura
                         * Hoja: F2_Semanas
                         * Columna: H - Observaciones IA
                         */
                        write_output: true,
                    },
                )
            );


            const newJobId = (
                response.data?.job_id
            );


            if (
                !newJobId
            ) {
                throw new Error(
                    'El backend no devolvió job_id.',
                );
            }


            updateJob(
                key,
                {
                    id: (
                        newJobId
                    ),

                    status: (
                        response.data?.status
                        || 'queued'
                    ),

                    progress: (
                        response.data?.progress
                        ?? 0
                    ),

                    currentStage: (
                        response.data?.current_stage
                        || 'En cola'
                    ),
                },
            );


            return await pollJob(
                course,
                newJobId,
            );

        } catch (
        requestError
        ) {
            updateJob(
                key,
                {
                    status: 'failed',
                    progress: 100,

                    error: (
                        getErrorMessage(
                            requestError,
                            'No se pudo procesar el curso.',
                        )
                    ),
                },
            );


            return null;
        }
    };


    // ========================================================
    // GENERAR TODOS
    // ========================================================

    const handleGenerate = async () => {
        if (
            !previewIsCurrent
        ) {
            setError(
                'Debes comprobar nuevamente los cursos antes de generar las observaciones.',
            );

            return;
        }


        if (
            readyCourses.length === 0
        ) {
            setError(
                'No hay cursos listos para procesar.',
            );

            return;
        }


        try {
            setProcessing(
                true,
            );

            setError(
                null,
            );

            setJobs(
                {},
            );


            /*
             * IMPORTANTE:
             *
             * Los cursos se procesan UNO POR UNO.
             *
             * Cada curso ya ejecuta internamente:
             *
             * Diagnóstico
             * Semana 2
             * ...
             * Semana 11
             *
             * Evitamos lanzar múltiples cursos a IA
             * simultáneamente.
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
            if (
                mountedRef.current
            ) {
                setProcessing(
                    false,
                );
            }
        }
    };


    // ========================================================
    // REINTENTAR CURSO
    // ========================================================

    const retryCourse = async (
        course,
    ) => {
        if (
            processing
        ) {
            return;
        }


        try {
            setProcessing(
                true,
            );

            await processCourse(
                course,
            );

        } finally {
            if (
                mountedRef.current
            ) {
                setProcessing(
                    false,
                );
            }
        }
    };


    // ========================================================
    // RENDER
    // ========================================================

    return (
        <div className="wca-container">

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="wca-header">
                <div>
                    <span className="wca-phase-badge">
                        Fase 2
                    </span>

                    <h2>
                        Revisión de Semanas
                    </h2>

                    <p>
                        Revisa la Semana Diagnóstico y las
                        Semanas 2 a 11 utilizando únicamente
                        el contenido de los archivos PDF.
                        Las observaciones se registran en
                        F2_Semanas, columna H.
                    </p>
                </div>


                <div className="wca-header-count">
                    <strong>
                        {selectedCourses.length}
                    </strong>

                    <span>
                        seleccionado
                        {
                            selectedCourses.length === 1
                                ? ''
                                : 's'
                        }
                    </span>
                </div>
            </div>


            {/* =================================================
                PASO 1
            ================================================= */}

            <WeekCourseSelector
                semesters={
                    semesters
                }

                selectedSemesterId={
                    selectedSemesterId
                }

                loadingSemesters={
                    loadingSemesters
                }

                onSemesterChange={
                    handleSemesterChange
                }


                areas={
                    areas
                }

                selectedAreaId={
                    selectedAreaId
                }

                loadingAreas={
                    loadingAreas
                }

                onAreaChange={
                    handleAreaChange
                }


                courses={
                    courses
                }

                selectedCourseIds={
                    selectedCourseIds
                }

                selectedCourses={
                    selectedCourses
                }

                loadingCourses={
                    loadingCourses
                }

                allCoursesSelected={
                    allCoursesSelected
                }

                disabled={
                    processing
                    || checking
                }

                onToggleCourse={
                    toggleCourse
                }

                onSelectAll={
                    selectAllCourses
                }

                onClearAll={
                    clearCourses
                }


                invalidCourses={
                    invalidCourses
                }

                ignoredFolders={
                    ignoredFolders
                }
            />


            {/* =================================================
                PASO 2
            ================================================= */}

            <WeekPreview
                selectedCount={
                    selectedCourses.length
                }

                checking={
                    checking
                }

                processing={
                    processing
                }

                onCheck={
                    handlePreview
                }

                preview={
                    preview
                }

                previewIsCurrent={
                    previewIsCurrent
                }
            />


            {/* =================================================
                PASO 3
            ================================================= */}

            {previewIsCurrent && (
                <WeekJobs
                    readyCourses={
                        readyCourses
                    }

                    jobs={
                        jobs
                    }

                    processing={
                        processing
                    }

                    onGenerate={
                        handleGenerate
                    }

                    onRetry={
                        retryCourse
                    }
                />
            )}


            {/* =================================================
                ERROR GENERAL
            ================================================= */}

            {error && (
                <div className="wca-alert error">
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


export default WeekContentAnalysisManager;