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
        const response = await apiClient.post('/task', formData);
        return response.data;
    },

    // Получить информацию о задании
    async getTask(courseIdOrSlug, disciplineIdOrSlug, taskNumber) {
        const response = await apiClient.get(`/course/${courseIdOrSlug}/discipline/${disciplineIdOrSlug}/task/${taskNumber}`);
        return response.data;
    },

    // Обновить задание
    async updateTask(taskId, formData) {
        formData.append('_method', 'PUT');
        const response = await apiClient.post(`/task/${taskId}`, formData);
        return response.data;
    },

    // Удалить задание
    async deleteTask(taskId) {
        const response = await apiClient.delete(`/task/${taskId}`);
        return response.data;
    },

    async submitTask(taskId, files, comment = '') {
        const fileList = (Array.isArray(files) ? files : [files]).filter(Boolean);

        if (!fileList.length) {
            throw new Error('No files to submit');
        }

        const results = [];

        for (const file of fileList) {
            const formData = new FormData();
            formData.append('task_id', taskId);
            formData.append('file', file);

            if (comment.trim()) {
                formData.append('comment', comment.trim());
            }

            const response = await apiClient.post('/task/submit', formData);
            results.push(response.data);
        }

        return results.length === 1 ? results[0] : results;
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
