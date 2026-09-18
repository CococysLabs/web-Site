const FileStatus = ({
    label,
    found,
    optional = false,
    fileName = '',
}) => {
    let state = (
        found
            ? 'found'
            : 'missing'
    );

    let text = (
        found
            ? 'Encontrado'
            : 'No encontrado'
    );


    if (
        !found
        && optional
    ) {
        state = 'optional';

        text = (
            'No encontrado — opcional'
        );
    }


    return (
        <div
            className={
                `wca-file ${state}`
            }
        >
            <span className="wca-file-indicator" />

            <div>
                <strong>
                    {label}
                </strong>

                <small>
                    {text}
                </small>

                {fileName && (
                    <small
                        className="wca-file-name"
                        title={
                            fileName
                        }
                    >
                        {fileName}
                    </small>
                )}
            </div>
        </div>
    );
};


const optionalCount = (
    files,
) => (
    Array.isArray(files)
        ? files.length
        : 0
);


const WeekMaterialRow = ({
    week,
    data,
}) => {
    const optional = (
        data?.optional
        || {}
    );


    const optionalEntries = [
        {
            key: 'lectura',
            label: 'Lectura',
        },
        {
            key: 'video',
            label: 'Video',
        },
        {
            key: 'actividad_practica',
            label: 'Actividad práctica',
        },
        {
            key: 'ejemplo',
            label: 'Ejemplo',
        },
    ];


    return (
        <div className="wca-week-material">
            <div className="wca-week-material-title">
                <strong>
                    Semana {week}
                </strong>

                {!data?.folder && (
                    <span className="wca-small-status danger">
                        Carpeta no encontrada
                    </span>
                )}
            </div>


            <div className="wca-week-files">
                <FileStatus
                    label="Presentación PDF"
                    found={
                        Boolean(
                            data?.presentation
                                ?.valid_format
                        )
                    }
                    fileName={
                        data?.presentation
                            ?.file
                            ?.name
                        || ''
                    }
                />

                <FileStatus
                    label="Google Sheets / XLSX"
                    found={
                        Boolean(
                            data?.presentation_sheet
                                ?.valid_format
                        )
                    }
                    fileName={
                        data?.presentation_sheet
                            ?.file
                            ?.name
                        || ''
                    }
                />
            </div>


            <div className="wca-optional-line">
                {optionalEntries.map(
                    ({
                        key,
                        label,
                    }) => {
                        const count = (
                            optionalCount(
                                optional[
                                key
                                ],
                            )
                        );

                        return (
                            <span
                                key={
                                    key
                                }
                                className={
                                    `wca-optional-chip ${count > 0
                                        ? 'found'
                                        : ''
                                    }`
                                }
                            >
                                {label}
                                {': '}
                                {
                                    count > 0
                                        ? `Sí (${count})`
                                        : 'No'
                                }
                            </span>
                        );
                    },
                )}
            </div>
        </div>
    );
};


const PreviewCourse = ({
    course,
}) => {
    const courseInfo = (
        course?.course
        || {}
    );


    let state = 'ready';
    let stateLabel = 'Listo';


    if (
        !course?.success
    ) {
        state = 'blocked';
        stateLabel = 'Error';

    } else if (
        !course?.ready_for_analysis
        || !course?.ready_for_write
    ) {
        state = 'blocked';
        stateLabel = 'Bloqueado';

    } else if (
        course?.warnings?.length > 0
    ) {
        state = 'warning';
        stateLabel = 'Con advertencias';
    }


    const diagnostic = (
        course?.diagnostic
        || {}
    );


    const weeks = (
        course?.weeks
        || {}
    );


    return (
        <article
            className={
                `wca-preview-course ${state}`
            }
        >
            <div className="wca-preview-course-header">
                <div>
                    <strong>
                        {
                            courseInfo.code
                            || '—'
                        }
                    </strong>

                    <h4>
                        {
                            courseInfo.name
                            || 'Curso'
                        }
                    </h4>

                    <small>
                        {
                            courseInfo.area
                            || ''
                        }
                    </small>
                </div>


                <span
                    className={
                        `wca-status ${state}`
                    }
                >
                    {stateLabel}
                </span>
            </div>


            {course?.period && (
                <div className="wca-period-line">
                    <span>
                        Carpeta actual:
                        {' '}
                        <strong>
                            {
                                course.period
                                    ?.source_period
                                || '—'
                            }
                        </strong>
                    </span>

                    <span>
                        Material esperado:
                        {' '}
                        <strong>
                            {
                                course.period
                                    ?.target_period
                                || '—'
                            }
                        </strong>
                    </span>
                </div>
            )}


            {course?.error && (
                <div className="wca-course-error">
                    {course.error}
                </div>
            )}


            {course?.matrix && (
                <div className="wca-matrix-preview">
                    <div>
                        <span>
                            Matriz
                        </span>

                        <strong>
                            {
                                course.matrix
                                    ?.file
                                    ?.name
                                || '02_Matriz observaciones estructura'
                            }
                        </strong>

                        <small>
                            Hoja:
                            {' '}
                            {
                                course.matrix
                                    ?.sheet
                                || 'F2_Semanas'
                            }
                            {' · '}
                            Columna:
                            {' '}
                            {
                                course.matrix
                                    ?.column
                                || 'H'
                            }
                        </small>
                    </div>


                    {course.matrix
                        ?.file
                        ?.webViewLink && (
                            <a
                                href={
                                    course.matrix
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


            {course?.success && (
                <details className="wca-material-details">
                    <summary>
                        Ver materiales detectados
                    </summary>


                    <div className="wca-material-details-body">
                        <div className="wca-diagnostic-block">
                            <div className="wca-week-material-title">
                                <strong>
                                    Semana Diagnóstico
                                </strong>

                                {!diagnostic?.folder && (
                                    <span className="wca-small-status danger">
                                        4_Diagnostico no encontrado
                                    </span>
                                )}
                            </div>


                            <div className="wca-week-files">
                                <FileStatus
                                    label="Diagnóstico PDF"
                                    found={
                                        Boolean(
                                            diagnostic
                                                ?.presentation
                                                ?.valid_format
                                        )
                                    }
                                    fileName={
                                        diagnostic
                                            ?.presentation
                                            ?.file
                                            ?.name
                                        || ''
                                    }
                                />

                                <FileStatus
                                    label="Tarea de Fortalecimiento"
                                    found={
                                        Boolean(
                                            diagnostic
                                                ?.strengthening
                                                ?.valid_format
                                        )
                                    }
                                    fileName={
                                        diagnostic
                                            ?.strengthening
                                            ?.file
                                            ?.name
                                        || ''
                                    }
                                />
                            </div>
                        </div>


                        {Array.from(
                            {
                                length: 10,
                            },
                            (
                                _,
                                index,
                            ) => (
                                index + 2
                            ),
                        ).map(
                            (week) => (
                                <WeekMaterialRow
                                    key={
                                        week
                                    }
                                    week={
                                        week
                                    }
                                    data={
                                        weeks[
                                        String(
                                            week
                                        )
                                        ]
                                        || weeks[
                                        week
                                        ]
                                    }
                                />
                            ),
                        )}
                    </div>
                </details>
            )}


            {course?.warnings?.length > 0 && (
                <div className="wca-warning-list">
                    <strong>
                        Advertencias
                    </strong>

                    {course.warnings.map(
                        (
                            warning,
                            index,
                        ) => (
                            <p
                                key={
                                    `${courseInfo.code || 'course'}-${index}`
                                }
                            >
                                {String(warning)}
                            </p>
                        ),
                    )}
                </div>
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
            `wca-summary ${tone}`
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


const WeekPreview = ({
    selectedCount,
    checking,
    processing,
    onCheck,
    preview,
    previewIsCurrent,
}) => {
    return (
        <section className="wca-card">
            <div className="wca-section-heading">
                <div>
                    <span className="wca-step">
                        2
                    </span>

                    <div>
                        <h3>
                            Comprobar materiales
                        </h3>

                        <p>
                            Verifica Diagnóstico, Semanas 2 a 11,
                            PDF, Google Sheets/XLSX y la matriz
                            antes de utilizar IA.
                        </p>
                    </div>
                </div>
            </div>


            <button
                type="button"
                className="wca-primary-button"
                disabled={
                    checking
                    || processing
                    || selectedCount === 0
                }
                onClick={
                    onCheck
                }
            >
                {
                    checking
                        ? 'Comprobando materiales...'
                        : (
                            selectedCount === 1
                                ? 'Comprobar curso'
                                : `Comprobar ${selectedCount} cursos`
                        )
                }
            </button>


            {!previewIsCurrent
                && selectedCount === 0 && (
                    <div className="wca-inline-placeholder">
                        Selecciona al menos un curso
                        para comprobar sus materiales.
                    </div>
                )}


            {previewIsCurrent && (
                <div className="wca-preview">
                    <div className="wca-summary-grid">
                        <Summary
                            label="Seleccionados"
                            value={
                                preview?.summary
                                    ?.total_courses
                                || 0
                            }
                        />

                        <Summary
                            label="Listos"
                            value={
                                preview?.summary
                                    ?.ready_for_write
                                || 0
                            }
                            tone="success"
                        />

                        <Summary
                            label="Con advertencias"
                            value={
                                preview?.summary
                                    ?.with_warnings
                                || 0
                            }
                            tone="warning"
                        />

                        <Summary
                            label="Bloqueados"
                            value={
                                preview?.summary
                                    ?.blocked
                                || 0
                            }
                            tone="danger"
                        />
                    </div>


                    <div className="wca-preview-list">
                        {preview?.courses?.map(
                            (
                                course,
                                index,
                            ) => (
                                <PreviewCourse
                                    key={
                                        course?.course
                                            ?.folder_id
                                        || index
                                    }
                                    course={
                                        course
                                    }
                                />
                            ),
                        )}
                    </div>
                </div>
            )}
        </section>
    );
};


export default WeekPreview;