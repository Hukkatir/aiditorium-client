import apiClient from './apiClient';

export const disciplineService = {
    // Получить дисциплины по курсу (POST с course_id)
    async getDisciplinesByCourse(courseId) {
        const response = await apiClient.post('/discipline/viewDisciplines', {
            course_id: parseInt(courseId),
            per_page: 100
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
};