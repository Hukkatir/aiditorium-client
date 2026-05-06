import apiClient from './apiClient';

export const peerReviewService = {
    async getMyAssignments() {
        const response = await apiClient.get('/peer-review/assignments');
        return response.data;
    },

    async getTaskSettings(taskId) {
        const response = await apiClient.get(`/task/${taskId}/peer-review/settings`);
        return response.data;
    },

    async updateTaskSettings(taskId, settings) {
        const response = await apiClient.put(`/task/${taskId}/peer-review/settings`, settings);
        return response.data;
    },

    async getTaskAssignments(taskId) {
        const response = await apiClient.get(`/task/${taskId}/peer-review/assignments`);
        return response.data;
    },

    async replaceTaskAssignments(taskId, assignments) {
        const response = await apiClient.post(`/task/${taskId}/peer-review/assignments`, {
            assignments
        });
        return response.data;
    },

    async getTaskResults(taskId) {
        const response = await apiClient.get(`/task/${taskId}/peer-review/results`);
        return response.data;
    },

    async saveResult(payload) {
        const response = await apiClient.post('/peer-review/results', payload);
        return response.data;
    }
};
