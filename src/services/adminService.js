import apiClient from './apiClient';

export const adminService = {
    async getDashboard() {
        const response = await apiClient.get('/admin/dashboard');
        return response.data;
    },

    async addCourseUser(courseId, userId, role) {
        const response = await apiClient.post(`/admin/course/${courseId}/users`, {
            user_id: userId,
            role
        });
        return response.data;
    },

    async removeCourseUser(courseId, userId) {
        const response = await apiClient.delete(`/admin/course/${courseId}/users/${userId}`);
        return response.data;
    }
};
