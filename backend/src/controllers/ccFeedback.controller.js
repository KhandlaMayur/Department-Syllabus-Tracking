const CCFeedbackModel      = require('../models/ccFeedback.model');
const StudentFeedbackModel = require('../models/studentFeedback.model');
const TopicCompletionModel = require('../models/topicCompletion.model');
const catchAsync           = require('../utils/catchAsync');
const ApiError             = require('../utils/ApiError');

/**
 * POST /cc-feedback — CC submits feedback for a covered topic.
 * STRICT RULE: CC can only give feedback AFTER at least one student has submitted feedback for that topic.
 */
const submit = catchAsync(async (req, res) => {
  const { subtopicId, subjectId, batchId: rawBatchId, divisionId: rawDivId, semesterNumber, rating, comment } = req.body;

  if (!subtopicId || !subjectId || !rawBatchId || !semesterNumber || !rating) {
    throw ApiError.badRequest('subtopicId, subjectId, batchId, semesterNumber, and rating are required');
  }

  if (rating < 1 || rating > 5) {
    throw ApiError.badRequest('Rating must be between 1 and 5');
  }

  // Resolve batch and division IDs cleanly
  const { batchId, divisionId } = await TopicCompletionModel.resolveBatchAndDivision(rawBatchId, rawDivId);

  // 1. Verify the topic is covered by the faculty
  const result = await TopicCompletionModel.findBySubjectAndBatch(subjectId, rawBatchId);
  const completions = result?.completions || [];
  const isCovered = completions.some(c => c.subtopic_id === Number(subtopicId));
  if (!isCovered) {
    throw ApiError.badRequest('Topic has not been marked as covered by the subject teacher yet.');
  }

  // 2. STRICT REQUIREMENT: Verify at least one student has submitted feedback for this topic
  const studentFeedbackList = await StudentFeedbackModel.findBySubtopic(subtopicId, batchId, divisionId);
  if (!studentFeedbackList || studentFeedbackList.length === 0) {
    throw ApiError.badRequest('CC feedback can only be submitted after students have submitted feedback for this topic.');
  }

  // 3. Save feedback for CC
  const item = await CCFeedbackModel.create({
    subtopicId: Number(subtopicId),
    subjectId: Number(subjectId),
    batchId: Number(batchId),
    divisionId: divisionId ? Number(divisionId) : null,
    semesterNumber: Number(semesterNumber),
    facultyId: req.user.sub,
    rating: Number(rating),
    comment: comment || null,
  });

  res.status(201).json({ success: true, data: item });
});

/** GET /cc-feedback/topic/:subtopicId/batch/:batchId — view CC feedback for a topic (includes previous CC) */
const getByTopic = catchAsync(async (req, res) => {
  const { subtopicId, batchId } = req.params;
  const feedbacks = await CCFeedbackModel.findBySubtopic(subtopicId, batchId);
  res.json({ success: true, data: feedbacks });
});

/** GET /cc-feedback/subject/:subjectId/batch/:batchId — all CC feedback for a subject in a batch */
const getBySubject = catchAsync(async (req, res) => {
  const { subjectId, batchId } = req.params;
  const rows = await CCFeedbackModel.findBySubjectAndBatch(subjectId, batchId);
  res.json({ success: true, data: rows });
});

module.exports = { submit, getByTopic, getBySubject };
