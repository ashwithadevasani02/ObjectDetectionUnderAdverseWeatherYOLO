const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const pythonService = require('../services/pythonService');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, JPEG, and PNG images are allowed.'), false);
  }
};
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB file size limit
  }
});
const uploadSingle = upload.single('image');
router.post('/predict', (req, res) => {
  uploadSingle(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an image file.' });
    }
    const filePath = req.file.path;
    try {
      if (!pythonService.isReady) {
        return res.status(503).json({
          error: 'YOLO model is still loading. Please wait a few seconds and try again.'
        });
      }
      const result = await pythonService.predict(filePath);
      res.json(result);
    } catch (err) {
      console.error('[Predict API Error]:', err);
      res.status(500).json({ error: err.message || 'YOLO Object detection inference failed.' });
    } finally {
      try {
        await fs.unlink(filePath);
        console.log(`[Cleanup] Successfully removed temp upload file: ${filePath}`);
      } catch (cleanupErr) {
        console.error(`[Cleanup Error] Failed to delete file ${filePath}:`, cleanupErr);
      }
    }
  });
});

module.exports = router;
