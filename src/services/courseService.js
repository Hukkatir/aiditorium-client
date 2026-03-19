/*
import apiClient from './apiClient';

export const courseService = {
    // Получить мои курсы
    async getMyCourses() {
        const response = await apiClient.get('/course/viewMine');
        return response.data; // предполагаем, что data содержит courses
    },

    // Создать курс (multipart/form-data)
    async createCourse(formData) {
        const response = await apiClient.post('/course', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    // Присоединиться к курсу по коду
    async joinCourse(code) {
        const response = await apiClient.post('/course/addUser', { code });
        return response.data;
    },

    // Получить информацию о курсе (если нужно)
    async getCourse(courseId) {
        const response = await apiClient.get(`/course/${courseId}`);
        return response.data;
    },
    // Участники курса (предполагаем GET /course/{courseId}/users)
    async getCourseUsers(courseId) {
        const response = await apiClient.get(`/course/${courseId}/getUsers`);
        return response.data;
    },

    // Удалить пользователя из курса
    async removeUserFromCourse(courseId, userId) {
        const response = await apiClient.post(`/course/removeUser/${courseId}`, { user_id: userId });
        return response.data;
    },

    // Сгенерировать код для учителя
    async generateTeacherCode(courseId) {
        const response = await apiClient.post(`/course/generateCode/${courseId}`);
        return response.data;
    },

    // Обновить код приглашения
    async regenerateInviteCode(courseId) {
        const response = await apiClient.patch(`/course/${courseId}/regenerateInviteCode`);
        return response.data;
    },

    // Обновить курс (multipart/form-data)
    async updateCourse(courseId, formData) {
        const response = await apiClient.put(`/course/${courseId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    // Закрыть курс
    async closeCourse(courseId) {
        const response = await apiClient.patch(`/course/${courseId}/close`);
        return response.data;
    },

    // Открыть курс
    async reopenCourse(courseId) {
        const response = await apiClient.patch(`/course/${courseId}/reopen`);
        return response.data;
    },

    // Архивировать курс
    async archiveCourse(courseId) {
        const response = await apiClient.delete(`/course/archive/${courseId}`);
        return response.data;
    },

    // Восстановить курс
    async restoreCourse(courseId) {
        const response = await apiClient.post(`/course/restore/${courseId}`);
        return response.data;
    },

    // Полное удаление курса
    async deleteCourse(courseId) {
        const response = await apiClient.delete(`/course/${courseId}`);
        return response.data;
    }
};*/

import apiClient from './apiClient';

export const courseService = {
    // Получить курс по ID (оставим для совместимости)
    async getCourse(id) {
        const response = await apiClient.get(`/course/${id}`);
        return response.data;
    },

    // Получить курс по slug
    async getCourseBySlug(slug) {
        const response = await apiClient.get(`/course/slug/${slug}`); // предполагаемый эндпоинт
        return response.data;
    },

    // Мои курсы (для списка)
    async getMyCourses() {
        const response = await apiClient.get('/course/viewMine');
        return response.data;
    },

    // Создать курс
    async createCourse(formData) {
        const response = await apiClient.post('/course', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    // Обновить курс (multipart/form-data)
    async updateCourse(id, formData) {
        const response = await apiClient.put(`/course/${id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    // Получить участников курса
    async getCourseUsers(courseId) {
        const response = await apiClient.get(`/course/${courseId}/getUsers`);
        return response.data;
    },

    // Действия с кодом приглашения
    async generateTeacherCode(courseId) {
        const response = await apiClient.post(`/course/generateCode/${courseId}`);
        return response.data;
    },

    async regenerateInviteCode(courseId) {
        const response = await apiClient.patch(`/course/${courseId}/regenerateInviteCode`);
        return response.data;
    },

    // Управление курсом
    async closeCourse(courseId) {
        const response = await apiClient.patch(`/course/${courseId}/close`);
        return response.data;
    },

    async reopenCourse(courseId) {
        const response = await apiClient.patch(`/course/${courseId}/reopen`);
        return response.data;
    },

    async archiveCourse(courseId) {
        const response = await apiClient.delete(`/course/archive/${courseId}`);
        return response.data;
    },

    async restoreCourse(courseId) {
        const response = await apiClient.post(`/course/restore/${courseId}`);
        return response.data;
    },

    async deleteCourse(courseId) {
        const response = await apiClient.delete(`/course/${courseId}`);
        return response.data;
    },

    async removeUser(courseId, userId) {
        const response = await apiClient.post(`/course/removeUser/${courseId}`, { user_id: userId });
        return response.data;
    }
};