#!/usr/bin/env node

/**
 * Universal setup script for Auto-Jira-Agent.
 * Works seamlessly across Windows, macOS, and Linux.
 * Sets up Node dependencies, Python virtual environment, git repos, and environment files.
 */

import { execSync, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

console.log('\n========================================================');
console.log('   Auto Jira Agent - Cross-Platform System Setup');
console.log('========================================================\n');

// Helper to run shell command with live output
function runCmd(command, cwd = projectRoot) {
  console.log(`> [${path.basename(cwd)}] ${command}`);
  try {
    execSync(command, { cwd, stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`Error executing: ${command}`);
    return false;
  }
}

// 1. Check Python installation
function findSystemPython() {
  const candidates = isWindows ? ['python', 'py', 'python3'] : ['python3', 'python'];
  for (const cmd of candidates) {
    try {
      const res = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
      if (res.status === 0) {
        return cmd;
      }
    } catch (e) {}
  }
  return null;
}

const systemPython = findSystemPython();
if (!systemPython) {
  console.error('\n[ERROR] Python is not installed or not in PATH!');
  console.error('Please install Python 3.10+ from https://www.python.org/downloads/\n');
  process.exit(1);
}
console.log(`✓ Python detected: ${systemPython}`);

// 2. Install Root Dependencies
console.log('\n[1/6] Installing root npm dependencies...');
runCmd('npm install', projectRoot);

// 3. Install Server Dependencies
console.log('\n[2/6] Installing Express server dependencies...');
const serverDir = path.join(projectRoot, 'server');
runCmd('npm install', serverDir);

// 4. Install Client Dependencies
console.log('\n[3/6] Installing Vite React client dependencies...');
const clientDir = path.join(projectRoot, 'client');
runCmd('npm install', clientDir);

// 5. Setup Python Virtual Environment
console.log('\n[4/6] Setting up Python virtual environment for LangGraph Agent Backend...');
const agentDir = path.join(projectRoot, 'agent_backend');
const venvDir = path.join(agentDir, '.venv');
const venvPython = isWindows
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');
const venvPip = isWindows
  ? path.join(venvDir, 'Scripts', 'pip.exe')
  : path.join(venvDir, 'bin', 'pip');

if (!fs.existsSync(venvPython)) {
  console.log(`Creating virtual environment in agent_backend/.venv...`);
  runCmd(`${systemPython} -m venv .venv`, agentDir);
}

if (fs.existsSync(path.join(agentDir, 'requirements.txt'))) {
  console.log('Installing agent_backend requirements...');
  const pipCmd = fs.existsSync(venvPip) ? `"${venvPip}"` : `"${venvPython}" -m pip`;
  runCmd(`${pipCmd} install -r requirements.txt`, agentDir);
}
console.log('✓ Python virtual environment configured successfully.');

// 6. Ensure Environment (.env) Files Exist
console.log('\n[5/6] Ensuring environment configuration files exist...');
function copyEnvIfMissing(src, dest) {
  if (fs.existsSync(src) && !fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
    console.log(`✓ Created ${path.relative(projectRoot, dest)} from template.`);
  }
}

copyEnvIfMissing(path.join(projectRoot, '.env.example'), path.join(projectRoot, '.env'));
copyEnvIfMissing(path.join(serverDir, '.env.example'), path.join(serverDir, '.env'));
copyEnvIfMissing(path.join(agentDir, '.env.example'), path.join(agentDir, '.env'));

// 7. Verify Workspace Repository Git State
console.log('\n[6/6] Verifying workspace target repository (/workspace/fb_clone_repo)...');
const fbRepo = path.join(projectRoot, 'workspace', 'fb_clone_repo');
const fbGit = path.join(fbRepo, '.git');
if (fs.existsSync(fbRepo) && !fs.existsSync(fbGit)) {
  console.log('Initializing isolated git repository in workspace/fb_clone_repo...');
  try {
    execSync('git init -b main', { cwd: fbRepo, stdio: 'ignore' });
    execSync('git config user.name "Alex Morgan"', { cwd: fbRepo, stdio: 'ignore' });
    execSync('git config user.email "alex@autojira.io"', { cwd: fbRepo, stdio: 'ignore' });
    execSync('git add .', { cwd: fbRepo, stdio: 'ignore' });
    execSync('git commit -m "Initial skeleton for fb_clone_repo"', { cwd: fbRepo, stdio: 'ignore' });
    console.log('✓ Initialized git repository for fb_clone_repo.');
  } catch (e) {
    console.log('Notice: Workspace git initialization skipped or already present.');
  }
}

// 8. Port Conflict Check Helper
function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => {
      s.close();
      resolve(true);
    });
    s.listen(port);
  });
}

async function verifyAllPorts() {
  const PORTS = [
    { name: 'Vite React UI', port: 5173, url: 'http://localhost:5173' },
    { name: 'Express API Server', port: 4000, url: 'http://localhost:4000' },
    { name: 'Python Agent Backend', port: 8000, url: 'http://localhost:8000' },
    { name: 'Neo4j Bolt Database', port: 7687, url: 'bolt://localhost:7687' }
  ];

  console.log('\nChecking default component port assignments:');
  for (const item of PORTS) {
    const free = await checkPortAvailable(item.port);
    const statusStr = free ? 'AVAILABLE (Ready)' : 'PORT IN USE / ACTIVE';
    console.log(`  • Port ${item.port.toString().padEnd(5)} -> ${item.name.padEnd(25)} [${statusStr}]`);
  }
}

await verifyAllPorts();

console.log('\n========================================================');
console.log('   Setup Complete! System is ready to run.');
console.log('========================================================');
console.log('To start all services concurrently:');
console.log('  $ npm run dev');
console.log('Or use the one-click launcher:');
console.log(isWindows ? '  > start.bat  (or run.bat)' : '  $ ./start.sh');
console.log('\nComponent Architecture & Distinct Ports:');
console.log('  1. Frontend Client UI:      http://localhost:5173');
console.log('  2. Express Graph API:       http://localhost:4000');
console.log('  3. Python LangGraph Agent:  http://localhost:8000');
console.log('  4. Neo4j Graph DB:          bolt://localhost:7687');
console.log('========================================================\n');
