require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pythonService = require('./services/pythonService');
const app = express();
const PORT = process.env.PORT || 4000;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const predictRouter = require('./routes/predict');
app.use('/api', predictRouter);
const healthHandler = (req, res) => {
  res.json({
    status: 'healthy',
    pythonServiceReady: pythonService.isReady,
    pythonLogs: pythonService.getStartupLogs()
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

app.use((err, req, res, next) => {
  console.error('[Server Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});
const server = app.listen(PORT, () => {
  console.log(`[Express Backend] Server listening on http://localhost:${PORT}`);
});

const handleShutdown = () => {
  console.log('\n[Express Backend] Shutting down...');
  if (pythonService.pyProcess) {
    try {
      console.log('[Express Backend] Sending EXIT command to Python process...');
      pythonService.pyProcess.stdin.write('EXIT\n');
      pythonService.pyProcess.stdin.end();
      pythonService.pyProcess.kill();
    } catch (err) {
      console.error('[Express Backend] Error terminating Python process:', err);
    }
  }
  server.close(() => {
    console.log('[Express Backend] Server stopped.');
    process.exit(0);
  });
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
