import { getDriver, getIsConnected, getMemoryGraph, getConnectionConfig, seedFbCloneProject } from './neo4j.js';
import { getRepoCommits } from './gitService.js';
import { callActiveLLM, getLLMConfig } from './llmService.js';

// Knowledge Graph Schema for Cypher Generation
export const GRAPH_SCHEMA = {
  nodes: [
    {
      label: 'Commit',
      description: 'Git commits created by team members or autonomous AI agents, linked to Jira tickets',
      properties: ['id', 'hash', 'author', 'message', 'createdAt', 'linkedIssueKey', 'nodeLabel']
    },
    {
      label: 'Issue',
      description: 'Jira issues (Epics, Stories, Tasks, Bugs) tracked in the Kanban Board',
      properties: ['id', 'key', 'title', 'description', 'status', 'priority', 'type', 'assignee', 'storyPoints', 'createdAt', 'updatedAt']
    },
    {
      label: 'Doc',
      description: 'Technical documents, architectural specs, and PRDs in the Knowledge Base',
      properties: ['id', 'key', 'title', 'category', 'author', 'summary', 'content', 'createdAt']
    },
    {
      label: 'PullRequest',
      description: 'GitHub pull requests created for feature branches and bug fixes',
      properties: ['id', 'number', 'title', 'status', 'branch', 'author', 'linkedIssueKey', 'createdAt']
    }
  ],
  relationships: [
    { type: 'REFERENCES', pattern: '(:Commit)-[:REFERENCES]->(:Issue)', description: 'Commit references and links to a Jira ticket' },
    { type: 'RESOLVES', pattern: '(:PullRequest)-[:RESOLVES]->(:Issue)', description: 'Pull request implements or fixes a Jira ticket' },
    { type: 'BLOCKS', pattern: '(:Issue)-[:BLOCKS]->(:Issue)', description: 'Dependency where one issue blocks another' },
    { type: 'DEPENDS_ON', pattern: '(:Issue)-[:DEPENDS_ON]->(:Issue)', description: 'Issue requires another issue before starting' },
    { type: 'RELATES_TO', pattern: '(:Issue)-[:RELATES_TO]->(:Issue)', description: 'General relationship between related issues' },
    { type: 'DOCUMENTED_IN', pattern: '(:Issue)-[:DOCUMENTED_IN]->(:Doc)', description: 'Jira issue is detailed in a Knowledge Base article' }
  ],
  sampleQueries: [
    {
      title: 'Recent Commits by Author',
      prompt: 'How many recent commits were there and by whom?',
      cypher: 'MATCH (c:Commit) RETURN c.author AS author, count(c) AS commitCount, collect(c.message)[0..3] AS sampleMessages ORDER BY commitCount DESC',
      description: 'Calculates commit counts grouped by author with sample messages'
    },
    {
      title: 'Active In-Progress Issues',
      prompt: 'What issues are currently in progress and who is assigned?',
      cypher: "MATCH (i:Issue) WHERE i.status = 'IN_PROGRESS' RETURN i.key AS key, i.title AS title, i.priority AS priority, i.assignee AS assignee ORDER BY i.key ASC",
      description: 'Finds all tickets currently in progress with assignee details'
    },
    {
      title: 'Commits Linked to Jira Issues',
      prompt: 'Which commits reference Jira tickets in the graph?',
      cypher: 'MATCH (c:Commit)-[:REFERENCES]->(i:Issue) RETURN c.hash AS commitHash, c.author AS author, c.message AS commitMessage, i.key AS issueKey, i.title AS issueTitle LIMIT 10',
      description: 'Inspects traceability between git commits and Jira tickets'
    },
    {
      title: 'Pull Requests Resolving Issues',
      prompt: 'Show all pull requests and the Jira tickets they resolve',
      cypher: 'MATCH (p:PullRequest)-[:RESOLVES]->(i:Issue) RETURN p.number AS prNumber, p.title AS prTitle, p.status AS prStatus, p.author AS prAuthor, i.key AS issueKey, i.title AS issueTitle',
      description: 'Lists PRs with their target issue resolution links'
    },
    {
      title: 'Knowledge Base Documentation',
      prompt: 'What architecture and PRD documents exist in the knowledge base?',
      cypher: 'MATCH (d:Doc) RETURN d.key AS key, d.title AS title, d.category AS category, d.author AS author, d.summary AS summary ORDER BY d.key ASC',
      description: 'Retrieves all documentation articles in the knowledge graph'
    },
    {
      title: 'Blocked Issues and Dependencies',
      prompt: 'Which issues are blocked by other issues in the project?',
      cypher: 'MATCH (blocker:Issue)-[:BLOCKS]->(blocked:Issue) RETURN blocker.key AS blockerKey, blocker.title AS blockerTitle, blocked.key AS blockedKey, blocked.title AS blockedTitle',
      description: 'Identifies dependency bottlenecks between tickets'
    }
  ]
};

// Clean Neo4j Integer and complex types into standard JS types
function unwrapNeo4jValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') {
    if (val.constructor && val.constructor.name === 'Integer') {
      return val.toNumber();
    }
    if (typeof val.toNumber === 'function') {
      return val.toNumber();
    }
    if (Array.isArray(val)) {
      return val.map(unwrapNeo4jValue);
    }
    if (val.properties) {
      return unwrapNeo4jValue(val.properties);
    }
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = unwrapNeo4jValue(v);
    }
    return out;
  }
  return val;
}

// Merge git commits from repository with memoryCommits
function getAllCommits() {
  const memory = getMemoryGraph();
  const repoCommits = getRepoCommits('fb_clone_repo');
  const seenHashes = new Set();
  const combined = [];

  for (const c of memory.commits || []) {
    const hash = c.hash || c.id;
    if (hash && !seenHashes.has(hash)) {
      seenHashes.add(hash);
      combined.push({
        id: c.id || `commit-${hash}`,
        hash,
        author: c.author || 'Auto-Jira Agent',
        message: c.message || 'Updated project assets',
        createdAt: c.createdAt || new Date().toISOString(),
        linkedIssueKey: c.linkedIssueKey || null,
        nodeLabel: 'Commit'
      });
    }
  }

  for (const rc of repoCommits || []) {
    if (rc.hash && !seenHashes.has(rc.hash) && !seenHashes.has(rc.shortHash)) {
      seenHashes.add(rc.hash);
      combined.push({
        id: `commit-${rc.shortHash || rc.hash.slice(0, 7)}`,
        hash: rc.shortHash || rc.hash.slice(0, 7),
        author: rc.author || 'Auto-Jira Agent',
        message: rc.message || 'Workspace repository update',
        createdAt: rc.date || new Date().toISOString(),
        linkedIssueKey: rc.linkedIssueKey || null,
        nodeLabel: 'Commit'
      });
    }
  }

  return combined;
}

// Executes a Cypher query on Live Neo4j or In-Memory fallback store
export async function executeCypher(cypherQuery, params = {}) {
  const startTime = Date.now();
  const driver = getDriver();
  const isConnected = getIsConnected();
  const cleanCypher = cypherQuery.trim();

  if (isConnected && driver) {
    const dbConfig = getConnectionConfig();
    const session = driver.session({ database: dbConfig.database || 'neo4j' });
    try {
      const result = await session.run(cleanCypher, params);
      const records = result.records.map(record => {
        const row = {};
        record.keys.forEach(key => {
          row[key] = unwrapNeo4jValue(record.get(key));
        });
        return row;
      });

      const latency = Date.now() - startTime;
      return {
        records,
        count: records.length,
        executionTimeMs: latency,
        source: 'neo4j',
        cypher: cleanCypher
      };
    } catch (err) {
      console.warn(`[Neo4j] Cypher execution error on live driver: ${err.message}. Falling back to memory evaluator.`);
    } finally {
      await session.close();
    }
  }

  // Ensure memory graph is initialized with project data if empty
  const currentMemory = getMemoryGraph();
  if (!currentMemory.issues || currentMemory.issues.length === 0) {
    try {
      await seedFbCloneProject();
    } catch (_) {}
  }

  // Memory fallback query evaluator
  const records = evaluateMemoryCypher(cleanCypher);
  const latency = Date.now() - startTime;
  return {
    records,
    count: records.length,
    executionTimeMs: latency,
    source: 'memory',
    cypher: cleanCypher
  };
}

// Intelligent in-memory evaluator for Cypher queries when Neo4j is offline
function evaluateMemoryCypher(cypher) {
  const lower = cypher.toLowerCase();
  const memory = getMemoryGraph();
  const allCommits = getAllCommits();
  const allIssues = memory.issues || [];
  const allDocs = memory.docs || [];
  const allPRs = memory.prs || [];
  const allRels = memory.relations || [];

  // Query 1: Commit grouping by author / count
  if (lower.includes(':commit') && (lower.includes('count(') || lower.includes('author') || lower.includes('commitcount'))) {
    const authorMap = {};
    for (const c of allCommits) {
      const author = c.author || 'Auto-Jira Agent';
      if (!authorMap[author]) {
        authorMap[author] = { author, commitCount: 0, sampleMessages: [], hashes: [] };
      }
      authorMap[author].commitCount += 1;
      if (authorMap[author].sampleMessages.length < 4) {
        authorMap[author].sampleMessages.push(c.message);
      }
      if (authorMap[author].hashes.length < 4) {
        authorMap[author].hashes.push(c.hash);
      }
    }
    return Object.values(authorMap).sort((a, b) => b.commitCount - a.commitCount);
  }

  // Query 2: Commit list
  if (lower.includes(':commit') && !lower.includes('references')) {
    return allCommits.slice(0, 20).map(c => ({
      hash: c.hash,
      author: c.author,
      message: c.message,
      createdAt: c.createdAt,
      linkedIssueKey: c.linkedIssueKey
    }));
  }

  // Query 3: Commit linked to Issue
  if (lower.includes(':commit') && lower.includes(':issue')) {
    const joined = [];
    for (const c of allCommits) {
      const issueKey = c.linkedIssueKey;
      const matchedIssue = allIssues.find(i => i.key === issueKey || (i.id && i.id.toLowerCase() === (issueKey || '').toLowerCase()));
      joined.push({
        commitHash: c.hash,
        author: c.author,
        commitMessage: c.message,
        issueKey: issueKey || (matchedIssue ? matchedIssue.key : 'N/A'),
        issueTitle: matchedIssue ? matchedIssue.title : 'General Repository Improvement'
      });
    }
    return joined;
  }

  // Query 4: PullRequest linked to Issue
  if (lower.includes(':pullrequest') && lower.includes(':issue')) {
    return allPRs.map(p => {
      const matchedIssue = allIssues.find(i => i.key === p.linkedIssueKey || i.id === p.linkedIssueKey);
      return {
        prNumber: p.number,
        prTitle: p.title,
        prStatus: p.status,
        prAuthor: p.author,
        issueKey: p.linkedIssueKey,
        issueTitle: matchedIssue ? matchedIssue.title : 'Feature Implementation'
      };
    });
  }

  // Query 5: PullRequests alone
  if (lower.includes(':pullrequest')) {
    return allPRs.map(p => ({
      number: p.number,
      title: p.title,
      status: p.status,
      branch: p.branch,
      author: p.author,
      linkedIssueKey: p.linkedIssueKey
    }));
  }

  // Query 6: Knowledge Base Docs
  if (lower.includes(':doc')) {
    return allDocs.map(d => ({
      key: d.key,
      title: d.title,
      category: d.category,
      author: d.author,
      summary: d.summary
    }));
  }

  // Query 7: Issues blocked / dependencies
  if (lower.includes(':blocks') || lower.includes('blocks')) {
    const blockRels = allRels.filter(r => r.type === 'BLOCKS');
    return blockRels.map(r => {
      const blocker = allIssues.find(i => i.id === r.sourceId) || { key: r.sourceKey || r.sourceId, title: r.sourceTitle };
      const blocked = allIssues.find(i => i.id === r.targetId) || { key: r.targetKey || r.targetId, title: r.targetTitle };
      return {
        blockerKey: blocker.key,
        blockerTitle: blocker.title,
        blockedKey: blocked.key,
        blockedTitle: blocked.title
      };
    });
  }

  // Query 8: General Issues
  if (lower.includes(':issue')) {
    let list = allIssues;
    if (lower.includes('in_progress')) {
      list = list.filter(i => i.status === 'IN_PROGRESS');
    } else if (lower.includes('done')) {
      list = list.filter(i => i.status === 'DONE');
    } else if (lower.includes('todo')) {
      list = list.filter(i => i.status === 'TODO');
    }
    return list.map(i => ({
      key: i.key,
      title: i.title,
      status: i.status,
      priority: i.priority,
      assignee: i.assignee,
      storyPoints: i.storyPoints
    }));
  }

  // Fallback: return combined summary
  return [
    { entityType: 'Commits', count: allCommits.length },
    { entityType: 'Issues', count: allIssues.length },
    { entityType: 'Knowledge Docs', count: allDocs.length },
    { entityType: 'Pull Requests', count: allPRs.length },
    { entityType: 'Relationships', count: allRels.length }
  ];
}

// Rule-based heuristic Text-to-Cypher generator when LLM is unavailable or offline
function heuristicTextToCypher(userPrompt) {
  const p = userPrompt.toLowerCase();

  // Commit queries: "how many recent commits where there and ny whom", "commits by whom", "who committed"
  if (p.includes('commit') || p.includes('whom') || p.includes('who pushed') || p.includes('git log')) {
    return {
      cypher: 'MATCH (c:Commit)\nRETURN c.author AS author, count(c) AS commitCount, collect(c.message)[0..4] AS sampleMessages\nORDER BY commitCount DESC',
      explanation: 'Matches all Commit nodes in the Knowledge Graph, groups by author, computes the total commit count per team member, and collects recent commit messages in descending order.'
    };
  }

  // In-progress or specific status issues
  if (p.includes('in progress') || p.includes('working on')) {
    return {
      cypher: "MATCH (i:Issue)\nWHERE i.status = 'IN_PROGRESS'\nRETURN i.key AS key, i.title AS title, i.priority AS priority, i.assignee AS assignee\nORDER BY i.key ASC",
      explanation: 'Filters Issue nodes whose status is IN_PROGRESS to identify active workload and assigned engineers.'
    };
  }

  // Pull requests
  if (p.includes('pull request') || p.includes('pr') || p.includes('branch')) {
    return {
      cypher: 'MATCH (p:PullRequest)\nRETURN p.number AS prNumber, p.title AS title, p.status AS status, p.branch AS branch, p.author AS author, p.linkedIssueKey AS linkedIssueKey\nORDER BY p.number DESC',
      explanation: 'Queries PullRequest nodes to inspect open and merged PRs, active branch names, and their linked Jira issues.'
    };
  }

  // Knowledge base / docs
  if (p.includes('doc') || p.includes('knowledge') || p.includes('architecture') || p.includes('blueprint') || p.includes('prd')) {
    return {
      cypher: 'MATCH (d:Doc)\nRETURN d.key AS key, d.title AS title, d.category AS category, d.author AS author, d.summary AS summary\nORDER BY d.key ASC',
      explanation: 'Retrieves all Doc nodes from the Knowledge Base, including system architecture and functional specifications.'
    };
  }

  // Dependencies / blocking issues
  if (p.includes('block') || p.includes('depend') || p.includes('bottleneck')) {
    return {
      cypher: 'MATCH (a:Issue)-[:BLOCKS]->(b:Issue)\nRETURN a.key AS blockerKey, a.title AS blockerTitle, b.key AS blockedKey, b.title AS blockedTitle',
      explanation: 'Inspects the directed -[:BLOCKS]-> graph relationships between Jira tickets to uncover workflow blockers.'
    };
  }

  // Default: General issues
  return {
    cypher: 'MATCH (i:Issue)\nRETURN i.key AS key, i.title AS title, i.status AS status, i.priority AS priority, i.assignee AS assignee\nORDER BY i.key ASC LIMIT 15',
    explanation: 'Scans the Jira Issue nodes in the Knowledge Graph and returns ticket keys, titles, priorities, and assigned team members.'
  };
}

// Rule-based answer synthesizer for immediate and accurate responses
function synthesizeAnswerDeterministic(userPrompt, cypherQuery, records) {
  const p = userPrompt.toLowerCase();

  // Commit breakdown response
  if (p.includes('commit') || p.includes('whom') || cypherQuery.toLowerCase().includes(':commit')) {
    const totalCommits = records.reduce((acc, r) => acc + (Number(r.commitCount) || 1), 0);
    const authorList = records.map(r => {
      const count = r.commitCount || 1;
      const author = r.author || 'Team Member';
      const msgs = Array.isArray(r.sampleMessages) && r.sampleMessages.length > 0
        ? ` (e.g. *"${r.sampleMessages[0]}"*)`
        : '';
      return `- **${author}**: **${count}** commit${count > 1 ? 's' : ''}${msgs}`;
    }).join('\n');

    return `### 📊 Commit Activity Summary\n\nThere are **${totalCommits} recent commits** recorded in the repository graph.\n\n**Breakdown by Author:**\n${authorList}\n\n*All commits are connected to Jira tickets in the graph via the \`-[:REFERENCES]->\` relationship.*`;
  }

  // Issue response
  if (cypherQuery.toLowerCase().includes(':issue')) {
    const count = records.length;
    const items = records.slice(0, 8).map(r => 
      `- **${r.key || r.issueKey || 'Ticket'}**: ${r.title || r.issueTitle || 'Untitled'} (${r.status || 'Active'} • Priority: ${r.priority || 'Medium'} • Assignee: ${r.assignee || 'Unassigned'})`
    ).join('\n');

    return `### 📋 Jira Issues Found (${count} records)\n\n${items}${records.length > 8 ? `\n- *...and ${records.length - 8} more issues*` : ''}`;
  }

  // Pull request response
  if (cypherQuery.toLowerCase().includes(':pullrequest')) {
    const count = records.length;
    const items = records.map(r => 
      `- **PR #${r.prNumber || r.number}**: ${r.title || r.prTitle} [**${r.status || r.prStatus}**] by *${r.author || r.prAuthor}* (Linked: \`${r.linkedIssueKey || 'None'}\`)`
    ).join('\n');

    return `### 🔀 Pull Requests (${count} records)\n\n${items}`;
  }

  // Documentation response
  if (cypherQuery.toLowerCase().includes(':doc')) {
    const items = records.map(r => 
      `- **${r.key}**: **${r.title}** (*${r.category}* by ${r.author})\n  > ${r.summary}`
    ).join('\n');

    return `### 📚 Knowledge Base Documents\n\n${items}`;
  }

  return `### 🔍 Graph Query Results\n\nRetrieved **${records.length} records** matching your query. Check the data table below for details.`;
}

// Master Natural Language -> Cypher -> Execution -> Synthesized Answer pipeline
export async function processGraphChat({ prompt, history = [] }) {
  const currentConfig = getLLMConfig();
  const activeProvider = currentConfig.active_provider;
  let cypherQuery = '';
  let cypherExplanation = '';
  let modelUsed = activeProvider === 'azure' ? `Azure OpenAI (${currentConfig.azure.deployment})` : `Google Gemini (${currentConfig.gemini.model})`;

  // Step 1: Text-to-Cypher generation via LLM if available
  const systemPrompt = `You are an expert Neo4j Graph Database and Cypher Engineer for an engineering team using Jira and Git.
Convert the user's natural language question into a valid, optimized Cypher query for Neo4j.

Graph Schema:
- Node labels:
  - Commit { id, hash, author, message, createdAt, linkedIssueKey }
  - Issue { id, key, title, description, status, priority, type, assignee, storyPoints, createdAt, updatedAt }
  - Doc { id, key, title, category, author, summary, content, createdAt }
  - PullRequest { id, number, title, status, branch, author, linkedIssueKey, createdAt }
- Relationships:
  - (:Commit)-[:REFERENCES]->(:Issue)
  - (:PullRequest)-[:RESOLVES]->(:Issue)
  - (:Issue)-[:BLOCKS]->(:Issue)
  - (:Issue)-[:DEPENDS_ON]->(:Issue)
  - (:Issue)-[:RELATES_TO]->(:Issue)
  - (:Issue)-[:DOCUMENTED_IN]->(:Doc)

Rules:
1. Always return a valid Cypher statement.
2. Output JSON strictly with keys: "cypher" (string) and "explanation" (string).
3. Do NOT use markdown backticks in the json values.`;

  try {
    const llmResult = await callActiveLLM({
      systemPrompt,
      userPrompt: `Generate a Cypher query for this question: "${prompt}"`,
      jsonMode: true
    });

    if (llmResult && llmResult.content) {
      let cleaned = llmResult.content.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      const parsed = JSON.parse(cleaned);
      if (parsed.cypher) {
        cypherQuery = parsed.cypher;
        cypherExplanation = parsed.explanation || 'Cypher query generated by AI model';
        modelUsed = llmResult.model;
      }
    }
  } catch (err) {
    console.warn('[CypherEngine] LLM Text-to-Cypher warning:', err.message);
  }

  // Fallback to deterministic heuristic if LLM did not generate
  if (!cypherQuery) {
    const fallback = heuristicTextToCypher(prompt);
    cypherQuery = fallback.cypher;
    cypherExplanation = fallback.explanation;
    modelUsed = 'Heuristic Graph Engine (Offline Fallback)';
  }

  // Step 2: Execute the Cypher query
  const executionResult = await executeCypher(cypherQuery);

  // Step 3: Synthesize conversational answer
  let answer = '';
  try {
    const answerPrompt = `User Question: "${prompt}"
Executed Cypher: ${cypherQuery}
Query Records (${executionResult.records.length} items):
${JSON.stringify(executionResult.records.slice(0, 15), null, 2)}

Provide a clear, engaging, conversational answer in GitHub markdown format.
Use bullet points, bold key figures (counts, authors, ticket keys), and summarize insights cleanly.`;

    const answerLlmResult = await callActiveLLM({
      systemPrompt: 'You are an intelligent engineering assistant analyzing a Jira and Git Knowledge Graph. Answer the user question accurately using the provided graph records.',
      userPrompt: answerPrompt,
      jsonMode: false
    });

    if (answerLlmResult && answerLlmResult.content) {
      answer = answerLlmResult.content.trim();
    }
  } catch (err) {
    console.warn('[CypherEngine] LLM Answer Synthesis warning:', err.message);
  }

  // Fallback answer synthesis if LLM was offline
  if (!answer) {
    answer = synthesizeAnswerDeterministic(prompt, cypherQuery, executionResult.records);
  }

  return {
    prompt,
    cypher: cypherQuery,
    explanation: cypherExplanation,
    answer,
    records: executionResult.records,
    recordCount: executionResult.count,
    executionTimeMs: executionResult.executionTimeMs,
    dataSource: executionResult.source,
    modelUsed
  };
}
