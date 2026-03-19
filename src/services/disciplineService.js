/*
import apiClient from './apiClient';

export const disciplineService = {
    // Получить дисциплины по курсу (GET с query-параметрами)
    async getDisciplinesByCourse(courseId) {
        const response = await apiClient.get('/discipline/viewDisciplines', {
            params: {
                course_id: parseInt(courseId),
                per_page: 100  // или можно передавать извне
            }
        });
        return response.data; // возвращает пагинатор: { data: [...], ... }
    },

    // Создать дисциплину
    async createDiscipline(data) {
        const response = await apiClient.post('/discipline', data);
        return response.data;
    },

    // Получить одну дисциплину
    async getDiscipline(disciplineId) {
        const response = await apiClient.get(`/discipline/${disciplineId}`);
        return response.data;
    }
};*/

import apiClient from './apiClient';

export const disciplineService = {
    // Получить дисциплины по ID курса (для внутреннего использования)
    async getDisciplinesByCourse(courseId) {
        const response = await apiClient.post('/discipline/viewDisciplines', {
            course_id: parseInt(courseId),
            per_page: 100
        });
        return response.data;
    },

    // Получить дисциплину по ID
    async getDiscipline(disciplineId) {
        const response = await apiClient.get(`/discipline/${disciplineId}`);
        return response.data;
    },

    // Получить дисциплину по slug (курса и дисциплины)
    async getDisciplineBySlug(courseSlug, disciplineSlug) {
        const response = await apiClient.get(`/discipline/slug/${courseSlug}/${disciplineSlug}`);
        return response.data;
    },

    // Создать дисциплину
    async createDiscipline(data) {
        const response = await apiClient.post('/discipline', data);
        return response.data;
    },

    // Обновить дисциплину (если понадобится)
    async updateDiscipline(id, data) {
        const response = await apiClient.put(`/discipline/${id}`, data);
        return response.data;
    },

    // Удалить дисциплину
    async deleteDiscipline(id) {
        const response = await apiClient.delete(`/discipline/${id}`);
        return response.data;
    }
};