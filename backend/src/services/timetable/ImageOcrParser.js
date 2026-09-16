const { createWorker } = require('tesseract.js');
const logger = require('../../utils/logger');

/**
 * ImageOcrParser
 * Extracts text and line items from PNG / JPG / JPEG timetable images.
 */
class ImageOcrParser {
  static async parse(buffer) {
    let worker = null;
    try {
      worker = await createWorker('eng');
      const ret = await worker.recognize(buffer);
      const fullText = ret.data?.text || '';
      const lines = fullText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

      return {
        rawText: fullText,
        lines,
        confidence: ret.data?.confidence || 0,
        words: ret.data?.words || [],
      };
    } catch (err) {
      logger.error(`ImageOcrParser error: ${err.message}`);
      throw new Error(`Failed to extract text from timetable image: ${err.message}`);
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch (termErr) {
          logger.warn(`Worker termination error: ${termErr.message}`);
        }
      }
    }
  }
}

module.exports = ImageOcrParser;
