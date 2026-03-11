import apiClient from './apiClient';

export const taskService = {
    // Получить задания пользователя (возможно, по дисциплине)
    async getMyTasks() {
        const response = await apiClient.get('/task/viewTasks');
        return response.data;
    },

    // Создать задание (multipart/form-data)
    async createTask(formData) {
        const response = await apiClient.post('/task', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    // Получить информацию о задании
    async getTask(taskId) {
        const response = await apiClient.get(`/task/${taskId}`);
        return response.data;
    }
};
