import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  getStatus,
  initDriver,
  testConnection,
  getConnectionConfig,
  getGraphData,
  createIssue,
  updateIssue,
  deleteIssue,
  createConnection,
  deleteConnection,
  getKnowledgeDocs,
  createKnowledgeDoc,
  createCommitNode,
  createPullRequestNode,
  seedFbCloneProject,
  populateSampleData
} from './neo4j.js';
import {
  getWorkspaceRepos,
  getRepoCommits,
  getRepoFiles,
  getFileContent,
  getRepoDiff
} from './gitService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRepoPath = path.resolve(__dirname, '../workspace/fb_clone_repo');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Serve Facebook clone repo static preview
if (fs.existsSync(workspaceRepoPath)) {
  app.use('/workspace/preview', express.static(workspaceRepoPath));
}

// Status & connection health
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    ...getStatus(),
    config: getConnectionConfig()
  });
});

// Configure and reconnect Neo4j
app.post('/api/config', async (req, res) => {
  const { uri, user, password, database } = req.body;
  const result = await initDriver({ uri, user, password, database });
  res.json({
    ...result,
    currentStatus: getStatus()
  });
});

// Test connection without saving
app.post('/api/config/test', async (req, res) => {
  const { uri, user, password } = req.body;
  const testRes = await testConnection({ uri, user, password });
  res.json(testRes);
});

// Get all graph issues & connections
app.get('/api/graph', async (req, res) => {
  try {
    const data = await getGraphData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create an issue (node)
app.post('/api/issues', async (req, res) => {
  try {
    const result = await createIssue(req.body);
    res.status(201).json(result);

    // Notify Python Autonomous Agent Webhook asynchronously
    if (result && result.issue) {
      fetch('http://localhost:8000/api/webhook/jira-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.issue)
      }).catch(err => {
        // Agent backend may be starting or offline
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an issue (node)
app.put('/api/issues/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await updateIssue(id, req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an issue (node)
app.delete('/api/issues/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteIssue(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create connection (relationship)
app.post('/api/connections', async (req, res) => {
  try {
    const { sourceId, targetId, relationType, props } = req.body;
    if (!sourceId || !targetId) {
      return res.status(400).json({ error: 'sourceId and targetId are required' });
    }
    const result = await createConnection(sourceId, targetId, relationType, props);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete connection (relationship)
app.delete('/api/connections', async (req, res) => {
  try {
    const { sourceId, targetId, relationType } = req.body;
    if (!sourceId || !targetId) {
      return res.status(400).json({ error: 'sourceId and targetId are required' });
    }
    const result = await deleteConnection(sourceId, targetId, relationType);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Knowledge Base routes
app.get('/api/knowledge-base', async (req, res) => {
  try {
    const docs = await getKnowledgeDocs();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/knowledge-base', async (req, res) => {
  try {
    const result = await createKnowledgeDoc(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Graph commit & pull-request node registration
app.post('/api/graph/commits', async (req, res) => {
  try {
    const result = await createCommitNode(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/graph/pull-requests', async (req, res) => {
  try {
    const result = await createPullRequestNode(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Workspace & Git Repository routes
app.get('/api/workspace/repos', (req, res) => {
  try {
    res.json(getWorkspaceRepos());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workspace/commits', (req, res) => {
  try {
    const repo = req.query.repo || 'fb_clone_repo';
    res.json(getRepoCommits(repo));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workspace/files', (req, res) => {
  try {
    const repo = req.query.repo || 'fb_clone_repo';
    res.json(getRepoFiles(repo));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workspace/file-content', (req, res) => {
  try {
    const { repo = 'fb_clone_repo', path: filePath, ref } = req.query;
    if (!filePath) return res.status(400).json({ error: 'path query parameter is required' });
    const content = getFileContent(repo, filePath, ref);
    res.json({ path: filePath, content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workspace/diff', (req, res) => {
  try {
    const { repo = 'fb_clone_repo', base, target, file } = req.query;
    const diffData = getRepoDiff(repo, base, target, file);
    res.json(diffData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workspace/repo', (req, res) => {
  try {
    const repo = req.query.repo || 'fb_clone_repo';
    const prFile = path.join(workspaceRepoPath, 'pull_requests.json');
    let pullRequests = [];
    if (fs.existsSync(prFile)) {
      pullRequests = JSON.parse(fs.readFileSync(prFile, 'utf8'));
    }

    const commits = getRepoCommits(repo);
    const repos = getWorkspaceRepos();
    const activeRepo = repos.find(r => r.name === repo) || { branch: 'master' };

    res.json({
      repoName: repo,
      repoPath: `/workspace/${repo}`,
      branch: activeRepo.branch || 'master',
      previewUrl: 'http://localhost:4000/workspace/preview',
      commits,
      pullRequests,
      exists: fs.existsSync(workspaceRepoPath)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Populate sample data / seed fb clone
app.post('/api/seed', async (req, res) => {
  try {
    const result = await seedFbCloneProject();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/seed/fb-clone', async (req, res) => {
  try {
    const result = await seedFbCloneProject();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-seed if empty on boot
(async () => {
  try {
    const data = await getGraphData();
    if (data.nodes.length === 0) {
      console.log('[Neo4j] No nodes found. Seeding initial Facebook Clone project dataset...');
      await seedFbCloneProject();
    }
  } catch (e) {
    console.error('Boot seed error:', e);
  }
})();

app.listen(PORT, () => {
  console.log(`[Express API] Jira Graph Server running on http://localhost:${PORT}`);
});
