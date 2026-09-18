const WeekCourseSelector = ({
    semesters,
    selectedSemesterId,
    loadingSemesters,
    onSemesterChange,

    areas,
    selectedAreaId,
    loadingAreas,
    onAreaChange,

    courses,
    selectedCourseIds,
    selectedCourses,
    loadingCourses,
    allCoursesSelected,
    disabled,

    onToggleCourse,
    onSelectAll,
    onClearAll,

    invalidCourses,
    ignoredFolders,
}) => {
    return (
        <section className="wca-card">
            <div className="wca-section-heading">
                <div>
                    <span className="wca-step">
                        1
                    </span>

                    <div>
                        <h3>
                            Seleccionar cursos
                        </h3>

                        <p>
                            Selecciona el semestre y área
                            directamente desde Recursos Educativos.
                        </p>
                    </div>
                </div>
            </div>


            <div className="wca-form-grid">
                <label className="wca-field">
                    <span>
                        Semestre
                    </span>

                    <select
                        value={
                            selectedSemesterId
                        }
                        disabled={
                            disabled
                            || loadingSemesters
                        }
                        onChange={
                            (event) => {
                                onSemesterChange(
                                    event.target.value,
                                );
                            }
                        }
                    >
                        {loadingSemesters && (
                            <option value="">
                                Cargando semestres...
                            </option>
                        )}

                        {!loadingSemesters
                            && semesters.length === 0 && (
                                <option value="">
                                    No hay semestres disponibles
                                </option>
                            )}

                        {semesters.map(
                            (semester) => (
                                <option
                                    key={
                                        semester.id
                                    }
                                    value={
                                        semester.id
                                    }
                                >
                                    {semester.name}
                                </option>
                            ),
                        )}
                    </select>
                </label>


                <label className="wca-field">
                    <span>
                        Área
                    </span>

                    <select
                        value={
                            selectedAreaId
                        }
                        disabled={
                            disabled
                            || loadingAreas
                            || !selectedSemesterId
                        }
                        onChange={
                            (event) => {
                                onAreaChange(
                                    event.target.value,
                                );
                            }
                        }
                    >
                        {loadingAreas && (
                            <option value="">
                                Cargando áreas...
                            </option>
                        )}

                        {!loadingAreas
                            && areas.length === 0 && (
                                <option value="">
                                    No hay áreas disponibles
                                </option>
                            )}

                        {areas.map(
                            (area) => (
                                <option
                                    key={
                                        area.id
                                    }
                                    value={
                                        area.id
                                    }
                                >
                                    {area.name}
                                </option>
                            ),
                        )}
                    </select>
                </label>
            </div>


            <div className="wca-course-heading">
                <div>
                    <h3>
                        Cursos
                    </h3>

                    <p>
                        Solo se muestran como seleccionables
                        los cursos encontrados en Drive y
                        validados contra CourseCatalog.
                    </p>
                </div>


                <div className="wca-mini-actions">
                    <button
                        type="button"
                        disabled={
                            disabled
                            || loadingCourses
                            || courses.length === 0
                            || allCoursesSelected
                        }
                        onClick={
                            onSelectAll
                        }
                    >
                        Todos
                    </button>

                    <button
                        type="button"
                        disabled={
                            disabled
                            || loadingCourses
                            || selectedCourseIds.length === 0
                        }
                        onClick={
                            onClearAll
                        }
                    >
                        Ninguno
                    </button>
                </div>
            </div>


            {loadingCourses ? (
                <div className="wca-placeholder">
                    Cargando cursos...
                </div>

            ) : !selectedAreaId ? (
                <div className="wca-placeholder">
                    Selecciona un área.
                </div>

            ) : courses.length === 0 ? (
                <div className="wca-placeholder">
                    No se encontraron cursos válidos
                    para esta área.
                </div>

            ) : (
                <div className="wca-course-grid">
                    {courses.map(
                        (course) => {
                            const checked = (
                                selectedCourseIds.includes(
                                    course.folder_id,
                                )
                            );

                            return (
                                <label
                                    key={
                                        course.folder_id
                                    }
                                    className={
                                        `wca-course-option ${checked
                                            ? 'selected'
                                            : ''
                                        }`
                                    }
                                >
                                    <input
                                        type="checkbox"
                                        checked={
                                            checked
                                        }
                                        disabled={
                                            disabled
                                        }
                                        onChange={
                                            () => {
                                                onToggleCourse(
                                                    course.folder_id,
                                                );
                                            }
                                        }
                                    />


                                    <div className="wca-course-content">
                                        <div className="wca-course-title">
                                            <strong>
                                                {
                                                    course.course
                                                        ?.code
                                                    || '—'
                                                }
                                            </strong>

                                            <span>
                                                {
                                                    course.course
                                                        ?.name
                                                    || course.folder_name
                                                }
                                            </span>
                                        </div>


                                        <div className="wca-course-meta">
                                            <span>
                                                Origen:
                                                {' '}
                                                <strong>
                                                    {
                                                        course
                                                            .source_period
                                                            ?.label
                                                        || '—'
                                                    }
                                                </strong>
                                            </span>

                                            <span>
                                                Material a revisar:
                                                {' '}
                                                <strong>
                                                    {
                                                        course
                                                            .target_period
                                                            ?.label
                                                        || '—'
                                                    }
                                                </strong>
                                            </span>
                                        </div>


                                        <small
                                            title={
                                                course.folder_name
                                            }
                                        >
                                            {course.folder_name}
                                        </small>
                                    </div>
                                </label>
                            );
                        },
                    )}
                </div>
            )}


            <div className="wca-selection-footer">
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


            {(
                invalidCourses.length > 0
                || ignoredFolders.length > 0
            ) && (
                    <details className="wca-drive-details">
                        <summary>
                            Ver carpetas no utilizadas
                            {' ('}
                            {
                                invalidCourses.length
                                + ignoredFolders.length
                            }
                            {')'}
                        </summary>


                        <div className="wca-drive-details-content">
                            {invalidCourses.map(
                                (course) => (
                                    <div
                                        key={
                                            course.id
                                            || course.folder_id
                                            || course.name
                                        }
                                        className="wca-drive-issue"
                                    >
                                        <strong>
                                            {
                                                course.name
                                                || course.folder_name
                                            }
                                        </strong>

                                        <span>
                                            {
                                                course.reason
                                                || 'Curso no válido'
                                            }
                                        </span>
                                    </div>
                                ),
                            )}


                            {ignoredFolders.map(
                                (folder) => (
                                    <div
                                        key={
                                            folder.id
                                            || folder.name
                                        }
                                        className="wca-drive-issue"
                                    >
                                        <strong>
                                            {folder.name}
                                        </strong>

                                        <span>
                                            {
                                                folder.reason
                                                || 'Carpeta ignorada'
                                            }
                                        </span>
                                    </div>
                                ),
                            )}
                        </div>
                    </details>
                )}
        </section>
    );
};


export default WeekCourseSelector;