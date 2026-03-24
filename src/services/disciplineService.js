import apiClient from './apiClient';

export const disciplineService = {
    async getDisciplinesByCourse(courseId) {
        const response = await apiClient.get('/discipline/viewDisciplines', {
            params: {
                course_id: parseInt(courseId),
                per_page: 100
            }
        });
        return response.data;
    },

    async createDiscipline(data) {
        const response = await apiClient.post('/discipline', data);
        return response.data;
    },

    async updateDiscipline(disciplineId, data) {
        const response = await apiClient.put(`/discipline/${disciplineId}`, data);
        return response.data;
    },

    async deleteDiscipline(disciplineId) {
        const response = await apiClient.delete(`/discipline/${disciplineId}`);
        return response.data;
    },

    async getDiscipline(courseIdOrSlug, disciplineIdOrSlug) {
        const response = await apiClient.get(`/course/${courseIdOrSlug}/discipline/${disciplineIdOrSlug}`);
        return response.data;
    }
};
