const BASE_URL = '/api';

export async function fetchStatus() {
  const res = await fetch(`${BASE_URL}/status`);
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
}

export async function updateNeo4jConfig(config) {
  const res = await fetch(`${BASE_URL}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  if (!res.ok) throw new Error('Failed to update Neo4j config');
  return res.json();
}

export async function testNeo4jConnection(config) {
  const res = await fetch(`${BASE_URL}/config/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  if (!res.ok) throw new Error('Failed to test connection');
  return res.json();
}

export async function fetchGraph() {
  const res = await fetch(`${BASE_URL}/graph`);
  if (!res.ok) throw new Error('Failed to fetch graph data');
  return res.json();
}

export async function createIssue(issueData) {
  const res = await fetch(`${BASE_URL}/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(issueData)
  });
  if (!res.ok) throw new Error('Failed to create issue');
  return res.json();
}

export async function updateIssue(id, updates) {
  const res = await fetch(`${BASE_URL}/issues/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update issue');
  return res.json();
}

export async function deleteIssue(id) {
  const res = await fetch(`${BASE_URL}/issues/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete issue');
  return res.json();
}

export async function createConnection(sourceId, targetId, relationType) {
  const res = await fetch(`${BASE_URL}/connections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId, targetId, relationType })
  });
  if (!res.ok) throw new Error('Failed to create graph connection');
  return res.json();
}

export async function deleteConnection(sourceId, targetId, relationType) {
  const res = await fetch(`${BASE_URL}/connections`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId, targetId, relationType })
  });
  if (!res.ok) throw new Error('Failed to delete connection');
  return res.json();
}

export async function seedSampleData() {
  const res = await fetch(`${BASE_URL}/seed`);
  if (!res.ok) throw new Error('Failed to seed sample data');
  return res.json();
}

export async function fetchKnowledgeDocs() {
  const res = await fetch(`${BASE_URL}/knowledge-base`);
  if (!res.ok) throw new Error('Failed to fetch knowledge base');
  return res.json();
}

export async function createKnowledgeDoc(docData) {
  const res = await fetch(`${BASE_URL}/knowledge-base`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(docData)
  });
  if (!res.ok) throw new Error('Failed to create doc');
  return res.json();
}

export async function fetchWorkspaceRepo() {
  const res = await fetch(`${BASE_URL}/workspace/repo`);
  if (!res.ok) throw new Error('Failed to fetch workspace repo');
  return res.json();
}

export async function seedFbCloneProject() {
  const res = await fetch(`${BASE_URL}/seed/fb-clone`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to seed fb clone');
  return res.json();
}

export async function fetchWorkspaceRepos() {
  const res = await fetch(`${BASE_URL}/workspace/repos`);
  if (!res.ok) throw new Error('Failed to fetch workspace repos');
  return res.json();
}

export async function fetchWorkspaceCommits(repo = 'fb_clone_repo') {
  const res = await fetch(`${BASE_URL}/workspace/commits?repo=${encodeURIComponent(repo)}`);
  if (!res.ok) throw new Error('Failed to fetch commits');
  return res.json();
}

export async function fetchWorkspaceFiles(repo = 'fb_clone_repo') {
  const res = await fetch(`${BASE_URL}/workspace/files?repo=${encodeURIComponent(repo)}`);
  if (!res.ok) throw new Error('Failed to fetch files');
  return res.json();
}

export async function fetchWorkspaceFileContent(repo = 'fb_clone_repo', path, ref = null) {
  const url = `${BASE_URL}/workspace/file-content?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch file content');
  return res.json();
}

export async function fetchWorkspaceDiff({ repo = 'fb_clone_repo', base = null, target = null, file = null }) {
  const params = new URLSearchParams({ repo });
  if (base) params.append('base', base);
  if (target) params.append('target', target);
  if (file) params.append('file', file);
  const res = await fetch(`${BASE_URL}/workspace/diff?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch diff');
  return res.json();
}

const AGENT_BASE_URL = 'http://localhost:8000/api';

export async function fetchPipelineStatus() {
  const res = await fetch(`${AGENT_BASE_URL}/pipeline/status`);
  if (!res.ok) throw new Error('Failed to fetch pipeline status');
  return res.json();
}

export async function fetchPipelineHistory() {
  const res = await fetch(`${AGENT_BASE_URL}/pipeline/history`);
  if (!res.ok) throw new Error('Failed to fetch pipeline history');
  return res.json();
}

export async function triggerPipeline(ticketData) {
  const res = await fetch(`${AGENT_BASE_URL}/pipeline/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticketData)
  });
  if (!res.ok) throw new Error('Failed to trigger pipeline');
  return res.json();
}

export async function fetchAgentHealth() {
  const res = await fetch(`${AGENT_BASE_URL}/health`);
  if (!res.ok) throw new Error('Failed to fetch agent health');
  return res.json();
}



