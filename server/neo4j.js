import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
dotenv.config();

let connectionConfig = {
  uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
  user: process.env.NEO4J_USER || 'neo4j',
  password: process.env.NEO4J_PASSWORD || '12345678',
  database: process.env.NEO4J_DATABASE || 'neo4j'
};

let driver = null;
let isConnected = false;
let lastError = null;

// Fallback in-memory stores if Neo4j is offline
let memoryIssues = [];
let memoryRelations = [];
let memoryDocs = [];
let memoryPRs = [];
let memoryCommits = [];

export function getConnectionConfig() {
  return { ...connectionConfig, password: connectionConfig.password ? '******' : '' };
}

export async function initDriver(newConfig = null) {
  if (newConfig) {
    connectionConfig = {
      ...connectionConfig,
      ...newConfig,
      password: newConfig.password || connectionConfig.password
    };
  }

  if (driver) {
    try {
      await driver.close();
    } catch (e) {
      console.error('Error closing existing driver:', e);
    }
  }

  try {
    driver = neo4j.driver(
      connectionConfig.uri,
      neo4j.auth.basic(connectionConfig.user, connectionConfig.password),
      {
        connectionTimeout: 4000,
        maxConnectionLifetime: 30000
      }
    );

    // Verify connectivity
    const serverInfo = await driver.getServerInfo();
    isConnected = true;
    lastError = null;
    console.log(`[Neo4j] Connected successfully to ${serverInfo.agent} at ${connectionConfig.uri}`);
    return { success: true, serverInfo: serverInfo.agent };
  } catch (err) {
    isConnected = false;
    lastError = err.message || 'Failed to connect to Neo4j';
    console.warn(`[Neo4j] Connection warning: ${lastError}. Operating with fallback sync store.`);
    return { success: false, error: lastError };
  }
}

export function getStatus() {
  return {
    connected: isConnected,
    uri: connectionConfig.uri,
    user: connectionConfig.user,
    database: connectionConfig.database,
    error: lastError,
    activeMode: isConnected ? 'Neo4j Live Graph' : 'Local Fallback (Neo4j Offline)'
  };
}

export async function testConnection(customConfig) {
  const testDriver = neo4j.driver(
    customConfig.uri,
    neo4j.auth.basic(customConfig.user, customConfig.password),
    { connectionTimeout: 4000 }
  );
  try {
    const info = await testDriver.getServerInfo();
    await testDriver.close();
    return { success: true, agent: info.agent };
  } catch (err) {
    await testDriver.close().catch(() => {});
    return { success: false, error: err.message };
  }
}

export async function getGraphData() {
  if (!isConnected || !driver) {
    const combinedNodes = [...memoryIssues, ...memoryDocs, ...memoryPRs, ...memoryCommits];
    return {
      nodes: combinedNodes,
      relationships: memoryRelations,
      source: 'memory'
    };
  }

  const session = driver.session({ database: connectionConfig.database });
  try {
    // Return all labeled entities: Issue, Doc, PullRequest, Commit
    const nodesResult = await session.run(`
      MATCH (n)
      WHERE n:Issue OR n:Doc OR n:PullRequest OR n:Commit
      RETURN n {
        .*,
        nodeLabel: labels(n)[0]
      } AS node
      ORDER BY coalesce(n.updatedAt, n.createdAt, n.id) DESC
    `);

    const nodes = nodesResult.records.map(record => {
      const node = record.get('node');
      return {
        ...node,
        storyPoints: node.storyPoints ? Number(node.storyPoints) : 0,
        nodeLabel: node.nodeLabel || (node.key?.startsWith('FB-') || node.key?.startsWith('KAN-') ? 'Issue' : 'Node')
      };
    });

    const relsResult = await session.run(`
      MATCH (a)-[r]->(b)
      WHERE (a:Issue OR a:Doc OR a:PullRequest OR a:Commit) AND (b:Issue OR b:Doc OR b:PullRequest OR b:Commit)
      RETURN a.id AS sourceId, coalesce(a.key, a.id) AS sourceKey, coalesce(a.title, a.name, a.id) AS sourceTitle, labels(a)[0] AS sourceLabel,
             b.id AS targetId, coalesce(b.key, b.id) AS targetKey, coalesce(b.title, b.name, b.id) AS targetTitle, labels(b)[0] AS targetLabel,
             type(r) AS type, properties(r) AS props
    `);

    const relationships = relsResult.records.map(rec => ({
      sourceId: rec.get('sourceId'),
      sourceKey: rec.get('sourceKey'),
      sourceTitle: rec.get('sourceTitle'),
      sourceLabel: rec.get('sourceLabel'),
      targetId: rec.get('targetId'),
      targetKey: rec.get('targetKey'),
      targetTitle: rec.get('targetTitle'),
      targetLabel: rec.get('targetLabel'),
      type: rec.get('type'),
      props: rec.get('props') || {}
    }));

    // Update memory caches
    memoryIssues = nodes.filter(n => n.nodeLabel === 'Issue');
    memoryDocs = nodes.filter(n => n.nodeLabel === 'Doc');
    memoryPRs = nodes.filter(n => n.nodeLabel === 'PullRequest');
    memoryCommits = nodes.filter(n => n.nodeLabel === 'Commit');
    memoryRelations = [...relationships];

    return { nodes, relationships, source: 'neo4j' };
  } catch (err) {
    console.error('[Neo4j] getGraphData error:', err);
    return {
      nodes: [...memoryIssues, ...memoryDocs, ...memoryPRs, ...memoryCommits],
      relationships: memoryRelations,
      source: 'memory',
      error: err.message
    };
  } finally {
    await session.close();
  }
}

export async function createIssue(issueData) {
  const now = new Date().toISOString();
  const id = issueData.id || `jira-${Date.now()}`;
  const key = issueData.key || `FB-${Math.floor(100 + Math.random() * 900)}`;

  const node = {
    id,
    key,
    title: issueData.title || 'Untitled Issue',
    description: issueData.description || '',
    status: issueData.status || 'TODO',
    priority: issueData.priority || 'MEDIUM',
    type: issueData.type || 'Task',
    assignee: issueData.assignee || 'Unassigned',
    storyPoints: Number(issueData.storyPoints) || 1,
    nodeLabel: 'Issue',
    createdAt: now,
    updatedAt: now
  };

  if (!isConnected || !driver) {
    memoryIssues.push(node);
    return { issue: node, source: 'memory' };
  }

  const session = driver.session({ database: connectionConfig.database });
  try {
    const res = await session.run(
      `
      MERGE (n:Issue { id: $id })
      SET n += {
        key: $key,
        title: $title,
        description: $description,
        status: $status,
        priority: $priority,
        type: $type,
        assignee: $assignee,
        storyPoints: $storyPoints,
        createdAt: $createdAt,
        updatedAt: $updatedAt
      }
      RETURN n { .*, nodeLabel: 'Issue' } AS created
      `,
      node
    );
    const created = res.records[0]?.get('created');
    memoryIssues = memoryIssues.filter(i => i.id !== id).concat(node);
    return { issue: created || node, source: 'neo4j' };
  } catch (err) {
    console.error('[Neo4j] createIssue error:', err);
    memoryIssues.push(node);
    return { issue: node, source: 'memory', error: err.message };
  } finally {
    await session.close();
  }
}

export async function updateIssue(id, updates) {
  const now = new Date().toISOString();
  const safeUpdates = {
    ...updates,
    updatedAt: now
  };

  if (!isConnected || !driver) {
    const idx = memoryIssues.findIndex(i => i.id === id || (i.key && String(i.key).toLowerCase() === String(id).toLowerCase()));
    if (idx !== -1) {
      memoryIssues[idx] = { ...memoryIssues[idx], ...safeUpdates };
      return { issue: memoryIssues[idx], source: 'memory' };
    }
    return { error: 'Issue not found' };
  }

  const session = driver.session({ database: connectionConfig.database });
  try {
    const res = await session.run(
      `
      MATCH (n:Issue)
      WHERE n.id = $id OR toLower(coalesce(n.key, '')) = toLower($id)
      SET n += $updates
      RETURN n { .*, nodeLabel: 'Issue' } AS updated
      `,
      { id, updates: safeUpdates }
    );
    if (res.records.length === 0) {
      return { error: 'Issue not found in Neo4j' };
    }
    const updated = res.records[0].get('updated');
    const idx = memoryIssues.findIndex(i => i.id === id || (i.key && String(i.key).toLowerCase() === String(id).toLowerCase()));
    if (idx !== -1) memoryIssues[idx] = { ...memoryIssues[idx], ...updated };
    return { issue: updated, source: 'neo4j' };
  } catch (err) {
    console.error('[Neo4j] updateIssue error:', err);
    return { error: err.message };
  } finally {
    await session.close();
  }
}

export async function deleteIssue(id) {
  if (!isConnected || !driver) {
    memoryIssues = memoryIssues.filter(i => i.id !== id);
    memoryRelations = memoryRelations.filter(r => r.sourceId !== id && r.targetId !== id);
    return { success: true, source: 'memory' };
  }

  const session = driver.session({ database: connectionConfig.database });
  try {
    await session.run(
      `
      MATCH (n { id: $id })
      DETACH DELETE n
      `,
      { id }
    );
    memoryIssues = memoryIssues.filter(i => i.id !== id);
    memoryRelations = memoryRelations.filter(r => r.sourceId !== id && r.targetId !== id);
    return { success: true, source: 'neo4j' };
  } catch (err) {
    console.error('[Neo4j] deleteIssue error:', err);
    return { error: err.message };
  } finally {
    await session.close();
  }
}

export async function createConnection(sourceId, targetId, relationType = 'BLOCKS', props = {}) {
  const allowed = ['BLOCKS', 'DEPENDS_ON', 'RELATES_TO', 'SUBTASK_OF', 'DUPLICATES', 'DOCUMENTED_IN', 'RESOLVES', 'REFERENCES'];
  const safeType = allowed.includes(relationType.toUpperCase()) ? relationType.toUpperCase() : 'RELATES_TO';
  const now = new Date().toISOString();

  const relRecord = {
    sourceId,
    targetId,
    type: safeType,
    props: { ...props, createdAt: now }
  };

  if (!isConnected || !driver) {
    const existing = memoryRelations.find(
      r => r.sourceId === sourceId && r.targetId === targetId && r.type === safeType
    );
    if (!existing) {
      const allNodes = [...memoryIssues, ...memoryDocs, ...memoryPRs, ...memoryCommits];
      const src = allNodes.find(i => i.id === sourceId);
      const tgt = allNodes.find(i => i.id === targetId);
      memoryRelations.push({
        ...relRecord,
        sourceKey: src?.key || sourceId,
        sourceTitle: src?.title || src?.name || '',
        targetKey: tgt?.key || targetId,
        targetTitle: tgt?.title || tgt?.name || ''
      });
    }
    return { connection: relRecord, source: 'memory' };
  }

  const session = driver.session({ database: connectionConfig.database });
  try {
    const query = `
      MATCH (a { id: $sourceId })
      MATCH (b { id: $targetId })
      MERGE (a)-[r:${safeType}]->(b)
      SET r.createdAt = $createdAt
      RETURN a.id AS sourceId, coalesce(a.key, a.id) AS sourceKey, coalesce(a.title, a.name, a.id) AS sourceTitle,
             b.id AS targetId, coalesce(b.key, b.id) AS targetKey, coalesce(b.title, b.name, b.id) AS targetTitle,
             type(r) AS type, properties(r) AS props
    `;
    const res = await session.run(query, {
      sourceId,
      targetId,
      createdAt: now
    });

    if (res.records.length === 0) {
      return { error: 'Source or target node not found in Neo4j' };
    }

    const rec = res.records[0];
    const createdRel = {
      sourceId: rec.get('sourceId'),
      sourceKey: rec.get('sourceKey'),
      sourceTitle: rec.get('sourceTitle'),
      targetId: rec.get('targetId'),
      targetKey: rec.get('targetKey'),
      targetTitle: rec.get('targetTitle'),
      type: rec.get('type'),
      props: rec.get('props')
    };

    memoryRelations.push(createdRel);
    return { connection: createdRel, source: 'neo4j' };
  } catch (err) {
    console.error('[Neo4j] createConnection error:', err);
    return { error: err.message };
  } finally {
    await session.close();
  }
}

export async function deleteConnection(sourceId, targetId, relationType) {
  if (!isConnected || !driver) {
    memoryRelations = memoryRelations.filter(
      r => !(r.sourceId === sourceId && r.targetId === targetId && (!relationType || r.type === relationType))
    );
    return { success: true, source: 'memory' };
  }

  const session = driver.session({ database: connectionConfig.database });
  try {
    let query = `
      MATCH (a { id: $sourceId })-[r]->(b { id: $targetId })
    `;
    if (relationType) {
      query += ` WHERE type(r) = $relationType `;
    }
    query += ` DELETE r RETURN count(r) AS deletedCount`;

    const res = await session.run(query, { sourceId, targetId, relationType });
    const count = res.records[0]?.get('deletedCount');

    memoryRelations = memoryRelations.filter(
      r => !(r.sourceId === sourceId && r.targetId === targetId && (!relationType || r.type === relationType))
    );

    return { success: true, deleted: count ? Number(count) : 0, source: 'neo4j' };
  } catch (err) {
    console.error('[Neo4j] deleteConnection error:', err);
    return { error: err.message };
  } finally {
    await session.close();
  }
}

// -------------------------------------------------------------
// Knowledge Base Operations
// -------------------------------------------------------------

export async function getKnowledgeDocs() {
  if (!isConnected || !driver) {
    return memoryDocs;
  }

  const session = driver.session({ database: connectionConfig.database });
  try {
    const res = await session.run(`
      MATCH (d:Doc)
      OPTIONAL MATCH (i:Issue)-[:DOCUMENTED_IN]->(d)
      WITH d, collect(CASE WHEN i IS NOT NULL THEN i { .id, .key, .title, .status } END) AS rawIssues
      RETURN d {
        .*,
        nodeLabel: 'Doc'
      } AS doc,
      [x IN rawIssues WHERE x IS NOT NULL] AS linkedIssues
      ORDER BY doc.id ASC
    `);

    const docs = res.records.map(rec => ({
      ...rec.get('doc'),
      linkedIssues: rec.get('linkedIssues') || []
    }));

    memoryDocs = docs;
    return docs;
  } catch (err) {
    console.error('[Neo4j] getKnowledgeDocs error:', err);
    return memoryDocs;
  } finally {
    await session.close();
  }
}

export async function createKnowledgeDoc(docData) {
  const now = new Date().toISOString();
  const id = docData.id || `kb-${Date.now()}`;
  const key = docData.key || id.toUpperCase();
  const linkedKeyOrId = docData.linkedIssueKey || docData.linkedIssueId || '';

  const doc = {
    id,
    key,
    title: docData.title || 'Untitled Document',
    category: docData.category || 'General',
    author: docData.author || 'Auto-Jira Agent',
    summary: docData.summary || '',
    content: docData.content || '',
    nodeLabel: 'Doc',
    createdAt: now,
    updatedAt: now
  };

  if (!isConnected || !driver) {
    memoryDocs = memoryDocs.filter(d => d.id !== id).concat(doc);
    if (linkedKeyOrId) {
      const issue = memoryIssues.find(i => i.id === linkedKeyOrId || (i.key && String(i.key).toLowerCase() === String(linkedKeyOrId).toLowerCase()));
      if (issue) {
        await createConnection(issue.id, doc.id, 'DOCUMENTED_IN');
      }
    }
    return { doc, source: 'memory' };
  }

  const session = driver.session({ database: connectionConfig.database });
  try {
    await session.run(`
      MERGE (d:Doc { id: $id })
      SET d += {
        key: $key,
        title: $title,
        category: $category,
        author: $author,
        summary: $summary,
        content: $content,
        createdAt: $createdAt,
        updatedAt: $updatedAt
      }
      RETURN d { .*, nodeLabel: 'Doc' } AS created
    `, doc);

    memoryDocs = memoryDocs.filter(d => d.id !== id).concat(doc);

    if (linkedKeyOrId) {
      await session.run(`
        MATCH (i:Issue), (d:Doc { id: $docId })
        WHERE i.id = $keyOrId OR toLower(coalesce(i.key, '')) = toLower($keyOrId)
        MERGE (i)-[:DOCUMENTED_IN]->(d)
      `, { docId: doc.id, keyOrId: linkedKeyOrId });
    }

    return { doc, source: 'neo4j' };
  } catch (err) {
    console.error('[Neo4j] createKnowledgeDoc error:', err);
    memoryDocs = memoryDocs.filter(d => d.id !== id).concat(doc);
    return { doc, source: 'memory', error: err.message };
  } finally {
    await session.close();
  }
}

export async function createCommitNode(commitData) {
  const now = new Date().toISOString();
  const rawHash = commitData.hash || Date.now().toString(16).slice(-7);
  const id = commitData.id || `commit-${rawHash}`;
  const linkedKeyOrId = commitData.linkedIssueKey || commitData.linkedIssueId || '';

  const commit = {
    id,
    hash: rawHash,
    message: commitData.message || 'Automated commit',
    author: commitData.author || 'Auto-Jira Agent',
    linkedIssueKey: linkedKeyOrId,
    createdAt: commitData.createdAt || now,
    nodeLabel: 'Commit'
  };

  if (!isConnected || !driver) {
    memoryCommits = memoryCommits.filter(c => c.id !== id).concat(commit);
    if (linkedKeyOrId) {
      const issue = memoryIssues.find(i => i.id === linkedKeyOrId || (i.key && String(i.key).toLowerCase() === String(linkedKeyOrId).toLowerCase()));
      if (issue) {
        await createConnection(commit.id, issue.id, 'REFERENCES');
      }
    }
    return { commit, source: 'memory' };
  }

  const session = driver.session({ database: connectionConfig.database });
  try {
    await session.run(`
      MERGE (c:Commit { id: $id })
      SET c += {
        hash: $hash,
        message: $message,
        author: $author,
        linkedIssueKey: $linkedIssueKey,
        createdAt: $createdAt,
        nodeLabel: 'Commit'
      }
      RETURN c { .*, nodeLabel: 'Commit' } AS created
    `, commit);

    memoryCommits = memoryCommits.filter(c => c.id !== id).concat(commit);

    if (linkedKeyOrId) {
      await session.run(`
        MATCH (c:Commit { id: $commitId }), (i:Issue)
        WHERE i.id = $keyOrId OR toLower(coalesce(i.key, '')) = toLower($keyOrId)
        MERGE (c)-[:REFERENCES]->(i)
      `, { commitId: commit.id, keyOrId: linkedKeyOrId });
    }

    return { commit, source: 'neo4j' };
  } catch (err) {
    console.error('[Neo4j] createCommitNode error:', err);
    memoryCommits = memoryCommits.filter(c => c.id !== id).concat(commit);
    return { commit, source: 'memory', error: err.message };
  } finally {
    await session.close();
  }
}

export async function createPullRequestNode(prData) {
  const now = new Date().toISOString();
  const id = prData.id || `pr-${prData.number || Date.now()}`;
  const linkedKeyOrId = prData.linkedIssueKey || prData.linkedIssueId || '';

  const pr = {
    id,
    number: prData.number || 1,
    title: prData.title || 'Automated Pull Request',
    status: prData.status || 'OPEN',
    branch: prData.branch || 'main',
    author: prData.author || 'Auto-Jira Agent',
    linkedIssueKey: linkedKeyOrId,
    createdAt: prData.createdAt || now,
    nodeLabel: 'PullRequest'
  };

  if (!isConnected || !driver) {
    memoryPRs = memoryPRs.filter(p => p.id !== id).concat(pr);
    if (linkedKeyOrId) {
      const issue = memoryIssues.find(i => i.id === linkedKeyOrId || (i.key && String(i.key).toLowerCase() === String(linkedKeyOrId).toLowerCase()));
      if (issue) {
        await createConnection(pr.id, issue.id, 'RESOLVES');
      }
    }
    return { pullRequest: pr, source: 'memory' };
  }

  const session = driver.session({ database: connectionConfig.database });
  try {
    await session.run(`
      MERGE (p:PullRequest { id: $id })
      SET p += {
        number: $number,
        title: $title,
        status: $status,
        branch: $branch,
        author: $author,
        linkedIssueKey: $linkedIssueKey,
        createdAt: $createdAt,
        nodeLabel: 'PullRequest'
      }
      RETURN p { .*, nodeLabel: 'PullRequest' } AS created
    `, pr);

    memoryPRs = memoryPRs.filter(p => p.id !== id).concat(pr);

    if (linkedKeyOrId) {
      await session.run(`
        MATCH (p:PullRequest { id: $prId }), (i:Issue)
        WHERE i.id = $keyOrId OR toLower(coalesce(i.key, '')) = toLower($keyOrId)
        MERGE (p)-[:RESOLVES]->(i)
      `, { prId: pr.id, keyOrId: linkedKeyOrId });
    }

    return { pullRequest: pr, source: 'neo4j' };
  } catch (err) {
    console.error('[Neo4j] createPullRequestNode error:', err);
    memoryPRs = memoryPRs.filter(p => p.id !== id).concat(pr);
    return { pullRequest: pr, source: 'memory', error: err.message };
  } finally {
    await session.close();
  }
}

// -------------------------------------------------------------
// Seeding Facebook Clone Project Plan, Docs, PRs & Commits
// -------------------------------------------------------------

export async function seedFbCloneProject() {
  console.log('[Neo4j] Seeding Facebook Clone Project Plan, Knowledge Base, PRs & Commits into Neo4j...');

  // 1. Jira Issues for Facebook Clone
  const issues = [
    {
      id: 'fb-101',
      key: 'FB-101',
      title: 'Core System Architecture & Neo4j Social Graph Modeling',
      description: 'Model users, friends (:FRIENDS_WITH), posts (:POSTED), reactions (:REACTED_TO), and comments (:COMMENTED_ON). Link to Knowledge Base specifications KB-FB-01 and KB-FB-02.',
      status: 'DONE',
      priority: 'HIGHEST',
      type: 'Epic',
      assignee: 'Alex Morgan',
      storyPoints: 8
    },
    {
      id: 'fb-102',
      key: 'FB-102',
      title: 'Initialize /workspace/fb_clone_repo & Git Skeleton',
      description: 'Scaffold responsive HTML5 layout, CSS tokens, and initial master branch git commits. Linked to Commit 795534c and KB-FB-03.',
      status: 'DONE',
      priority: 'HIGH',
      type: 'Task',
      assignee: 'Alex Morgan',
      storyPoints: 3
    },
    {
      id: 'fb-103',
      key: 'FB-103',
      title: 'Build Facebook News Feed & Post Creator Card',
      description: 'Responsive news feed layout, story carousel tray, "What\'s on your mind?" composer with photo preview and instant posting. Resolved by PR #1.',
      status: 'IN_PROGRESS',
      priority: 'HIGHEST',
      type: 'Story',
      assignee: 'Alex Morgan',
      storyPoints: 5
    },
    {
      id: 'fb-104',
      key: 'FB-104',
      title: 'Multi-Reaction Engine & Live Counters (Like, Love, Care, Haha)',
      description: 'Hover popup reaction bar for 7 emoji reactions with color highlights and live counter updates. Resolved by PR #2.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      type: 'Story',
      assignee: 'Sarah Connor',
      storyPoints: 3
    },
    {
      id: 'fb-105',
      key: 'FB-105',
      title: 'Threaded Comments & Timeline Share Handler',
      description: 'Interactive commenting with user avatars, Enter key binding, and share counter increment. Resolved by PR #3.',
      status: 'TODO',
      priority: 'HIGH',
      type: 'Story',
      assignee: 'David Kim',
      storyPoints: 5
    },
    {
      id: 'fb-106',
      key: 'FB-106',
      title: 'Messenger Contacts Tray & Floating Chat Popups',
      description: 'Right sidebar active friends list and docked chat popup with automated team responses. Resolved by PR #4.',
      status: 'TODO',
      priority: 'MEDIUM',
      type: 'Story',
      assignee: 'Elena Rostova',
      storyPoints: 5
    },
    {
      id: 'fb-107',
      key: 'FB-107',
      title: 'Mobile Media Preview Scaling & Viewport Adjustments',
      description: 'Fix feed media overflowing boundary box on screens under 768px. Resolved by PR #5.',
      status: 'REVIEW',
      priority: 'HIGH',
      type: 'Bug',
      assignee: 'Alex Morgan',
      storyPoints: 2
    },
    {
      id: 'fb-108',
      key: 'FB-108',
      title: 'Real-time Notifications Drawer & Dark Mode Toggle',
      description: 'Top navbar notification badge drawer and persistent dark theme preference stored in localStorage.',
      status: 'BACKLOG',
      priority: 'LOW',
      type: 'Story',
      assignee: 'Emma Watson',
      storyPoints: 3
    }
  ];

  // 2. Knowledge Base Documents for Facebook Clone
  const docs = [
    {
      id: 'kb-fb-01',
      key: 'KB-FB-01',
      title: 'Facebook Clone PRD & Project Blueprint',
      category: 'Product Requirements',
      author: 'Alex Morgan',
      summary: 'Functional and non-functional requirements for Facebook Clone web app, user stories, and acceptance criteria.',
      content: `### 1. Executive Summary & Product Vision
The Facebook Clone project delivers an authentic, high-fidelity social network experience coupled with real-time graph traceability inside Neo4j and Auto-Jira.

### 2. Core Functional Pillars
1. **Three-Column Responsive Layout**:
   - Left Sidebar: Profile shortcuts, Friends count (842), Memories, Saved, Groups.
   - Center Stream: Story Carousel, "What's on your mind?" Post Creator with photo attachments, Dynamic Feed.
   - Right Sidebar: Sponsored spotlight, Birthdays reminder, Live Contacts list with online indicator.
2. **Reactions Engine**:
   - Multi-emoji popup on hover: Like (👍), Love (❤️), Care (🥰), Haha (😆), Wow (😮), Sad (😢), Angry (😡).
   - Optimistic counter increments and active author highlights.
3. **Threaded Comments & Share Handler**:
   - Instant comment submission with avatar chips and counter tracking.
4. **Messenger Floating Chat Popup**:
   - Bottom-right anchored mini chat window with simulated team responses.

### 3. Traceability to Jira Kanban
All features are tracked from backlog to deployment via Jira keys FB-101 through FB-108.`
    },
    {
      id: 'kb-fb-02',
      key: 'KB-FB-02',
      title: 'Neo4j Social Graph Architecture & Cypher Schema',
      category: 'System Architecture',
      author: 'Lead Architect',
      summary: 'Graph database schema definition for social entities, relationships, and Jira project tracking.',
      content: `### 1. Social Property Graph Schema
In Neo4j Desktop, social interactions are mapped directly as labeled nodes and directed relationships:
- \`(:User {id, name, avatar, bio})\`
- \`(:Post {id, content, mediaUrl, createdAt})\`
- \`(:Comment {id, text, createdAt})\`

### 2. Social Relationship Types
- \`(:User)-[:FRIENDS_WITH {since: '2024-01-15'}]->(:User)\`
- \`(:User)-[:POSTED]->(:Post)\`
- \`(:User)-[:REACTED {type: 'LOVE'}]->(:Post)\`
- \`(:User)-[:COMMENTED_ON]->(:Post)\`

### 3. Auto-Jira Traceability Graph
To integrate with the Jira Kanban Board and Git Workspace:
- \`(:Issue)-[:DOCUMENTED_IN]->(:Doc)\`
- \`(:PullRequest)-[:RESOLVES]->(:Issue)\`
- \`(:Commit)-[:REFERENCES]->(:Issue)\`
- \`(:Issue)-[:BLOCKS]->(:Issue)\``
    },
    {
      id: 'kb-fb-03',
      key: 'KB-FB-03',
      title: 'Workspace & Git Workflow Specification (/workspace/fb_clone_repo)',
      category: 'DevOps & Git',
      author: 'DevOps Engineer',
      summary: 'Git branching strategy, commit conventions linking Jira issues, and pull request checklist.',
      content: `### 1. Workspace Directory Layout
The project workspace is located at \`/workspace/fb_clone_repo\`:
\`\`\`
/workspace/fb_clone_repo/
├── index.html            # Semantic HTML5 Facebook markup
├── styles.css            # Facebook blue theme & dark mode tokens
├── app.js                # Reactions, post creation, messenger engine
├── pull_requests.json    # Pull requests linked to Jira tickets
└── README.md             # Developer documentation & commit table
\`\`\`

### 2. Git Commit Convention
Every commit strictly references its associated Jira ticket:
- \`FB-101: Initial repository structure and architecture blueprint\`
- \`FB-102: Setup Facebook clone skeleton, navigation, and sidebar layout\`
- \`FB-103: Implement Story Tray and News Feed post creator card\`
- \`FB-104: Add multi-reaction picker (Like, Love, Care, Haha) with real-time counters\`
- \`FB-105: Implement nested comments threading and share handler\`
- \`FB-106: Add Messenger contacts sidebar and floating chat window\`
- \`FB-107: Responsive layout fixes for mobile viewports and media previews\``
    },
    {
      id: 'kb-fb-04',
      key: 'KB-FB-04',
      title: 'Frontend Component Architecture & Facebook Design Tokens',
      category: 'UI/UX Design',
      author: 'UI Specialist',
      summary: 'Color palettes, typography, spacing tokens, and micro-interaction specifications.',
      content: `### 1. Facebook Design System Tokens
- **Primary Brand**: \`#1877F2\` (Facebook Blue)
- **Primary Dark Mode**: \`#2D88FF\`
- **Background (Light)**: \`#F0F2F5\`
- **Background (Dark)**: \`#18191A\`
- **Surface (Light)**: \`#FFFFFF\`
- **Surface (Dark)**: \`#242526\`
- **Font Stack**: \`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif\`

### 2. Micro-Interactions
- **Reactions Hover Bar**: Bouncy spring animation \`cubic-bezier(0.18, 0.89, 0.32, 1.28)\`
- **Online Badge**: Green pill (\`#31a24c\`) with 2px border around avatars.`
    }
  ];

  // 3. Mock Pull Requests
  const pullRequests = [
    {
      id: 'pr-1',
      number: 1,
      title: 'feat(feed): FB-103 News Feed & Interactive Post Creator',
      status: 'MERGED',
      branch: 'feature/feed-ui',
      author: 'alex-dev',
      linkedIssueKey: 'FB-103'
    },
    {
      id: 'pr-2',
      number: 2,
      title: 'feat(reactions): FB-104 Multi-Reaction Engine & Live Counters',
      status: 'MERGED',
      branch: 'feature/reactions',
      author: 'sarah-ui',
      linkedIssueKey: 'FB-104'
    },
    {
      id: 'pr-3',
      number: 3,
      title: 'feat(comments): FB-105 Threaded Comments & Share Handler',
      status: 'OPEN',
      branch: 'feature/threaded-comments',
      author: 'david-kim',
      linkedIssueKey: 'FB-105'
    },
    {
      id: 'pr-4',
      number: 4,
      title: 'feat(messenger): FB-106 Interactive Contact Tray & Floating Chat Popups',
      status: 'OPEN',
      branch: 'feature/messenger-popup',
      author: 'elena-ro',
      linkedIssueKey: 'FB-106'
    },
    {
      id: 'pr-5',
      number: 5,
      title: 'fix(responsive): FB-107 Mobile Media Scaling & Viewport Adjustments',
      status: 'REVIEW',
      branch: 'fix/mobile-viewports',
      author: 'alex-dev',
      linkedIssueKey: 'FB-107'
    }
  ];

  // 4. Commits from git log with authors and timestamps
  const commits = [
    { id: 'commit-795534c', hash: '795534c', author: 'Alex Morgan', message: 'FB-101: Initial repository structure and architecture blueprint', linkedIssueKey: 'FB-101', createdAt: '2025-01-14T09:30:00Z', nodeLabel: 'Commit' },
    { id: 'commit-4ba2a47', hash: '4ba2a47', author: 'Alex Morgan', message: 'FB-102: Setup Facebook clone skeleton, navigation, and sidebar layout', linkedIssueKey: 'FB-102', createdAt: '2025-01-14T11:45:00Z', nodeLabel: 'Commit' },
    { id: 'commit-002ec12', hash: '002ec12', author: 'Alex Morgan', message: 'FB-103: Implement Story Tray and News Feed post creator card', linkedIssueKey: 'FB-103', createdAt: '2025-01-15T14:20:00Z', nodeLabel: 'Commit' },
    { id: 'commit-8c56a2f', hash: '8c56a2f', author: 'Sarah Connor', message: 'FB-104: Add multi-reaction picker (Like, Love, Care, Haha) with real-time counters', linkedIssueKey: 'FB-104', createdAt: '2025-01-15T16:10:00Z', nodeLabel: 'Commit' },
    { id: 'commit-c3d5a5c', hash: 'c3d5a5c', author: 'David Kim', message: 'FB-105: Implement nested comments threading and share handler', linkedIssueKey: 'FB-105', createdAt: '2025-01-16T10:05:00Z', nodeLabel: 'Commit' },
    { id: 'commit-7f1e37f', hash: '7f1e37f', author: 'Elena Rostova', message: 'FB-106: Add Messenger contacts sidebar and floating chat window', linkedIssueKey: 'FB-106', createdAt: '2025-01-16T15:30:00Z', nodeLabel: 'Commit' },
    { id: 'commit-dd19bac', hash: 'dd19bac', author: 'Alex Morgan', message: 'FB-107: Responsive layout fixes for mobile viewports and media previews', linkedIssueKey: 'FB-107', createdAt: '2025-01-17T12:00:00Z', nodeLabel: 'Commit' }
  ];

  // Insert Issues
  for (const issue of issues) {
    await createIssue(issue);
  }

  // Insert Knowledge Base Docs
  for (const doc of docs) {
    await createKnowledgeDoc(doc);
  }

  // Insert PR nodes into Neo4j if live
  if (isConnected && driver) {
    const session = driver.session({ database: connectionConfig.database });
    try {
      for (const pr of pullRequests) {
        await session.run(`
          MERGE (p:PullRequest { id: $id })
          SET p += {
            number: $number,
            title: $title,
            status: $status,
            branch: $branch,
            author: $author,
            linkedIssueKey: $linkedIssueKey,
            nodeLabel: 'PullRequest'
          }
        `, pr);
      }

      for (const c of commits) {
        await session.run(`
          MERGE (c:Commit { id: $id })
          SET c += {
            hash: $hash,
            author: $author,
            message: $message,
            createdAt: $createdAt,
            linkedIssueKey: $linkedIssueKey,
            nodeLabel: 'Commit'
          }
        `, c);
      }
    } finally {
      await session.close();
    }
  } else {
    memoryPRs = pullRequests.map(p => ({ ...p, nodeLabel: 'PullRequest' }));
    memoryCommits = commits.map(c => ({ ...c, nodeLabel: 'Commit' }));
  }

  // Create Graph Connections
  // 1. Issue -> Issue Dependencies
  await createConnection('fb-101', 'fb-102', 'BLOCKS');
  await createConnection('fb-102', 'fb-103', 'BLOCKS');
  await createConnection('fb-103', 'fb-104', 'BLOCKS');
  await createConnection('fb-104', 'fb-105', 'BLOCKS');
  await createConnection('fb-103', 'fb-106', 'RELATES_TO');
  await createConnection('fb-107', 'fb-103', 'DEPENDS_ON');
  await createConnection('fb-108', 'fb-106', 'RELATES_TO');

  // 2. Issue -> Knowledge Base Doc Links
  await createConnection('fb-101', 'kb-fb-01', 'DOCUMENTED_IN');
  await createConnection('fb-101', 'kb-fb-02', 'DOCUMENTED_IN');
  await createConnection('fb-102', 'kb-fb-03', 'DOCUMENTED_IN');
  await createConnection('fb-103', 'kb-fb-04', 'DOCUMENTED_IN');

  // 3. Pull Request -> Issue Links
  await createConnection('pr-1', 'fb-103', 'RESOLVES');
  await createConnection('pr-2', 'fb-104', 'RESOLVES');
  await createConnection('pr-3', 'fb-105', 'RESOLVES');
  await createConnection('pr-4', 'fb-106', 'RESOLVES');
  await createConnection('pr-5', 'fb-107', 'RESOLVES');

  // 4. Commit -> Issue Links
  await createConnection('commit-795534c', 'fb-101', 'REFERENCES');
  await createConnection('commit-4ba2a47', 'fb-102', 'REFERENCES');
  await createConnection('commit-002ec12', 'fb-103', 'REFERENCES');
  await createConnection('commit-8c56a2f', 'fb-104', 'REFERENCES');
  await createConnection('commit-c3d5a5c', 'fb-105', 'REFERENCES');
  await createConnection('commit-7f1e37f', 'fb-106', 'REFERENCES');
  await createConnection('commit-dd19bac', 'fb-107', 'REFERENCES');

  console.log('[Neo4j] Finished seeding Facebook Clone graph network!');
  return {
    success: true,
    issuesCount: issues.length,
    docsCount: docs.length,
    pullRequestsCount: pullRequests.length,
    commitsCount: commits.length
  };
}

export async function populateSampleData() {
  return await seedFbCloneProject();
}

export function getDriver() {
  return driver;
}

export function getIsConnected() {
  return isConnected;
}

export function getMemoryGraph() {
  return {
    issues: memoryIssues,
    relations: memoryRelations,
    docs: memoryDocs,
    prs: memoryPRs,
    commits: memoryCommits
  };
}

// Initial connection attempt & bootstrap seed
initDriver()
  .then(() => {
    if (memoryIssues.length === 0) {
      seedFbCloneProject().catch(() => {});
    }
  })
  .catch(() => {
    if (memoryIssues.length === 0) {
      seedFbCloneProject().catch(() => {});
    }
  });
