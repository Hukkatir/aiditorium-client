import apiClient from './apiClient';

export const authService = {
    async login(credentials) {
        const response = await apiClient.post('/login', credentials);
        const { user, authorization } = response.data;
        return { user, token: authorization.token };
    },

    async register(userData) {
        const response = await apiClient.post('/register', userData);
        const { user, authorization } = response.data;
        return { user, token: authorization.token };
    },

    async logout() {
        await apiClient.post('/logout');
    },

    async refresh() {
        const response = await apiClient.post('/refresh');
        const { user, authorization } = response.data;
        return { user, token: authorization.token };
    },

    async getProfile() {
        const response = await apiClient.get('/user');
        return response.data;
    },

    async updateProfile(data) {
        const response = await apiClient.post('/user/edit', data);
        return response.data;
    }
};
