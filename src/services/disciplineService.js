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
    async getDiscipline(courseIdOrSlug, disciplineIdOrSlug) {
        const response = await apiClient.get(`/course/${courseIdOrSlug}/discipline/${disciplineIdOrSlug}`);
        return response.data;
    }
};
