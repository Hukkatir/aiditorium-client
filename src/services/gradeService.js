import apiClient from './apiClient';

export const gradeService = {
    async createGrade(payload) {
        const response = await apiClient.post('/grade', payload);
        return response.data;
    },

    async updateGrade(gradeId, payload) {
        const response = await apiClient.put(`/grade/${gradeId}`, payload);
        return response.data;
    },

    async getCourseGrades(courseId, perPage = 100) {
        const response = await apiClient.post('/grade/course', {
            course_id: courseId,
            per_page: perPage
        });
        return response.data;
    },

    async getMyGrades(courseId, perPage = 100) {
        const response = await apiClient.post('/grade/me', {
            course_id: courseId,
            per_page: perPage
        });
        return response.data;
    }
};
