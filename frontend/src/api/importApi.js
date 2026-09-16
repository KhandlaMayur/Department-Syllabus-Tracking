import apiClient from './client';

/**
 * importApi.js — Excel import API wrappers for Phase 4.
 * All functions return Axios promises.
 */
const importApi = {
  /**
   * Upload an Excel file for a given import type.
   * @param {string} type - students|faculty|subjects|batches|syllabus|timetable
   * @param {File} file - The File object from input/drop
   * @param {function} onProgress - (percent: number) => void  (optional)
   */
  upload(type, file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post(`/excel-import/${type}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
        ? (e) => {
            const percent = e.total ? Math.round((e.loaded * 100) / e.total) : 0;
            onProgress(percent);
          }
        : undefined,
      // Large files may take a while to process server-side
      timeout: 120_000,
    });
  },

  /** Paginated import history */
  getHistory(params) {
    return apiClient.get('/excel-import/history', { params });
  },

  /** Single import detail + preview rows */
  getDetail(id) {
    return apiClient.get(`/excel-import/${id}`);
  },

  /** Get failed/invalid/duplicate rows for download */
  getFailedRows(id, statuses) {
    const params = statuses ? { statuses: statuses.join(',') } : {};
    return apiClient.get(`/excel-import/${id}/failed-rows`, { params });
  },
};

export default importApi;
