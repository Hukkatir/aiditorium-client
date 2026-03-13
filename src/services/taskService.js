import apiClient from './apiClient';

export const taskService = {
    // Получить задания с возможностью фильтрации (по дисциплине, курсу и т.д.)
    async getTasks(params = {}) {
        const response = await apiClient.get('/task/viewTasks', { params });
        return response.data; // ожидаем пагинированный ответ с полем data
    },

    // Получить задания по дисциплине
    async getTasksByDiscipline(disciplineId) {
        return this.getTasks({ discipline_id: disciplineId, per_page: 100 });
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
    },

    // Обновить задание
    async updateTask(taskId, formData) {
        const response = await apiClient.put(`/task/${taskId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    // Удалить задание
    async deleteTask(taskId) {
        const response = await apiClient.delete(`/task/${taskId}`);
        return response.data;
    }
};