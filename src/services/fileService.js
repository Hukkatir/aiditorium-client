import apiClient from './apiClient';

const extractFileName = (headers, fallbackName = 'file') => {
    const disposition = headers?.['content-disposition'] || headers?.['Content-Disposition'];

    if (!disposition) {
        return fallbackName;
    }

    const utfMatch = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    if (utfMatch?.[1]) {
        return decodeURIComponent(utfMatch[1]);
    }

    const plainMatch = disposition.match(/filename\s*=\s*"?(.*?)"?(;|$)/i);
    if (plainMatch?.[1]) {
        return plainMatch[1];
    }

    return fallbackName;
};

const triggerBrowserDownload = (blob, fileName) => {
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);
};

const buildFileBlob = (payload) => (payload instanceof Blob ? payload : new Blob([payload]));

const getFileAsset = async (fileId, fallbackName = 'file') => {
    const response = await apiClient.get(`/file/download/${fileId}`, {
        responseType: 'blob'
    });

    const fileName = extractFileName(response.headers, fallbackName);
    const blob = buildFileBlob(response.data);

    return {
        blob,
        fileName,
        contentType: blob.type || response.headers?.['content-type'] || ''
    };
};

export const fileService = {
    async getMyFiles(params = {}) {
        const response = await apiClient.get('/file', { params });
        return response.data;
    },

    async downloadFile(fileId, fallbackName = 'file') {
        const { blob, fileName } = await getFileAsset(fileId, fallbackName);

        triggerBrowserDownload(blob, fileName);
    },

    async openFile(fileId, fallbackName = 'file') {
        const { blob, fileName } = await getFileAsset(fileId, fallbackName);
        const objectUrl = window.URL.createObjectURL(blob);
        const openedWindow = window.open(objectUrl, '_blank', 'noopener,noreferrer');

        if (!openedWindow) {
            triggerBrowserDownload(blob, fileName);
            return;
        }

        setTimeout(() => {
            window.URL.revokeObjectURL(objectUrl);
        }, 60_000);
    },

    async getFilePreview(fileId, fallbackName = 'file') {
        const { blob, fileName, contentType } = await getFileAsset(fileId, fallbackName);

        return {
            blob,
            fileName,
            contentType,
            objectUrl: window.URL.createObjectURL(blob)
        };
    }
};
