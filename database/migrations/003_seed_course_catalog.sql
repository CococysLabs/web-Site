INSERT INTO
    course_catalog (area, code, name)
VALUES
    ('Computacion', '281', 'Sistemas Operativos 1'),
    ('Computacion', '285', 'Sistemas Operativos 2'),
    (
        'Computacion',
        '777',
        'Organización Lenguajes y Compiladores 1'
    ),
    (
        'Computacion',
        '778',
        'Arquitectura de Computadoras y Ensambladores 1'
    ),
    (
        'Computacion',
        '779',
        'Arquitectura de Computadoras y Ensambladores 2'
    ),
    (
        'Computacion',
        '781',
        'Organización de Lenguajes y Compiladores 2'
    ),
    (
        'Computacion',
        '796',
        'Lenguajes Formales y de Programación'
    ),
    (
        'Computacion',
        '964',
        'Organización Computacional'
    ),
    ('Computacion', '970', 'Redes de Computadoras 1'),
    ('Computacion', '972', 'Inteligencia Artificial 1'),
    ('Computacion', '975', 'Redes de Computadoras 2'),
    ('Sistemas', '14', 'Economía'),
    ('Sistemas', '89', 'Comunicación Asertiva'),
    ('Sistemas', '720', 'Modelación y Simulación 2'),
    ('Sistemas', '722', 'Teoría de Sistemas 1'),
    ('Sistemas', '724', 'Teoría de Sistemas 2'),
    ('Sistemas', '729', 'Modelación y Simulación 1'),
    (
        'Sistemas',
        '786',
        'Sistemas Organizacionales y Gerenciales 1'
    ),
    (
        'Sistemas',
        '787',
        'Sistemas Organizacionales y Gerenciales 2'
    ),
    ('Sistemas', '795', 'Lógica de Sistemas'),
    ('Sistemas', '797', 'Seminario de Sistemas 1'),
    ('Sistemas', '798', 'Seminario de Sistemas 2'),
    (
        'Software',
        '90',
        'Programación de Computadoras 1'
    ),
    (
        'Software',
        '92',
        'Programación de Computadoras 2'
    ),
    (
        'Software',
        '283',
        'Análisis y Diseño de Sistemas 1'
    ),
    ('Software', '667', 'Programación Comercial 1'),
    (
        'Software',
        '768',
        'Introducción a los Algoritmos y Flujo de Datos'
    ),
    (
        'Software',
        '770',
        'Introducción a la Programación y Computación 1'
    ),
    (
        'Software',
        '771',
        'Introducción a la Programación y Computación 2'
    ),
    ('Software', '772', 'Estructuras de Datos'),
    (
        'Software',
        '773',
        'Manejo e Implementación de Archivos'
    ),
    ('Software', '774', 'Base de Datos 1'),
    ('Software', '775', 'Base de Datos 2'),
    ('Software', '780', 'Software Avanzado'),
    (
        'Software',
        '785',
        'Análisis y Diseño de Sistemas 2'
    ) ON CONFLICT (area, code) DO
UPDATE
SET
    name = EXCLUDED.name,
    is_active = TRUE,
    updated_at = NOW ();