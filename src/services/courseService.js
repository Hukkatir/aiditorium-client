import apiClient from './apiClient';

export const courseService = {
    // Получить мои курсы
    async getMyCourses() {
        const response = await apiClient.get('/course/viewMine');
        return response.data; // предполагаем, что data содержит courses
    },

    // Создать курс (multipart/form-data)
    async createCourse(formData) {
        const response = await apiClient.post('/course', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    // Присоединиться к курсу по коду
    async joinCourse(code) {
        const response = await apiClient.post('/course/addUser', { code });
        return response.data;
    },

    // Получить информацию о курсе (если нужно)
    async getCourse(courseId) {
        const response = await apiClient.get(`/course/${courseId}`);
        return response.data;
    },
    /*async getCourse(id) {
        const response = await apiClient.get(`/course/${id}`);
        return response.data;
    }*/
};