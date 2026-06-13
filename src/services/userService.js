import apiClient from './apiClient';

export const userService = {
    async getUser(userId) {
        const response = await apiClient.get(`/user/${userId}`);
        return response.data;
    },

    async updateProfile(userId, data) {
        const response = await apiClient.put(`/user/${userId}`, data);
        return response.data;
    },

    async updateUser(userId, data) {
        const response = await apiClient.put(`/user/${userId}`, data);
        return response.data;
    },

    async setUserRole(userId, role) {
        const response = await apiClient.patch(`/user/setRole/${userId}`, { role });
        return response.data;
    },

    async deleteUser(userId) {
        const response = await apiClient.delete(`/user/${userId}`);
        return response.data;
    },

    async uploadAvatar(userId, file) {
        const formData = new FormData();
        formData.append('avatar', file);
        formData.append('user_id', userId);
        const response = await apiClient.post('/user/avatar/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    async deleteAvatar(userId) {
        const response = await apiClient.post('/user/avatar/destroy', { user_id: userId });
        return response.data;
    }
};
