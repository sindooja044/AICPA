require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const { extractFieldsFromText } = require('./extractor');
const { decideRoute } = require('./routing');

const upload = multer({ dest: 'uploads/' });
const app = express();
app.use(express.json());

// Root
app.get('/', (req, res) => res.send('FNOL Agent running'));

/**
 * POST /api/extract
 * body: { "text": "<full FNOL text>" }
 */
app.post('/api/extract', async (req, res) => {
  try {
    console.log('REQ BODY:', req.body);
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const extracted = await extractFieldsFromText(text);

    const mandatory = [
      'policyNumber',
      'policyholderName',
      'incidentDate',
      'incidentTime',
      'incidentLocation',
      'description',
      'claimant',
      'claimType',
      'initialEstimate',
      'attachments'
    ];
    const missingFields = mandatory.filter(k => {
      const v = extracted[k];
      return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
    });

    const { recommendedRoute, reasoning } = decideRoute(extracted, missingFields);

    return res.json({
      extractedFields: extracted,
      missingFields,
      recommendedRoute,
      reasoning
    });
  } catch (err) {
    console.error('🔥 INTERNAL ERROR:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

/**
 * POST /process
 * form-data: file -> single PDF or TXT
 */
app.post('/process', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name: file)' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    let text = '';

    if (ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(req.file.path);
      const data = await pdfParse(dataBuffer);
      text = data.text || '';
    } else {
      text = fs.readFileSync(req.file.path, 'utf8');
    }

    // cleanup
    fs.unlinkSync(req.file.path);

    const extracted = await extractFieldsFromText(text);

    const mandatory = [
      'policyNumber',
      'policyholderName',
      'incidentDate',
      'incidentTime',
      'incidentLocation',
      'description',
      'claimant',
      'claimType',
      'initialEstimate',
      'attachments'
    ];
    const missingFields = mandatory.filter(k => {
      const v = extracted[k];
      return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
    });

    const { recommendedRoute, reasoning } = decideRoute(extracted, missingFields);

    const output = {
      extractedFields: extracted,
      missingFields,
      recommendedRoute,
      reasoning
    };

    return res.json(output);
  } catch (err) {
    console.error('🔥 PROCESS ERROR:', err);
    return res.status(500).json({ error: 'Internal error', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FNOL Agent listening on port ${PORT}`));
