import apiClient from './client';

/**
 * Master data API module — all Phase 3+ CRUD endpoints.
 * Every function returns an Axios promise.
 */
const masterApi = {
  // ── Departments ──────────────────────────────────────────
  departments: {
    list:     (params) => apiClient.get('/departments', { params }),
    get:      (id)     => apiClient.get(`/departments/${id}`),
    create:   (data)   => apiClient.post('/departments', data),
    update:   (id, d)  => apiClient.put(`/departments/${id}`, d),
    remove:   (id)     => apiClient.delete(`/departments/${id}`),
  },

  // ── Academic Years ────────────────────────────────────────
  academicYears: {
    list:   (params) => apiClient.get('/academic-years', { params }),
    get:    (id)     => apiClient.get(`/academic-years/${id}`),
    create: (data)   => apiClient.post('/academic-years', data),
    update: (id, d)  => apiClient.put(`/academic-years/${id}`, d),
    remove: (id)     => apiClient.delete(`/academic-years/${id}`),
  },

  // ── Semesters ────────────────────────────────────────────
  semesters: {
    list:   (params) => apiClient.get('/semesters', { params }),
    get:    (id)     => apiClient.get(`/semesters/${id}`),
    create: (data)   => apiClient.post('/semesters', data),
    update: (id, d)  => apiClient.put(`/semesters/${id}`, d),
    remove: (id)     => apiClient.delete(`/semesters/${id}`),
  },

  // ── Batches ──────────────────────────────────────────────
  batches: {
    list:   (params) => apiClient.get('/batches', { params }),
    get:    (id)     => apiClient.get(`/batches/${id}`),
    create: (data)   => apiClient.post('/batches', data),
    update: (id, d)  => apiClient.put(`/batches/${id}`, d),
    remove: (id)     => apiClient.delete(`/batches/${id}`),
  },

  // ── Divisions ────────────────────────────────────────────
  divisions: {
    list:        (params) => apiClient.get('/divisions', { params }),
    get:         (id)     => apiClient.get(`/divisions/${id}`),
    getStudents: (id)     => apiClient.get(`/divisions/${id}/students`),
    create:      (data)   => apiClient.post('/divisions', data),
    update:      (id, d)  => apiClient.put(`/divisions/${id}`, d),
    remove:      (id)     => apiClient.delete(`/divisions/${id}`),
  },

  // ── Students ─────────────────────────────────────────────
  students: {
    list:   (params) => apiClient.get('/students', { params }),
    get:    (id)     => apiClient.get(`/students/${id}`),
    me:     ()       => apiClient.get('/students/me'),
    create: (data)   => apiClient.post('/students', data),
    update: (id, d)  => apiClient.put(`/students/${id}`, d),
    remove: (id)     => apiClient.delete(`/students/${id}`),
  },

  // ── Faculty Members ──────────────────────────────────────
  faculty: {
    list:      (params) => apiClient.get('/faculty-members', { params }),
    get:       (id)     => apiClient.get(`/faculty-members/${id}`),
    me:        ()       => apiClient.get('/faculty-members/me'),
    allActive: ()       => apiClient.get('/faculty-members/all-active'),
    update:    (id, d)  => apiClient.put(`/faculty-members/${id}`, d),
    remove:    (id)     => apiClient.delete(`/faculty-members/${id}`),
  },

  // ── Subjects & Syllabus ───────────────────────────────────
  subjects: {
    list:               (params) => apiClient.get('/subjects', { params }),
    get:                (id)     => apiClient.get(`/subjects/${id}`),
    create:             (data)   => apiClient.post('/subjects', data),
    update:             (id, d)  => apiClient.put(`/subjects/${id}`, d),
    remove:             (id)     => apiClient.delete(`/subjects/${id}`),
    getSyllabus:        (id)     => apiClient.get(`/subjects/${id}/syllabus`),
    createSyllabusUnit: (id, d)  => apiClient.post(`/subjects/${id}/syllabus`, d),
    updateSyllabusUnit: (id, uid, d) => apiClient.put(`/subjects/${id}/syllabus/${uid}`, d),
    deleteSyllabusUnit: (id, uid)    => apiClient.delete(`/subjects/${id}/syllabus/${uid}`),
    createSubtopic:     (subjectId, unitId, d) => apiClient.post(`/subjects/${subjectId}/syllabus/${unitId}/subtopics`, d),
    updateSubtopic:     (subjectId, unitId, subtopicId, d) => apiClient.put(`/subjects/${subjectId}/syllabus/${unitId}/subtopics/${subtopicId}`, d),
    deleteSubtopic:     (subjectId, unitId, subtopicId) => apiClient.delete(`/subjects/${subjectId}/syllabus/${unitId}/subtopics/${subtopicId}`),
  },

  // ── Subject Assignments ───────────────────────────────────
  assignments: {
    list:   (params) => apiClient.get('/subject-assignments', { params }),
    get:    (id)     => apiClient.get(`/subject-assignments/${id}`),
    my:     ()       => apiClient.get('/subject-assignments/my'),
    create: (data)   => apiClient.post('/subject-assignments', data),
    update: (id, d)  => apiClient.put(`/subject-assignments/${id}`, d),
    remove: (id)     => apiClient.delete(`/subject-assignments/${id}`),
  },

  // ── CC Assignments ────────────────────────────────────────
  ccAssignments: {
    list:     (params) => apiClient.get('/cc-assignments', { params }),
    my:       ()       => apiClient.get('/cc-assignments/my'),
    assign:   (data)   => apiClient.post('/cc-assignments', data),
    reassign: (id, d)  => apiClient.put(`/cc-assignments/${id}`, d),
    remove:   (id)     => apiClient.delete(`/cc-assignments/${id}`),
  },

  // ── Topic Completions ─────────────────────────────────────
  topicCompletions: {
    mark:              (data)   => apiClient.post('/topic-completions', data),
    unmark:            (subtopicId, batchId) => apiClient.delete(`/topic-completions/${subtopicId}/batch/${batchId}`),
    activateUnit:      (data)   => apiClient.post('/topic-completions/unit/activate', data),
    deactivateUnit:    (unitId, batchId)     => apiClient.delete(`/topic-completions/unit/${unitId}/batch/${batchId}/activate`),
    markUnit:          (data)   => apiClient.post('/topic-completions/unit', data),
    unmarkUnit:        (unitId, batchId)     => apiClient.delete(`/topic-completions/unit/${unitId}/batch/${batchId}`),
    getBySubjectBatch: (subjectId, batchId, params)  => apiClient.get(`/topic-completions/subject/${subjectId}/batch/${batchId}`, { params }),
    getProgressBulk:   (params) => apiClient.get('/topic-completions/progress', { params }),
  },

  // ── Student Feedback ──────────────────────────────────────
  studentFeedback: {
    list:         (params) => apiClient.get('/student-feedback', { params }),
    submit:       (data)   => apiClient.post('/student-feedback', data),
    getByTopic:   (subtopicId, batchId) => apiClient.get(`/student-feedback/topic/${subtopicId}/batch/${batchId}`),
    getMy:        (subjectId, batchId)  => apiClient.get(`/student-feedback/my/${subjectId}/${batchId}`),
    getBySubject: (subjectId, batchId)  => apiClient.get(`/student-feedback/subject/${subjectId}/${batchId}`),
  },

  // ── CC Feedback ───────────────────────────────────────────
  ccFeedback: {
    submit:       (data)   => apiClient.post('/cc-feedback', data),
    getByTopic:   (subtopicId, batchId) => apiClient.get(`/cc-feedback/topic/${subtopicId}/batch/${batchId}`),
    getBySubject: (subjectId, batchId)  => apiClient.get(`/cc-feedback/subject/${subjectId}/${batchId}`),
  },
};

export default masterApi;

