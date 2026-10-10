import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../workspace');

export function ensureGitRepo(repoName = 'fb_clone_repo') {
  const repoPath = path.join(workspaceRoot, repoName);
  const gitDir = path.join(repoPath, '.git');
  if (fs.existsSync(repoPath) && !fs.existsSync(gitDir)) {
    const bundlePath = path.join(workspaceRoot, `${repoName}.bundle`);
    if (fs.existsSync(bundlePath)) {
      try {
        const tempPath = path.join(workspaceRoot, `temp_bundle_${Date.now()}`);
        execSync(`git clone "${bundlePath}" "${tempPath}"`, { stdio: 'ignore' });
        if (fs.existsSync(path.join(tempPath, '.git'))) {
          fs.renameSync(path.join(tempPath, '.git'), gitDir);
          fs.rmSync(tempPath, { recursive: true, force: true });
        }
      } catch (e) {}
    }
    if (!fs.existsSync(gitDir)) {
      try {
        execSync('git init && git add . && git commit -m "Initial skeleton for fb_clone_repo"', { cwd: repoPath, stdio: 'ignore' });
      } catch (e) {}
    }
  }
}

export function getWorkspaceRepos() {
  if (!fs.existsSync(workspaceRoot)) return [];
  const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });
  const repos = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      ensureGitRepo(entry.name);
      const repoPath = path.join(workspaceRoot, entry.name);
      const isGit = fs.existsSync(path.join(repoPath, '.git'));
      let branch = 'main';
      let commitCount = 0;
      if (isGit) {
        try {
          branch = execSync('git branch --show-current', { cwd: repoPath, encoding: 'utf8' }).trim() || 'master';
          const countStr = execSync('git rev-list --count HEAD', { cwd: repoPath, encoding: 'utf8' }).trim();
          commitCount = parseInt(countStr) || 0;
        } catch (e) {}
      }

      repos.push({
        name: entry.name,
        path: `/workspace/${entry.name}`,
        isGit,
        branch,
        commitCount
      });
    }
  }

  return repos;
}

export function getRepoCommits(repoName = 'fb_clone_repo') {
  ensureGitRepo(repoName);
  const repoPath = path.join(workspaceRoot, repoName);
  if (!fs.existsSync(repoPath) || !fs.existsSync(path.join(repoPath, '.git'))) {
    return [];
  }

  try {
    const raw = execSync('git log --pretty=format:"%H|%h|%s|%an|%ad|%P" --date=short -n 50', {
      cwd: repoPath,
      encoding: 'utf8'
    }).trim();

    if (!raw) return [];

    return raw.split('\n').filter(Boolean).map(line => {
      const [hash, shortHash, message, author, date, parentHash] = line.split('|');
      const issueMatch = message.match(/(FB-\d+|KAN-\d+)/i);
      return {
        hash,
        shortHash,
        message,
        author,
        date,
        parentHash: (parentHash || '').trim().split(' ')[0] || null,
        linkedIssueKey: issueMatch ? issueMatch[1].toUpperCase() : null
      };
    });
  } catch (err) {
    console.error('Error fetching commits:', err);
    return [];
  }
}

export function getRepoFiles(repoName = 'fb_clone_repo') {
  const repoPath = path.join(workspaceRoot, repoName);
  if (!fs.existsSync(repoPath)) return [];

  const results = [];
  function scan(dir, prefix = '') {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name === '.git' || item.name === 'node_modules') continue;
      const relPath = prefix ? `${prefix}/${item.name}` : item.name;
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        scan(fullPath, relPath);
      } else {
        const stat = fs.statSync(fullPath);
        results.push({
          name: item.name,
          path: relPath,
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
          extension: path.extname(item.name).replace('.', '')
        });
      }
    }
  }

  scan(repoPath);
  return results;
}

export function getFileContent(repoName = 'fb_clone_repo', filePath, ref = null) {
  const repoPath = path.join(workspaceRoot, repoName);
  if (ref) {
    try {
      return execSync(`git show ${ref}:${filePath}`, { cwd: repoPath, encoding: 'utf8' });
    } catch (e) {
      // Fallback to disk if ref fails
    }
  }

  const fullPath = path.join(repoPath, filePath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, 'utf8');
  }
  return '';
}

export function getRepoDiff(repoName = 'fb_clone_repo', baseRef = null, targetRef = null, targetFile = null) {
  ensureGitRepo(repoName);
  const repoPath = path.join(workspaceRoot, repoName);
  if (!fs.existsSync(repoPath) || !fs.existsSync(path.join(repoPath, '.git'))) {
    return { files: [], summary: { additions: 0, deletions: 0, changedFiles: 0 } };
  }

  let rawDiff = '';
  let rawNumstat = '';

  try {
    const fileFilter = targetFile ? `-- "${targetFile}"` : '';

    if (baseRef && targetRef) {
      rawDiff = execSync(`git diff -U3 ${baseRef} ${targetRef} ${fileFilter}`, {
        cwd: repoPath,
        encoding: 'utf8'
      });
      rawNumstat = execSync(`git diff --numstat ${baseRef} ${targetRef} ${fileFilter}`, {
        cwd: repoPath,
        encoding: 'utf8'
      });
    } else if (targetRef) {
      // Single commit comparison against its parent
      rawDiff = execSync(`git show -U3 --format="" ${targetRef} ${fileFilter}`, {
        cwd: repoPath,
        encoding: 'utf8'
      });
      rawNumstat = execSync(`git show --numstat --format="" ${targetRef} ${fileFilter}`, {
        cwd: repoPath,
        encoding: 'utf8'
      });
    } else {
      // Compare working tree against HEAD
      rawDiff = execSync(`git diff -U3 HEAD ${fileFilter}`, {
        cwd: repoPath,
        encoding: 'utf8'
      });
      rawNumstat = execSync(`git diff --numstat HEAD ${fileFilter}`, {
        cwd: repoPath,
        encoding: 'utf8'
      });
    }
  } catch (err) {
    console.error('git diff error:', err.message);
    return { files: [], rawDiff: '', summary: { additions: 0, deletions: 0, changedFiles: 0 } };
  }

  // Parse numstat for fast totals per file
  const numstatMap = {};
  rawNumstat.split('\n').filter(Boolean).forEach(line => {
    const parts = line.split('\t');
    if (parts.length >= 3) {
      const adds = parseInt(parts[0]) || 0;
      const dels = parseInt(parts[1]) || 0;
      const fPath = parts[2].trim();
      numstatMap[fPath] = { additions: adds, deletions: dels };
    }
  });

  const parsedFiles = parseUnifiedDiff(rawDiff, numstatMap);
  const totalAdditions = parsedFiles.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = parsedFiles.reduce((sum, f) => sum + f.deletions, 0);

  return {
    files: parsedFiles,
    summary: {
      additions: totalAdditions,
      deletions: totalDeletions,
      changedFiles: parsedFiles.length
    },
    rawDiff
  };
}

function parseUnifiedDiff(diffText, numstatMap = {}) {
  if (!diffText) return [];
  const lines = diffText.split('\n');
  const files = [];

  let currentFile = null;
  let currentChunk = null;
  let oldLineNo = 0;
  let newLineNo = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('diff --git ')) {
      // Save previous file if exists
      if (currentFile) {
        if (currentChunk) currentFile.chunks.push(currentChunk);
        files.push(currentFile);
      }

      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      const filePath = match ? match[2] : 'unknown';
      const stats = numstatMap[filePath] || { additions: 0, deletions: 0 };

      currentFile = {
        path: filePath,
        oldPath: match ? match[1] : filePath,
        newPath: filePath,
        additions: stats.additions,
        deletions: stats.deletions,
        status: 'modified',
        chunks: []
      };
      currentChunk = null;
      continue;
    }

    if (!currentFile) continue;

    if (line.startsWith('new file mode')) {
      currentFile.status = 'added';
      continue;
    }
    if (line.startsWith('deleted file mode')) {
      currentFile.status = 'deleted';
      continue;
    }

    // Chunk header @@ -1,7 +1,7 @@
    if (line.startsWith('@@ ')) {
      if (currentChunk) {
        currentFile.chunks.push(currentChunk);
      }

      const chunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/);
      if (chunkMatch) {
        oldLineNo = parseInt(chunkMatch[1]);
        newLineNo = parseInt(chunkMatch[3]);
        currentChunk = {
          header: line,
          extra: chunkMatch[5] || '',
          lines: []
        };
      }
      continue;
    }

    if (currentChunk) {
      if (line.startsWith('+')) {
        currentChunk.lines.push({
          type: 'add',
          oldLine: null,
          newLine: newLineNo++,
          text: line.substring(1)
        });
        if (!numstatMap[currentFile.path]) currentFile.additions++;
      } else if (line.startsWith('-')) {
        currentChunk.lines.push({
          type: 'del',
          oldLine: oldLineNo++,
          newLine: null,
          text: line.substring(1)
        });
        if (!numstatMap[currentFile.path]) currentFile.deletions++;
      } else if (line.startsWith(' ')) {
        currentChunk.lines.push({
          type: 'context',
          oldLine: oldLineNo++,
          newLine: newLineNo++,
          text: line.substring(1)
        });
      } else if (line === '') {
        currentChunk.lines.push({
          type: 'context',
          oldLine: oldLineNo++,
          newLine: newLineNo++,
          text: ''
        });
      }
    }
  }

  if (currentFile) {
    if (currentChunk) currentFile.chunks.push(currentChunk);
    files.push(currentFile);
  }

  return files;
}
