import apiClient from './apiClient';

export const adminService = {
    async getDashboard() {
        const response = await apiClient.get('/admin/dashboard');
        return response.data;
    }
};
