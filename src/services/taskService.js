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
    async getTask(courseIdOrSlug, disciplineIdOrSlug, taskNumber) {
        const response = await apiClient.get(`/course/${courseIdOrSlug}/discipline/${disciplineIdOrSlug}/task/${taskNumber}`);
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
    },

    async submitTask(taskId, file, comment = '') {
        const formData = new FormData();
        formData.append('task_id', taskId);
        formData.append('file', file);

        if (comment.trim()) {
            formData.append('comment', comment.trim());
        }

        const response = await apiClient.post('/task/submit', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        return response.data;
    },

    async unsubmitTask(taskId, fileId) {
        const response = await apiClient.post('/task/unsubmit', {
            task_id: taskId,
            file_id: fileId
        });
        return response.data;
    },

    async getTaskSubmissions(taskId, perPage = 100) {
        const response = await apiClient.post('/task/submissions', {
            task_id: taskId,
            per_page: perPage
        });
        return response.data;
    }
};
