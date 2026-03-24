export const getCourseIdentifier = (course) => course?.slug || String(course?.id || '');

export const getDisciplineIdentifier = (discipline) => discipline?.slug || String(discipline?.id || '');

export const getTaskIdentifier = (task) => String(task?.task_number ?? task?.taskNumber ?? task?.id ?? '');

export const buildCoursePath = (course) => `/course/${getCourseIdentifier(course)}`;

export const buildDisciplinePath = (course, discipline) =>
    `${buildCoursePath(course)}/discipline/${getDisciplineIdentifier(discipline)}`;

export const buildTaskPath = (course, discipline, task) =>
    `${buildDisciplinePath(course, discipline)}/task/${getTaskIdentifier(task)}`;
