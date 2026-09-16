const StudentFeedbackModel  = require('../models/studentFeedback.model');
const TopicCompletionModel  = require('../models/topicCompletion.model');
const StudentModel          = require('../models/student.model');
const catchAsync            = require('../utils/catchAsync');
const ApiError              = require('../utils/ApiError');

/** POST /student-feedback — student submits feedback for a covered topic */
const submit = catchAsync(async (req, res) => {
  const { subtopicId, subjectId, batchId, divisionId, semesterNumber, rating, comment, isCompleted } = req.body;

  if (!subtopicId || !subjectId || !rating) {
    throw ApiError.badRequest('subtopicId, subjectId, and rating are required');
  }

  if (rating < 1 || rating > 5) {
    throw ApiError.badRequest('Rating must be between 1 and 5');
  }

  // Lookup student details if needed for batch/division/semester
  let finalBatchId    = batchId;
  let finalDivisionId = divisionId;
  let finalSemNum     = semesterNumber;

  const student = await StudentModel.findByUserId(req.user.sub);
  if (student) {
    finalBatchId    = finalBatchId || student.batch_id;
    finalDivisionId = finalDivisionId || student.division_id;
    finalSemNum     = finalSemNum || student.semester || student.semester_number;
  }

  if (!finalBatchId) {
    throw ApiError.badRequest('Batch information is required');
  }

  // Verify the topic is actually covered
  const result = await TopicCompletionModel.findBySubjectAndBatch(subjectId, finalBatchId);
  const completions = result?.completions || [];
  const isCovered = completions.some(c => c.subtopic_id === Number(subtopicId));
  if (!isCovered) {
    throw ApiError.badRequest('You can only provide feedback for topics that have been covered');
  }

  // Get the faculty who covered it
  const completion = completions.find(c => c.subtopic_id === Number(subtopicId));

  const item = await StudentFeedbackModel.create({
    subtopicId,
    subjectId,
    studentId: req.user.sub,
    batchId: finalBatchId,
    divisionId: finalDivisionId || null,
    semesterNumber: Number(finalSemNum || 1),
    facultyId: completion ? completion.completed_by : null,
    rating: Number(rating),
    comment: comment || null,
    isCompleted: isCompleted !== undefined ? (isCompleted ? 1 : 0) : 1,
  });

  res.status(201).json({ success: true, data: item });
});

/** GET /student-feedback — list feedback with filters & role scoping (Faculty/CC/HOD) */
const listFeedbacks = catchAsync(async (req, res) => {
  const result = await StudentFeedbackModel.list(req.query, {
    id: req.user.sub,
    role: req.user.role,
  });
  res.json({ success: true, data: result });
});

/** GET /student-feedback/topic/:subtopicId/batch/:batchId — view feedback (faculty/CC/HOD) */
const getByTopic = catchAsync(async (req, res) => {
  const { subtopicId, batchId } = req.params;
  const feedback = await StudentFeedbackModel.findBySubtopic(subtopicId, batchId);
  const stats = await StudentFeedbackModel.getAverageRating(subtopicId, batchId);
  res.json({ success: true, data: { feedback, stats } });
});

/** GET /student-feedback/my/:subjectId/:batchId — student's own feedback for a subject */
const getMyFeedback = catchAsync(async (req, res) => {
  const { subjectId, batchId } = req.params;
  const rows = await StudentFeedbackModel.findByStudentAndSubject(req.user.sub, subjectId, batchId);
  res.json({ success: true, data: rows });
});

/** GET /student-feedback/subject/:subjectId/batch/:batchId — all feedback for a subject (CC/HOD) */
const getBySubject = catchAsync(async (req, res) => {
  const { subjectId, batchId } = req.params;
  const rows = await StudentFeedbackModel.findBySubjectAndBatch(subjectId, batchId);
  res.json({ success: true, data: rows });
});

module.exports = { submit, listFeedbacks, getByTopic, getMyFeedback, getBySubject };
