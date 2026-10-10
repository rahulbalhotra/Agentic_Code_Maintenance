import React, { useState, useEffect, useRef } from 'react';
import { 
  GitFork, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Link2, 
  Info,
  Maximize2
} from 'lucide-react';

const STATUS_COLORS = {
  BACKLOG: '#64748b',
  TODO: '#0284c7',
  IN_PROGRESS: '#2563eb',
  REVIEW: '#7c3aed',
  DONE: '#059669'
};

const REL_COLORS = {
  BLOCKS: '#dc2626',
  DEPENDS_ON: '#ea580c',
  RELATES_TO: '#2563eb',
  SUBTASK_OF: '#9333ea',
  DUPLICATES: '#475569',
  DOCUMENTED_IN: '#8b5cf6',
  RESOLVES: '#10b981',
  REFERENCES: '#f59e0b'
};

export default function GraphVisualizer({
  issues = [],
  connections = [],
  onSelectIssue,
  onOpenConnectModal
}) {
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [nodePositions, setNodePositions] = useState({});
  const [draggingNode, setDraggingNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Initialize node layout circularly or in columns
  useEffect(() => {
    if (!issues || issues.length === 0) return;

    const width = 800;
    const height = 450;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.36;

    const newPositions = {};
    issues.forEach((issue, index) => {
      // Retain existing position if dragged before
      if (nodePositions[issue.id]) {
        newPositions[issue.id] = nodePositions[issue.id];
      } else {
        const angle = (index / issues.length) * 2 * Math.PI;
        newPositions[issue.id] = {
          x: centerX + radius * Math.cos(angle) + (Math.random() * 20 - 10),
          y: centerY + radius * Math.sin(angle) + (Math.random() * 20 - 10)
        };
      }
    });

    setNodePositions(newPositions);
  }, [issues.length]);

  const handleMouseDownNode = (e, issueId) => {
    e.stopPropagation();
    setSelectedNodeId(issueId);
    const rect = containerRef.current.getBoundingClientRect();
    const currentPos = nodePositions[issueId] || { x: 200, y: 200 };
    setDraggingNode(issueId);
    setDragOffset({
      x: (e.clientX - rect.left) / zoom - currentPos.x,
      y: (e.clientY - rect.top) / zoom - currentPos.y
    });
  };

  const handleMouseMove = (e) => {
    if (!draggingNode || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newX = (e.clientX - rect.left) / zoom - dragOffset.x;
    const newY = (e.clientY - rect.top) / zoom - dragOffset.y;

    setNodePositions(prev => ({
      ...prev,
      [draggingNode]: {
        x: Math.max(50, Math.min(850, newX)),
        y: Math.max(50, Math.min(480, newY))
      }
    }));
  };

  const handleMouseUp = () => {
    setDraggingNode(null);
  };

  const selectedNode = issues.find(i => i.id === selectedNodeId);

  return (
    <div className="graph-view-container" id="graph-visualizer-container">
      <div className="graph-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GitFork size={18} style={{ color: '#0052cc' }} />
          <strong style={{ color: '#0b2545', fontSize: '0.95rem' }}>
            Neo4j Interactive Graph Explorer
          </strong>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            ({issues.length} nodes, {connections.length} edges)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn-secondary"
            style={{ padding: '5px 10px', fontSize: '0.8rem' }}
            onClick={() => setZoom(z => Math.min(1.8, z + 0.15))}
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            className="btn-secondary"
            style={{ padding: '5px 10px', fontSize: '0.8rem' }}
            onClick={() => setZoom(z => Math.max(0.6, z - 0.15))}
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            className="btn-secondary"
            style={{ padding: '5px 10px', fontSize: '0.8rem' }}
            onClick={() => setZoom(1)}
            title="Reset Zoom"
          >
            <RotateCcw size={14} />
          </button>
          <button
            className="btn-dark-blue"
            style={{ padding: '5px 12px', fontSize: '0.8rem' }}
            onClick={onOpenConnectModal}
            id="btn-graph-connect"
          >
            <Link2 size={14} />
            Connect Nodes
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div
        ref={containerRef}
        className="graph-canvas-area"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={() => setSelectedNodeId(null)}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 900 520"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            transition: draggingNode ? 'none' : 'transform 0.15s ease'
          }}
        >
          <defs>
            {/* Arrow markers for each relationship type */}
            {Object.entries(REL_COLORS).map(([type, color]) => (
              <marker
                key={type}
                id={`arrow-${type}`}
                viewBox="0 0 10 10"
                refX="26"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
              </marker>
            ))}
          </defs>

          {/* Render Relationships (Edges) */}
          {connections.map((rel, idx) => {
            const sourcePos = nodePositions[rel.sourceId];
            const targetPos = nodePositions[rel.targetId];
            if (!sourcePos || !targetPos) return null;

            const isHighlighted =
              selectedNodeId &&
              (selectedNodeId === rel.sourceId || selectedNodeId === rel.targetId);

            const color = REL_COLORS[rel.type] || '#2563eb';
            const midX = (sourcePos.x + targetPos.x) / 2;
            const midY = (sourcePos.y + targetPos.y) / 2;

            return (
              <g key={`edge-${idx}`}>
                <line
                  x1={sourcePos.x}
                  y1={sourcePos.y}
                  x2={targetPos.x}
                  y2={targetPos.y}
                  stroke={color}
                  strokeWidth={isHighlighted ? 3 : 1.8}
                  strokeDasharray={rel.type === 'RELATES_TO' ? '4 4' : 'none'}
                  markerEnd={`url(#arrow-${rel.type})`}
                  opacity={selectedNodeId ? (isHighlighted ? 1 : 0.25) : 0.85}
                />
                {/* Edge Label Badge */}
                <rect
                  x={midX - 35}
                  y={midY - 10}
                  width="70"
                  height="18"
                  rx="4"
                  fill="#ffffff"
                  stroke={color}
                  strokeWidth="1"
                  opacity={selectedNodeId ? (isHighlighted ? 1 : 0.2) : 0.9}
                />
                <text
                  x={midX}
                  y={midY + 2}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="700"
                  fill={color}
                  opacity={selectedNodeId ? (isHighlighted ? 1 : 0.2) : 1}
                >
                  {rel.type}
                </text>
              </g>
            );
          })}

          {/* Render Nodes */}
          {issues.map(issue => {
            const pos = nodePositions[issue.id] || { x: 100, y: 100 };
            const isSelected = selectedNodeId === issue.id;
            const nodeColor = issue.nodeLabel === 'Doc'
              ? '#8b5cf6'
              : issue.nodeLabel === 'PullRequest'
              ? '#10b981'
              : issue.nodeLabel === 'Commit'
              ? '#f59e0b'
              : (STATUS_COLORS[issue.status] || '#0052cc');

            return (
              <g
                key={issue.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseDown={(e) => handleMouseDownNode(e, issue.id)}
                style={{ cursor: 'grab' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(issue.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onSelectIssue(issue);
                }}
              >
                {/* Node Outer Halo on select */}
                {isSelected && (
                  <circle
                    r="34"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    strokeDasharray="4 2"
                    opacity="0.9"
                  />
                )}

                {/* Node Body */}
                <circle
                  r="24"
                  fill="#ffffff"
                  stroke={nodeColor}
                  strokeWidth={isSelected ? '3.5' : '2.5'}
                  filter="drop-shadow(0 2px 5px rgba(11,37,69,0.18))"
                />

                {/* Status Dot / Center */}
                <circle
                  r="6"
                  cy="-7"
                  fill={nodeColor}
                />

                {/* Key text inside node */}
                <text
                  y="8"
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill="#0b2545"
                >
                  {issue.key || issue.hash || (issue.id ? issue.id.substring(0, 7) : '')}
                </text>

                {/* Title badge below node */}
                <rect
                  x="-65"
                  y="30"
                  width="130"
                  height="18"
                  rx="4"
                  fill="rgba(15, 23, 42, 0.85)"
                />
                <text
                  y="42"
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="500"
                  fill="#ffffff"
                >
                  {(() => {
                    const text = issue.title || issue.message || issue.name || issue.key || issue.id || '';
                    return text.length > 20 ? text.substring(0, 18) + '...' : text;
                  })()}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected Node Inspector Overlay */}
        {selectedNode && (
          <div style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            background: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            padding: '12px',
            boxShadow: '0 4px 12px rgba(11,37,69,0.15)',
            width: '280px',
            fontSize: '0.8rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: '#0b2545' }}>{selectedNode.key || selectedNode.hash || selectedNode.id}</strong>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                background: '#f1f5f9',
                color: '#475569'
              }}>
                {selectedNode.nodeLabel || selectedNode.status || 'Node'}
              </span>
            </div>
            <div style={{ fontWeight: 600, color: '#334155' }}>
              {selectedNode.title || selectedNode.message || selectedNode.name || 'Untitled'}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.74rem' }}>
              Type: {selectedNode.type || selectedNode.nodeLabel} &bull; Priority: {selectedNode.priority || 'N/A'}
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <button
                className="btn-dark-blue"
                style={{ padding: '4px 8px', fontSize: '0.75rem', flex: 1 }}
                onClick={() => onSelectIssue(selectedNode)}
              >
                Inspect Node
              </button>
              <button
                className="btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem', flex: 1 }}
                onClick={() => onSelectIssue(selectedNode, 'connections')}
              >
                Manage Edges
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Live Cypher Bar */}
      <div className="cypher-bar" id="cypher-preview-bar">
        <span>
          MATCH (a:Issue)-[r]-&gt;(b:Issue) RETURN a, r, b
        </span>
        <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
          Live Cypher Query executing in local Neo4j Desktop
        </span>
      </div>
    </div>
  );
}
