import apiClient from './apiClient';

export const commentService = {
    async createComment(payload) {
        const response = await apiClient.post('/comment', payload);
        return response.data;
    },

    async getTaskComments(taskId, perPage = 100) {
        const response = await apiClient.post('/comment/viewTask', {
            task_id: taskId,
            per_page: perPage
        });
        return response.data;
    },

    async getMyComments(courseId, params = {}) {
        const response = await apiClient.get('/comment/my', {
            params: {
                course_id: courseId,
                per_page: 100,
                ...params
            }
        });
        return response.data;
    },

    async getReplies(commentId) {
        const response = await apiClient.get(`/comment/${commentId}/replies`);
        return response.data;
    }
};
