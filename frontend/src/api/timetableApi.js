import apiClient from './client';

const timetableApi = {
  /**
   * Preview a timetable file upload (PDF, Excel, or Image)
   */
  preview({ file, academicYearId, semesterId, divisionId, departmentId, onProgress }) {
    const formData = new FormData();
    formData.append('file', file);
    if (academicYearId) formData.append('academicYearId', academicYearId);
    if (semesterId) formData.append('semesterId', semesterId);
    if (divisionId) formData.append('divisionId', divisionId);
    if (departmentId) formData.append('departmentId', departmentId);

    return apiClient.post('/timetables/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000, // OCR/PDF might take a few seconds
      onUploadProgress: onProgress
        ? (e) => {
            const percent = e.total ? Math.round((e.loaded * 100) / e.total) : 0;
            onProgress(percent);
          }
        : undefined,
    });
  },

  /**
   * Finalize/commit the previewed timetable to the database
   */
  commit(data) {
    return apiClient.post('/timetables/commit', data);
  },

  /**
   * List timetables (with filters and pagination)
   */
  list(params) {
    return apiClient.get('/timetables', { params });
  },

  /**
   * Single timetable details with entries & analysis
   */
  getById(id) {
    return apiClient.get(`/timetables/${id}`);
  },

  /**
   * Weekly lecture analysis
   */
  getAnalysis(id) {
    return apiClient.get(`/timetables/${id}/analysis`);
  },

  /**
   * Update timetable status / notes
   */
  update(id, data) {
    return apiClient.put(`/timetables/${id}`, data);
  },

  /**
   * Delete timetable
   */
  delete(id) {
    return apiClient.delete(`/timetables/${id}`);
  },

  /**
   * Faculty schedule (own or queried)
   */
  getFacultySchedule(params) {
    return apiClient.get('/timetables/faculty/schedule', { params });
  },

  /**
   * Student schedule (derived strictly from authenticated student profile)
   */
  getStudentSchedule() {
    return apiClient.get('/timetables/student/schedule');
  },

  /**
   * Class Coordinator schedule
   */
  getCCSchedule(params) {
    return apiClient.get('/timetables/cc/schedule', { params });
  },

  /**
   * Initials lookup and mapping
   */
  getInitials(params) {
    return apiClient.get('/timetables/initials', { params });
  },

  upsertInitial(data) {
    return apiClient.post('/timetables/initials', data);
  },

  deleteInitial(id) {
    return apiClient.delete(`/timetables/initials/${id}`);
  },

  /**
   * Create timetable manually
   */
  createManual(data) {
    return apiClient.post('/timetables/manual', data);
  },

  /**
   * Slot management
   */
  addSlot(timetableId, data) {
    return apiClient.post(`/timetables/${timetableId}/slots`, data);
  },

  updateSlot(timetableId, slotId, data) {
    return apiClient.put(`/timetables/${timetableId}/slots/${slotId}`, data);
  },

  deleteSlot(timetableId, slotId) {
    return apiClient.delete(`/timetables/${timetableId}/slots/${slotId}`);
  },

  /**
   * Audit logs
   */
  getLogs(params) {
    return apiClient.get('/timetables/logs', { params });
  },
};

export default timetableApi;
