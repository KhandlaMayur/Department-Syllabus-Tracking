const logger = require('../../utils/logger');

/**
 * PdfParser
 * Parses PDF timetable files into text lines and raw tabular data.
 * Supports both traditional function export and class-based export (pdf-parse v2+).
 */
class PdfParser {
  static async parse(buffer) {
    let parserInstance = null;
    try {
      const pdfLib = require('pdf-parse');

      let fullText = '';
      let numPages = 1;

      if (typeof pdfLib === 'function') {
        // v1.x legacy function API
        const data = await pdfLib(buffer);
        fullText = data.text || '';
        numPages = data.numpages || 1;
      } else if (pdfLib && pdfLib.PDFParse) {
        // v2.x class API
        parserInstance = new pdfLib.PDFParse({ data: buffer });
        const result = await parserInstance.getText();
        fullText = result.text || '';
        numPages = result.total || (result.pages ? result.pages.length : 1);
      } else if (pdfLib && typeof pdfLib.default === 'function') {
        const data = await pdfLib.default(buffer);
        fullText = data.text || '';
        numPages = data.numpages || 1;
      } else {
        throw new Error('Unsupported pdf-parse library export format.');
      }

      const lines = fullText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

      return {
        rawText: fullText,
        lines,
        pages: numPages,
      };
    } catch (err) {
      logger.error(`PdfParser error: ${err.message}`);
      throw new Error(`Failed to parse PDF timetable: ${err.message}`);
    } finally {
      if (parserInstance && typeof parserInstance.destroy === 'function') {
        try {
          await parserInstance.destroy();
        } catch (destroyErr) {
          logger.warn(`PDF parser cleanup error: ${destroyErr.message}`);
        }
      }
    }
  }
}

module.exports = PdfParser;
