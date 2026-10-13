#!/usr/bin/env node

/**
 * Cross-platform launcher for the Python Agent Backend (FastAPI / Uvicorn).
 * Supports Windows, macOS, and Linux without hardcoded paths.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const agentBackendDir = path.join(projectRoot, 'agent_backend');

// Load environment variables for AGENT_PORT
function getAgentPort() {
  const envFiles = [
    path.join(projectRoot, '.env'),
    path.join(agentBackendDir, '.env')
  ];

  for (const envPath of envFiles) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/^AGENT_PORT\s*=\s*(\d+)/m);
      if (match && match[1]) {
        return match[1];
      }
    }
  }
  return process.env.AGENT_PORT || '8000';
}

// Find Python executable in local venv or system PATH
function findPythonExecutable() {
  const isWindows = process.platform === 'win32';
  const venvDir = path.join(agentBackendDir, '.venv');
  const altVenvDir = path.join(agentBackendDir, 'venv');

  const candidates = [
    // Primary local .venv
    isWindows ? path.join(venvDir, 'Scripts', 'python.exe') : path.join(venvDir, 'bin', 'python'),
    // Alternate venv
    isWindows ? path.join(altVenvDir, 'Scripts', 'python.exe') : path.join(altVenvDir, 'bin', 'python'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback to system python
  return isWindows ? 'python' : 'python3';
}

const pythonBin = findPythonExecutable();
const agentPort = getAgentPort();

console.log(`[Agent Runner] Detected Python: ${pythonBin}`);
console.log(`[Agent Runner] Starting FastAPI Agent Backend on port ${agentPort}...`);

const args = [
  '-m',
  'uvicorn',
  'agent_backend.main:app',
  '--host',
  '0.0.0.0',
  '--port',
  agentPort,
  '--reload'
];

const child = spawn(pythonBin, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    AGENT_PORT: agentPort,
    PYTHONUNBUFFERED: '1'
  }
});

child.on('error', (err) => {
  console.error(`\n[Agent Runner ERROR] Failed to start Python agent: ${err.message}`);
  console.error(`Please run 'npm run setup' to install python dependencies and virtual environment.\n`);
  process.exit(1);
});

child.on('close', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[Agent Runner] Agent process exited with code ${code}`);
  }
  process.exit(code || 0);
});
