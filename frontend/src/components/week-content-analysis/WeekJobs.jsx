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


const getStatusLabel = (
    status,
) => (
    {
        creating: 'Preparando',
        queued: 'En cola',
        processing: 'Procesando',
        completed: 'Completado',
        failed: 'Error',
    }[
    status
    ]
    || status
);


const SectionResults = ({
    result,
}) => {
    const analysisResults = (
        result?.results
        || {}
    );


    const sections = [
        {
            key: 'diagnostic',
            label: 'Semana Diagnóstico',
        },

        ...Array.from(
            {
                length: 10,
            },
            (
                _,
                index,
            ) => {
                const week = (
                    index + 2
                );

                return {
                    key: (
                        `week_${week}`
                    ),

                    label: (
                        `Semana ${week}`
                    ),
                };
            },
        ),
    ];


    return (
        <details className="wca-result-details">
            <summary>
                Ver resultado por semana
            </summary>


            <div className="wca-result-sections">
                {sections.map(
                    ({
                        key,
                        label,
                    }) => {
                        const section = (
                            analysisResults[
                            key
                            ]
                        );


                        if (
                            !section
                        ) {
                            return (
                                <div
                                    key={
                                        key
                                    }
                                    className="wca-result-section neutral"
                                >
                                    <strong>
                                        {label}
                                    </strong>

                                    <span>
                                        Sin resultado
                                    </span>
                                </div>
                            );
                        }


                        return (
                            <div
                                key={
                                    key
                                }
                                className={
                                    `wca-result-section ${section.success
                                        ? 'success'
                                        : 'failed'
                                    }`
                                }
                            >
                                <strong>
                                    {label}
                                </strong>

                                <span>
                                    {
                                        section.success
                                            ? 'Completado'
                                            : (
                                                section.error
                                                || 'Error en el análisis'
                                            )
                                    }
                                </span>
                            </div>
                        );
                    },
                )}
            </div>
        </details>
    );
};


const QueuedCourse = ({
    course,
}) => (
    <article className="wca-job-card waiting">
        <div className="wca-job-card-header">
            <div>
                <strong>
                    {
                        courseCodeOf(
                            course,
                        )
                    }
                </strong>

                <span>
                    {
                        courseNameOf(
                            course,
                        )
                    }
                </span>
            </div>

            <span className="wca-job-status waiting">
                Pendiente
            </span>
        </div>

        <p className="wca-job-muted">
            Esperando que finalice el curso anterior.
        </p>
    </article>
);


const JobCourse = ({
    course,
    job,
    disabled,
    onRetry,
}) => {
    const serverJob = (
        job?.serverJob
    );


    const result = (
        serverJob?.result
    );


    const summary = (
        result?.summary
        || {}
    );


    const writeResult = (
        result?.write
    );


    const partialSuccess = Boolean(
        job.status === 'completed'
        && summary?.partial_success
    );


    const effectiveClass = (
        partialSuccess
            ? 'partial'
            : job.status
    );


    return (
        <article
            className={
                `wca-job-card ${effectiveClass}`
            }
        >
            <div className="wca-job-card-header">
                <div>
                    <strong>
                        {
                            courseCodeOf(
                                course,
                            )
                        }
                    </strong>

                    <span>
                        {
                            courseNameOf(
                                course,
                            )
                        }
                    </span>
                </div>


                <span
                    className={
                        `wca-job-status ${effectiveClass}`
                    }
                >
                    {
                        partialSuccess
                            ? 'Completado parcialmente'
                            : getStatusLabel(
                                job.status,
                            )
                    }
                </span>
            </div>


            <div className="wca-progress-track">
                <div
                    className="wca-progress-value"
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


            <div className="wca-job-progress-meta">
                <span>
                    {
                        job.currentStage
                        || serverJob?.current_stage
                        || getStatusLabel(
                            job.status,
                        )
                    }
                </span>

                <strong>
                    {
                        Math.max(
                            0,
                            Math.min(
                                100,
                                job.progress || 0,
                            ),
                        )
                    }
                    %
                </strong>
            </div>


            {(
                job.currentWeek
                ?? serverJob?.current_week
            ) && (
                    <p className="wca-current-week">
                        Analizando Semana
                        {' '}
                        {
                            job.currentWeek
                            ?? serverJob?.current_week
                        }
                    </p>
                )}


            {(
                job.status === 'creating'
                || job.status === 'queued'
                || job.status === 'processing'
            ) && (
                    <p className="wca-job-muted">
                        El análisis se ejecuta en segundo plano.
                        Puedes continuar utilizando el sistema.
                    </p>
                )}


            {job.status === 'failed' && (
                <div className="wca-job-error">
                    <p>
                        {
                            job.error
                            || 'El curso no pudo procesarse.'
                        }
                    </p>

                    <button
                        type="button"
                        disabled={
                            disabled
                        }
                        onClick={
                            onRetry
                        }
                    >
                        Reintentar curso
                    </button>
                </div>
            )}


            {job.status === 'completed' && (
                <>
                    <div className="wca-completed-info">
                        <div>
                            <span>
                                Secciones correctas
                            </span>

                            <strong>
                                {
                                    summary
                                        ?.successful_sections
                                    ?? 0
                                }
                            </strong>
                        </div>

                        <div>
                            <span>
                                Secciones con error
                            </span>

                            <strong>
                                {
                                    summary
                                        ?.failed_sections
                                    ?? 0
                                }
                            </strong>
                        </div>

                        <div>
                            <span>
                                Celdas actualizadas
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
                                {
                                    serverJob?.provider
                                    || '—'
                                }
                            </strong>
                        </div>

                        <div>
                            <span>
                                Tiempo
                            </span>

                            <strong>
                                {
                                    result
                                        ?.elapsed_seconds
                                        ? `${result.elapsed_seconds} s`
                                        : '—'
                                }
                            </strong>
                        </div>
                    </div>


                    {partialSuccess && (
                        <div className="wca-partial-message">
                            El curso terminó, pero una o más
                            semanas no pudieron completarse.
                            Las demás semanas sí fueron procesadas.
                        </div>
                    )}


                    {result?.matrix && (
                        <div className="wca-matrix-result">
                            <div>
                                <span>
                                    Destino
                                </span>

                                <strong>
                                    {
                                        result.matrix
                                            ?.file
                                            ?.name
                                        || '02_Matriz observaciones estructura'
                                    }
                                </strong>

                                <small>
                                    Hoja:
                                    {' '}
                                    {
                                        result.matrix
                                            ?.sheet
                                        || 'F2_Semanas'
                                    }
                                    {' · '}
                                    Columna:
                                    {' '}
                                    {
                                        result.matrix
                                            ?.column
                                        || 'H'
                                    }
                                </small>
                            </div>


                            {result.matrix
                                ?.file
                                ?.webViewLink && (
                                    <a
                                        href={
                                            result.matrix
                                                .file
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


                    {result?.warnings?.length > 0 && (
                        <details className="wca-result-warnings">
                            <summary>
                                Advertencias
                                {' ('}
                                {
                                    result.warnings
                                        .length
                                }
                                {')'}
                            </summary>

                            <ul>
                                {result.warnings.map(
                                    (
                                        warning,
                                        index,
                                    ) => (
                                        <li
                                            key={
                                                index
                                            }
                                        >
                                            {warning}
                                        </li>
                                    ),
                                )}
                            </ul>
                        </details>
                    )}


                    <SectionResults
                        result={
                            result
                        }
                    />
                </>
            )}
        </article>
    );
};


const WeekJobs = ({
    readyCourses,
    jobs,
    processing,
    onGenerate,
    onRetry,
}) => {
    const jobValues = (
        Object.values(
            jobs,
        )
    );


    const completedJobs = (
        jobValues.filter(
            (job) => (
                job.status === 'completed'
            ),
        ).length
    );


    const failedJobs = (
        jobValues.filter(
            (job) => (
                job.status === 'failed'
            ),
        ).length
    );


    const activeJobs = (
        jobValues.filter(
            (job) => (
                job.status === 'creating'
                || job.status === 'queued'
                || job.status === 'processing'
            ),
        ).length
    );


    return (
        <section className="wca-card">
            <div className="wca-section-heading">
                <div>
                    <span className="wca-step">
                        3
                    </span>

                    <div>
                        <h3>
                            Generar observaciones
                        </h3>

                        <p>
                            Cada curso se procesa uno por uno.
                            Dentro del curso se analiza Diagnóstico
                            y las Semanas 2 a 11.
                        </p>
                    </div>
                </div>
            </div>


            {readyCourses.length === 0 ? (
                <div className="wca-blocked-message">
                    Ningún curso está listo para
                    generar observaciones.
                </div>

            ) : (
                <button
                    type="button"
                    className="wca-generate-button"
                    disabled={
                        processing
                    }
                    onClick={
                        onGenerate
                    }
                >
                    {
                        processing
                            ? 'Procesando cursos...'
                            : (
                                readyCourses.length === 1
                                    ? 'Generar observaciones'
                                    : `Generar observaciones de ${readyCourses.length} cursos`
                            )
                    }
                </button>
            )}


            {jobValues.length > 0 && (
                <div className="wca-job-area">
                    <div className="wca-job-summary">
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
                                {activeJobs}
                            </strong>

                            <span>
                                procesando
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
                                {readyCourses.length}
                            </strong>

                            <span>
                                total
                            </span>
                        </div>
                    </div>


                    <div className="wca-jobs">
                        {readyCourses.map(
                            (course) => {
                                const key = (
                                    jobKey(
                                        course,
                                    )
                                );


                                const job = (
                                    jobs[
                                    key
                                    ]
                                );


                                if (
                                    !job
                                ) {
                                    return (
                                        <QueuedCourse
                                            key={
                                                key
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
                                            key
                                        }
                                        course={
                                            course
                                        }
                                        job={
                                            job
                                        }
                                        disabled={
                                            processing
                                        }
                                        onRetry={
                                            () => {
                                                onRetry(
                                                    course,
                                                );
                                            }
                                        }
                                    />
                                );
                            },
                        )}
                    </div>
                </div>
            )}
        </section>
    );
};


export default WeekJobs;