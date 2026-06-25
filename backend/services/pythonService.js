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
    this.initProcess();
  }

  initProcess() {
    const pythonScript = path.join(__dirname, '../python/inference.py');
    // Allow custom python command via environment variable
    const pythonPath = process.env.PYTHON_PATH || 'python';

    console.log(`[Python Service] Launching Python process: "${pythonPath}" "${pythonScript}"`);
    
    // Spawn the python process
    this.pyProcess = spawn(pythonPath, [pythonScript]);

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
      }
    });

    this.pyProcess.on('error', (err) => {
      console.error('[Python Service] Failed to start Python process:', err);
      this.handleProcessCrash(err);
    });

    this.pyProcess.on('close', (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`[Python Service] Process exited with code ${code}`);
        this.handleProcessCrash(new Error(`Python process exited with code ${code}`));
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

    // Reject all queued requests to prevent infinite waiting
    const activeQueue = this.queue;
    this.queue = [];
    activeQueue.forEach(({ reject }) => reject(new Error('Inference server was restarted. Please try again.')));

    // Attempt to restart python process after a brief delay
    setTimeout(() => {
      if (!this.pyProcess) {
        console.log('[Python Service] Attempting to restart process...');
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
      this.processQueue();
    }
  }
}

module.exports = new PythonInferenceService();
