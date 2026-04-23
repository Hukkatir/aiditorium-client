import { getSafeSlug } from './slugUtils';

export const getCourseIdentifier = (course) => getSafeSlug(course?.slug) || String(course?.id || '');

export const getDisciplineIdentifier = (discipline) => getSafeSlug(discipline?.slug) || String(discipline?.id || '');

export const getTaskIdentifier = (task) => String(task?.task_number ?? task?.taskNumber ?? task?.id ?? '');

export const buildCoursePath = (course) => `/course/${getCourseIdentifier(course)}`;

export const buildDisciplinePath = (course, discipline) =>
    `${buildCoursePath(course)}/discipline/${getDisciplineIdentifier(discipline)}`;

export const buildTaskPath = (course, discipline, task) =>
    `${buildDisciplinePath(course, discipline)}/task/${getTaskIdentifier(task)}`;

export const buildTaskSubmissionsPath = (course, discipline, task) =>
    `${buildTaskPath(course, discipline, task)}/submissions`;

export const buildFilePreviewPath = (fileId) => `/file/${fileId}/preview`;
