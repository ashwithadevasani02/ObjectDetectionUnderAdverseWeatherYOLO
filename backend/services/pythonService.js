const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class PythonInferenceService {
  constructor() {
    this.pyProcess = null;
    this.isReady = false;
    this.queue = [];
    this.isProcessing = false;
    this.currentResolver = null;
    this.startupLogs = [];
    this.initProcess();
  }
  buildChildEnv() {
    // Persist matplotlib's font cache so it is built only once and survives
    // child restarts (ultralytics imports matplotlib on startup).
    const mplConfigDir = path.join(__dirname, '../.cache/matplotlib');
    try {
      fs.mkdirSync(mplConfigDir, { recursive: true });
    } catch (err) {
      console.warn(`[Python Service] Could not create MPLCONFIGDIR: ${err.message}`);
    }

    // Memory tuning for constrained instances (e.g. Render free tier, 512MB).
    // MALLOC_ARENA_MAX must be set before the child starts so glibc honors it;
    // it is the single biggest lever for reducing PyTorch/NumPy RSS. The thread
    // limits avoid spawning per-core worker pools that inflate memory.
    return {
      ...process.env,
      MALLOC_ARENA_MAX: process.env.MALLOC_ARENA_MAX || '2',
      OMP_NUM_THREADS: process.env.OMP_NUM_THREADS || '1',
      OPENBLAS_NUM_THREADS: process.env.OPENBLAS_NUM_THREADS || '1',
      MKL_NUM_THREADS: process.env.MKL_NUM_THREADS || '1',
      NUMEXPR_NUM_THREADS: process.env.NUMEXPR_NUM_THREADS || '1',
      VECLIB_MAXIMUM_THREADS: process.env.VECLIB_MAXIMUM_THREADS || '1',
      MPLBACKEND: process.env.MPLBACKEND || 'Agg',
      MPLCONFIGDIR: process.env.MPLCONFIGDIR || mplConfigDir,
      YOLO_VERBOSE: process.env.YOLO_VERBOSE || 'False'
    };
  }
  initProcess() {
    const pythonScript = path.join(__dirname, '../python/inference.py');
    let pythonPath = process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3');
    if (process.env.RENDER && pythonPath === 'python') {
      pythonPath = 'python3';
    }
    console.log(`[Python Service] Launching Python process: "${pythonPath}" "${pythonScript}"`);
    this.startupLogs.push(`[System] Launching Python process: "${pythonPath}" "${pythonScript}"`);
    
    this.pyProcess = spawn(pythonPath, [pythonScript], { env: this.buildChildEnv() })
    let stdoutBuffer = '';
    let stderrBuffer = '';
    this.pyProcess.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      let lineIndex;
      while ((lineIndex = stdoutBuffer.indexOf('\n')) !== -1) {
        const line = stdoutBuffer.substring(0, lineIndex).trim();
        stdoutBuffer = stdoutBuffer.substring(lineIndex + 1);
        if (line === 'READY') {
          console.log('[Python Service] Persistent process is READY and model is loaded.');
          this.startupLogs.push('[System] Persistent process is READY and model is loaded.');
          this.isReady = true;
          this.processQueue();
        } else if (line) {
          // If we are currently waiting for a response to an active request
          if (this.currentResolver) {
            try {
              const result = JSON.parse(line);
              if (result.error) {
                this.currentResolver.reject(new Error(result.error));
              } else {
                this.currentResolver.resolve(result);
              }
            } catch (err) {
              this.currentResolver.reject(
                new Error(`Failed to parse Python response. Error: ${err.message}. Raw output: ${line}`)
              );
            }
            this.currentResolver = null;
            this.isProcessing = false;
            this.processQueue();
          } else {
            console.log(`[Python Stdout]: ${line}`);
            this.startupLogs.push(`[Stdout] ${line}`);
            if (this.startupLogs.length > 50) this.startupLogs.shift();
          }
        }
      }
    });

    this.pyProcess.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
      let lineIndex;
      while ((lineIndex = stderrBuffer.indexOf('\n')) !== -1) {
        const line = stderrBuffer.substring(0, lineIndex).trim();
        stderrBuffer = stderrBuffer.substring(lineIndex + 1);
        console.error(`[Python Stderr]: ${line}`);
        this.startupLogs.push(`[Stderr] ${line}`);
        if (this.startupLogs.length > 50) this.startupLogs.shift();
      }
    });

    this.pyProcess.on('error', (err) => {
      console.error('[Python Service] Failed to start Python process:', err);
      this.startupLogs.push(`[Error] Failed to start Python process: ${err.message}`);
      this.handleProcessCrash(err);
    });

    this.pyProcess.on('close', (code, signal) => {
      if (code !== 0) {
        const errorMsg = `Python process exited with code ${code}` + (signal ? ` (signal: ${signal})` : '');
        console.warn(`[Python Service] ${errorMsg}`);
        this.startupLogs.push(`[Close] ${errorMsg}`);
        this.handleProcessCrash(new Error(errorMsg));
      }
    });
  }

  handleProcessCrash(error) {
    this.isReady = false;
    this.pyProcess = null;

    if (this.currentResolver) {
      this.currentResolver.reject(error || new Error('Python process crashed during inference.'));
      this.currentResolver = null;
      this.isProcessing = false;
    }
    const activeQueue = this.queue;
    this.queue = [];
    activeQueue.forEach(({ reject }) => reject(new Error('Inference server was restarted. Please try again.')));
    setTimeout(() => {
      if (!this.pyProcess) {
        console.log('[Python Service] Attempting to restart process...');
        this.startupLogs.push('[System] Attempting to restart process...');
        this.initProcess();
      }
    }, 5000);
  }
  predict(imagePath) {
    return new Promise((resolve, reject) => {
      this.queue.push({ imagePath, resolve, reject });
      this.processQueue();
    });
  }
  processQueue() {
    if (this.isProcessing || !this.isReady || this.queue.length === 0) {
      return;
    }

    const { imagePath, resolve, reject } = this.queue.shift();
    this.isProcessing = true;
    this.currentResolver = { resolve, reject };

    try {
      this.pyProcess.stdin.write(`${imagePath}\n`);
    } catch (err) {
      this.isProcessing = false;
      this.currentResolver = null;
      reject(new Error(`Failed to write to Python process stdin: ${err.message}`));
      this.handleProcessCrash(err);
    }
  }
  getStartupLogs() {
    return this.startupLogs || [];
  }
}

module.exports = new PythonInferenceService();
