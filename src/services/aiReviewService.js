import apiClient from './apiClient';

export const aiReviewService = {
    async getReviewProfile(taskId) {
        const response = await apiClient.get(`/task/${taskId}/review-profile`);
        return response.data;
    },

    async updateReviewProfile(taskId, payload) {
        const response = await apiClient.put(`/task/${taskId}/review-profile`, payload);
        return response.data;
    },

    async getTaskAiReviews(taskId, perPage = 100) {
        const response = await apiClient.get(`/task/${taskId}/ai-reviews`, {
            params: { per_page: perPage }
        });
        return response.data;
    },

    async queueAiReview(taskId, fileId, forceRecheck = false) {
        const response = await apiClient.post(`/task/${taskId}/submission/${fileId}/ai-review`, {
            force_recheck: forceRecheck
        });
        return response.data;
    },

    async applyAiGrade(reviewId) {
        const response = await apiClient.post(`/ai-review/${reviewId}/apply-grade`);
        return response.data;
    }
};
