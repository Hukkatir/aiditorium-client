export const getDisplayFileName = (file) => {
    if (file?.name) return file.name;
    if (file?.original_name) return file.original_name;
    if (file?.path) {
        const parts = file.path.split('/');
        return parts[parts.length - 1];
    }

    return `Файл #${file?.id ?? ''}`.trim();
};

export const getFileExtension = (fileName = '') => {
    const extension = String(fileName).split('.').pop()?.toLowerCase();
    return extension && extension !== fileName.toLowerCase() ? extension : '';
};

export const getFileKind = (file = {}) => {
    const fileName = getDisplayFileName(file);
    const extension = getFileExtension(fileName);
    const contentType = String(file?.contentType || file?.content_type || '').toLowerCase();

    if (contentType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(extension)) {
        return 'image';
    }

    if (contentType === 'application/pdf' || extension === 'pdf') {
        return 'pdf';
    }

    if (contentType.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(extension)) {
        return 'video';
    }

    if (contentType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(extension)) {
        return 'audio';
    }

    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
        return 'archive';
    }

    if (['xls', 'xlsx', 'csv'].includes(extension)) {
        return 'spreadsheet';
    }

    if (['ppt', 'pptx', 'key'].includes(extension)) {
        return 'presentation';
    }

    if (contentType.startsWith('text/') || ['txt', 'md', 'json', 'xml', 'yaml', 'yml'].includes(extension)) {
        return 'text';
    }

    if (['js', 'jsx', 'ts', 'tsx', 'py', 'php', 'java', 'cpp', 'c', 'cs', 'html', 'css'].includes(extension)) {
        return 'code';
    }

    if (['doc', 'docx', 'rtf', 'odt'].includes(extension)) {
        return 'document';
    }

    return 'file';
};

export const getFileTypeLabel = (file = {}) => {
    const labels = {
        image: 'Изображение',
        pdf: 'PDF',
        video: 'Видео',
        audio: 'Аудио',
        archive: 'Архив',
        spreadsheet: 'Таблица',
        presentation: 'Презентация',
        text: 'Текст',
        code: 'Код',
        document: 'Документ',
        file: 'Файл'
    };

    return labels[getFileKind(file)] || labels.file;
};

export const getTaskMaterials = (task) => {
    const materials = [];
    const seenIds = new Set();

    (Array.isArray(task?.attachments) ? task.attachments : []).forEach((file) => {
        const fileId = Number(file?.id);

        if (!fileId || seenIds.has(fileId)) {
            return;
        }

        seenIds.add(fileId);
        materials.push(file);
    });

    if (task?.attachment_id && !seenIds.has(Number(task.attachment_id))) {
        materials.push({
            id: task.attachment_id,
            name: task.attachment_name || `Материал #${task.attachment_id}`
        });
    }

    return materials;
};
