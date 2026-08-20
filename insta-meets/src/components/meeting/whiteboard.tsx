"use client"

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  Edge,
  Node,
  Handle,
  Position,
  BackgroundVariant,
  NodeProps,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  StickyNote,
  Square,
  Circle,
  Diamond,
  Triangle,
  Hexagon,
  Database,
  Cloud,
  CheckSquare,
  MessageCircle,
  Layers,
  Type,
  Trash2,
  Undo2,
  Redo2,
  X,
  Sparkles,
  GripVertical,
  Minimize2,
  Maximize2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// -------------------------------------------------------------
// Base Delete Button Wrapper for All Nodes
// -------------------------------------------------------------
function NodeDeleteButton({ nodeId, onDelete }: { nodeId: string; onDelete?: (id: string) => void }) {
  if (!onDelete) return null
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onDelete(nodeId)
      }}
      className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-destructive text-destructive-foreground shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all z-30 cursor-pointer border border-white/20"
      title="Delete Node"
    >
      <X className="w-3.5 h-3.5 stroke-[2.5]" />
    </button>
  )
}

// -------------------------------------------------------------
// Custom Node Components (Pure & Stable)
// -------------------------------------------------------------

// 1. Sticky Note Node
const StickyNoteNode = React.memo(({ id, data, selected }: NodeProps) => {
  const color = (data?.color as string) || "#FEF08A"
  const label = (data?.label as string) || ""

  return (
    <div
      className={cn(
        "group relative p-4 rounded-2xl shadow-xl border transition-all duration-150 min-w-[200px] min-h-[150px] flex flex-col select-none",
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.02]" : "hover:shadow-2xl"
      )}
      style={{ backgroundColor: color, borderColor: `${color}cc`, color: "#0F172A" }}
    >
      <NodeDeleteButton nodeId={id} onDelete={data?.onDelete as any} />

      <Handle type="target" position={Position.Top} className="!w-3.5 !h-3.5 !bg-slate-800 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-3.5 !h-3.5 !bg-slate-800 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="!w-3.5 !h-3.5 !bg-slate-800 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-3.5 !h-3.5 !bg-slate-800 !border-2 !border-white" />

      <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-black/10 text-xs font-bold opacity-75">
        <span className="flex items-center gap-1.5">
          <StickyNote className="w-3.5 h-3.5" />
          <span>Note</span>
        </span>
        <span className="text-[10px] opacity-70">{(data?.author as string) || "Participant"}</span>
      </div>

      <textarea
        defaultValue={label}
        onBlur={(e) => {
          if (data?.onUpdate) (data.onUpdate as any)(id, e.target.value)
        }}
        className="flex-1 w-full bg-transparent resize-none outline-none font-medium text-sm leading-snug"
        placeholder="Write your note..."
      />
    </div>
  )
})
StickyNoteNode.displayName = "StickyNoteNode"

// 2. Process / Rectangle Node
const ProcessNode = React.memo(({ id, data, selected }: NodeProps) => {
  const color = (data?.color as string) || "#3B82F6"
  const label = (data?.label as string) || "Process Step"

  return (
    <div
      className={cn(
        "group relative px-4 py-3 rounded-2xl bg-background/95 backdrop-blur-md border-2 shadow-xl min-w-[210px] transition-all select-none",
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.02]" : "hover:shadow-2xl"
      )}
      style={{ borderColor: color }}
    >
      <NodeDeleteButton nodeId={id} onDelete={data?.onDelete as any} />

      <Handle type="target" position={Position.Top} className="!w-3.5 !h-3.5 !bg-primary !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-3.5 !h-3.5 !bg-primary !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="!w-3.5 !h-3.5 !bg-primary !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-3.5 !h-3.5 !bg-primary !border-2 !border-white" />

      <div className="flex items-center gap-2 mb-1">
        <Square className="w-4 h-4" style={{ color }} />
        <input
          defaultValue={label}
          onBlur={(e) => {
            if (data?.onUpdate) (data.onUpdate as any)(id, e.target.value)
          }}
          className="bg-transparent font-bold text-sm text-foreground outline-none w-full"
        />
      </div>
      <p className="text-xs text-muted-foreground">Action / Component Step</p>
    </div>
  )
})
ProcessNode.displayName = "ProcessNode"

// 3. Circle / Concept Node
const CircleNode = React.memo(({ id, data, selected }: NodeProps) => {
  const color = (data?.color as string) || "#8B5CF6"
  const label = (data?.label as string) || "Concept"

  return (
    <div
      className={cn(
        "group relative w-36 h-36 rounded-full bg-purple-500/15 backdrop-blur-md border-2 shadow-xl flex flex-col items-center justify-center p-3 text-center transition-all select-none",
        selected ? "ring-2 ring-purple-400 ring-offset-2 ring-offset-background scale-[1.02]" : "hover:shadow-2xl"
      )}
      style={{ borderColor: color }}
    >
      <NodeDeleteButton nodeId={id} onDelete={data?.onDelete as any} />

      <Handle type="target" position={Position.Top} className="!w-3.5 !h-3.5 !bg-purple-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-3.5 !h-3.5 !bg-purple-500 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="!w-3.5 !h-3.5 !bg-purple-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-3.5 !h-3.5 !bg-purple-500 !border-2 !border-white" />

      <Circle className="w-4 h-4 text-purple-400 mb-1" />
      <input
        defaultValue={label}
        onBlur={(e) => {
          if (data?.onUpdate) (data.onUpdate as any)(id, e.target.value)
        }}
        className="bg-transparent font-bold text-xs text-foreground text-center outline-none w-28"
      />
    </div>
  )
})
CircleNode.displayName = "CircleNode"

// 4. Decision Diamond Node
const DecisionNode = React.memo(({ id, data, selected }: NodeProps) => {
  const label = (data?.label as string) || "Condition?"

  return (
    <div
      className={cn(
        "group relative w-36 h-36 bg-amber-500/20 backdrop-blur-md border-2 border-amber-500 shadow-xl rounded-2xl flex items-center justify-center p-3 text-center transform rotate-45 transition-all select-none",
        selected ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-background scale-[1.02]" : "hover:shadow-2xl"
      )}
    >
      <NodeDeleteButton nodeId={id} onDelete={data?.onDelete as any} />

      <Handle type="target" position={Position.Top} className="!w-3.5 !h-3.5 !bg-amber-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-3.5 !h-3.5 !bg-amber-500 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="!w-3.5 !h-3.5 !bg-amber-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-3.5 !h-3.5 !bg-amber-500 !border-2 !border-white" />

      <div className="transform -rotate-45 flex flex-col items-center justify-center">
        <Diamond className="w-4 h-4 text-amber-500 mb-1" />
        <input
          defaultValue={label}
          onBlur={(e) => {
            if (data?.onUpdate) (data.onUpdate as any)(id, e.target.value)
          }}
          className="bg-transparent font-bold text-xs text-foreground text-center outline-none w-24"
        />
      </div>
    </div>
  )
})
DecisionNode.displayName = "DecisionNode"

// 5. Triangle / Warning Node
const TriangleNode = React.memo(({ id, data, selected }: NodeProps) => {
  const label = (data?.label as string) || "Priority / Alert"

  return (
    <div
      className={cn(
        "group relative px-4 py-3 bg-red-500/15 backdrop-blur-md border-2 border-red-500 shadow-xl rounded-2xl min-w-[190px] flex items-center gap-3 transition-all select-none",
        selected ? "ring-2 ring-red-400 ring-offset-2 ring-offset-background scale-[1.02]" : "hover:shadow-2xl"
      )}
    >
      <NodeDeleteButton nodeId={id} onDelete={data?.onDelete as any} />

      <Handle type="target" position={Position.Top} className="!w-3.5 !h-3.5 !bg-red-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-3.5 !h-3.5 !bg-red-500 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="!w-3.5 !h-3.5 !bg-red-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-3.5 !h-3.5 !bg-red-500 !border-2 !border-white" />

      <Triangle className="w-5 h-5 text-red-500 flex-shrink-0" />
      <div className="flex flex-col w-full">
        <input
          defaultValue={label}
          onBlur={(e) => {
            if (data?.onUpdate) (data.onUpdate as any)(id, e.target.value)
          }}
          className="bg-transparent font-bold text-sm text-foreground outline-none w-full"
        />
        <span className="text-[10px] text-red-400 font-medium">Critical Gate</span>
      </div>
    </div>
  )
})
TriangleNode.displayName = "TriangleNode"

// 6. Hexagon / Milestone Node
const HexagonNode = React.memo(({ id, data, selected }: NodeProps) => {
  const label = (data?.label as string) || "Milestone 1.0"

  return (
    <div
      className={cn(
        "group relative px-4 py-3 bg-pink-500/15 backdrop-blur-md border-2 border-pink-500 shadow-xl rounded-2xl min-w-[190px] flex items-center gap-3 transition-all select-none",
        selected ? "ring-2 ring-pink-400 ring-offset-2 ring-offset-background scale-[1.02]" : "hover:shadow-2xl"
      )}
    >
      <NodeDeleteButton nodeId={id} onDelete={data?.onDelete as any} />

      <Handle type="target" position={Position.Top} className="!w-3.5 !h-3.5 !bg-pink-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-3.5 !h-3.5 !bg-pink-500 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="!w-3.5 !h-3.5 !bg-pink-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-3.5 !h-3.5 !bg-pink-500 !border-2 !border-white" />

      <Hexagon className="w-5 h-5 text-pink-500 flex-shrink-0" />
      <div className="flex flex-col w-full">
        <input
          defaultValue={label}
          onBlur={(e) => {
            if (data?.onUpdate) (data.onUpdate as any)(id, e.target.value)
          }}
          className="bg-transparent font-bold text-sm text-foreground outline-none w-full"
        />
        <span className="text-[10px] text-pink-400 font-medium">Sprint Goal</span>
      </div>
    </div>
  )
})
HexagonNode.displayName = "HexagonNode"

// 7. Database Node
const DatabaseNode = React.memo(({ id, data, selected }: NodeProps) => {
  const label = (data?.label as string) || "PostgreSQL DB"

  return (
    <div
      className={cn(
        "group relative px-4 py-3 rounded-2xl bg-emerald-500/15 backdrop-blur-md border-2 border-emerald-500 shadow-xl min-w-[190px] flex items-center gap-3 transition-all select-none",
        selected ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-background scale-[1.02]" : "hover:shadow-2xl"
      )}
    >
      <NodeDeleteButton nodeId={id} onDelete={data?.onDelete as any} />

      <Handle type="target" position={Position.Top} className="!w-3.5 !h-3.5 !bg-emerald-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-3.5 !h-3.5 !bg-emerald-500 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="!w-3.5 !h-3.5 !bg-emerald-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-3.5 !h-3.5 !bg-emerald-500 !border-2 !border-white" />

      <Database className="w-6 h-6 text-emerald-500 flex-shrink-0" />
      <div className="flex flex-col">
        <input
          defaultValue={label}
          onBlur={(e) => {
            if (data?.onUpdate) (data.onUpdate as any)(id, e.target.value)
          }}
          className="bg-transparent font-bold text-sm text-foreground outline-none w-full"
        />
        <span className="text-[10px] text-emerald-400 font-medium">Storage Engine</span>
      </div>
    </div>
  )
})
DatabaseNode.displayName = "DatabaseNode"

// 8. Cloud Service Node
const CloudNode = React.memo(({ id, data, selected }: NodeProps) => {
  const label = (data?.label as string) || "Next.js API Gateway"

  return (
    <div
      className={cn(
        "group relative px-4 py-3 rounded-2xl bg-indigo-500/15 backdrop-blur-md border-2 border-indigo-500 shadow-xl min-w-[190px] flex items-center gap-3 transition-all select-none",
        selected ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-background scale-[1.02]" : "hover:shadow-2xl"
      )}
    >
      <NodeDeleteButton nodeId={id} onDelete={data?.onDelete as any} />

      <Handle type="target" position={Position.Top} className="!w-3.5 !h-3.5 !bg-indigo-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-3.5 !h-3.5 !bg-indigo-500 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="!w-3.5 !h-3.5 !bg-indigo-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-3.5 !h-3.5 !bg-indigo-500 !border-2 !border-white" />

      <Cloud className="w-6 h-6 text-indigo-500 flex-shrink-0" />
      <div className="flex flex-col">
        <input
          defaultValue={label}
          onBlur={(e) => {
            if (data?.onUpdate) (data.onUpdate as any)(id, e.target.value)
          }}
          className="bg-transparent font-bold text-sm text-foreground outline-none w-full"
        />
        <span className="text-[10px] text-indigo-400 font-medium">Cloud Service</span>
      </div>
    </div>
  )
})
CloudNode.displayName = "CloudNode"

// 9. Checklist / Task Node
const ChecklistNode = React.memo(({ id, data, selected }: NodeProps) => {
  const label = (data?.label as string) || "Sprint Tasks"
  const [items, setItems] = useState<string[]>([
    "Review system architecture",
    "Run automated test suite",
    "Verify deployment",
  ])

  return (
    <div
      className={cn(
        "group relative p-4 rounded-2xl bg-background/95 backdrop-blur-md border-2 border-teal-500/80 shadow-xl min-w-[240px] flex flex-col transition-all select-none",
        selected ? "ring-2 ring-teal-400 ring-offset-2 ring-offset-background scale-[1.02]" : "hover:shadow-2xl"
      )}
    >
      <NodeDeleteButton nodeId={id} onDelete={data?.onDelete as any} />

      <Handle type="target" position={Position.Top} className="!w-3.5 !h-3.5 !bg-teal-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-3.5 !h-3.5 !bg-teal-500 !border-2 !border-white" />

      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-border">
        <CheckSquare className="w-4 h-4 text-teal-500" />
        <input
          defaultValue={label}
          onBlur={(e) => {
            if (data?.onUpdate) (data.onUpdate as any)(id, e.target.value)
          }}
          className="bg-transparent font-bold text-sm text-foreground outline-none w-full"
        />
      </div>

      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        {items.map((item, idx) => (
          <label key={idx} className="flex items-center gap-2 cursor-pointer hover:text-foreground">
            <input type="checkbox" className="rounded accent-teal-500" />
            <span>{item}</span>
          </label>
        ))}
      </div>
    </div>
  )
})
ChecklistNode.displayName = "ChecklistNode"

// 10. Callout / Speech Bubble Node
const CalloutNode = React.memo(({ id, data, selected }: NodeProps) => {
  const label = (data?.label as string) || "Important highlight!"

  return (
    <div
      className={cn(
        "group relative px-4 py-3 bg-cyan-500/15 backdrop-blur-md border-2 border-cyan-500 shadow-xl rounded-2xl min-w-[190px] flex items-center gap-3 transition-all select-none",
        selected ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-background scale-[1.02]" : "hover:shadow-2xl"
      )}
    >
      <NodeDeleteButton nodeId={id} onDelete={data?.onDelete as any} />

      <Handle type="target" position={Position.Top} className="!w-3.5 !h-3.5 !bg-cyan-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-3.5 !h-3.5 !bg-cyan-500 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="!w-3.5 !h-3.5 !bg-cyan-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-3.5 !h-3.5 !bg-cyan-500 !border-2 !border-white" />

      <MessageCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
      <input
        defaultValue={label}
        onBlur={(e) => {
          if (data?.onUpdate) (data.onUpdate as any)(id, e.target.value)
        }}
        className="bg-transparent font-medium text-sm text-foreground outline-none w-full"
      />
    </div>
  )
})
CalloutNode.displayName = "CalloutNode"

// 11. Section Group Frame Node
const GroupFrameNode = React.memo(({ id, data, selected }: NodeProps) => {
  const label = (data?.label as string) || "System Component Group"

  return (
    <div
      className={cn(
        "group relative w-[420px] h-[280px] rounded-3xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 flex flex-col justify-between transition-all select-none pointer-events-auto",
        selected ? "border-primary ring-2 ring-primary/30" : ""
      )}
    >
      <NodeDeleteButton nodeId={id} onDelete={data?.onDelete as any} />

      <div className="flex items-center gap-2 font-bold text-xs text-primary uppercase tracking-wider">
        <Layers className="w-4 h-4" />
        <input
          defaultValue={label}
          onBlur={(e) => {
            if (data?.onUpdate) (data.onUpdate as any)(id, e.target.value)
          }}
          className="bg-transparent font-bold outline-none w-full text-primary"
        />
      </div>
      <div className="text-[11px] text-muted-foreground text-right">Container Frame</div>
    </div>
  )
})
GroupFrameNode.displayName = "GroupFrameNode"

// 12. Free Text Annotation Node
const TextNode = React.memo(({ id, data, selected }: NodeProps) => {
  const label = (data?.label as string) || "Add text annotation"

  return (
    <div
      className={cn(
        "group relative p-2 bg-transparent select-none min-w-[140px]",
        selected ? "border border-dashed border-primary rounded-lg ring-2 ring-primary/20" : ""
      )}
    >
      <NodeDeleteButton nodeId={id} onDelete={data?.onDelete as any} />

      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
      <input
        defaultValue={label}
        onBlur={(e) => {
          if (data?.onUpdate) (data.onUpdate as any)(id, e.target.value)
        }}
        className="bg-transparent font-bold text-lg text-foreground outline-none w-full"
      />
    </div>
  )
})
TextNode.displayName = "TextNode"

// Static NodeTypes Map (Crucial: prevents React Flow re-mount loops)
const staticNodeTypes = {
  stickyNote: StickyNoteNode,
  process: ProcessNode,
  circle: CircleNode,
  decision: DecisionNode,
  triangle: TriangleNode,
  hexagon: HexagonNode,
  database: DatabaseNode,
  cloud: CloudNode,
  checklist: ChecklistNode,
  callout: CalloutNode,
  groupFrame: GroupFrameNode,
  text: TextNode,
}

// -------------------------------------------------------------
// Live Cursor Presence Type & Palette
// -------------------------------------------------------------

interface RemoteCursor {
  userId: string
  username: string
  x: number
  y: number
  color: string
  lastActive: number
}

const CURSOR_COLORS = [
  "#EF4444", // Red
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
]

function getParticipantColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

// -------------------------------------------------------------
// Whiteboard Main Component
// -------------------------------------------------------------

export interface WhiteboardElement {
  id: string
  type: "nodes_update" | "edges_update" | "clear" | "add_node" | "cursor_move"
  payload: any
  senderId?: string
}

interface WhiteboardProps {
  currentUserId: string
  currentUsername: string
  onSendStroke: (strokeData: any) => void
  onClearBoard: () => void
  onClose: () => void
  incomingStroke?: any
  incomingHistory?: any
  isBoardCleared?: boolean
}

const NOTE_COLORS = [
  "#FEF08A", // Yellow
  "#BAE6FD", // Blue
  "#BBF7D0", // Green
  "#FBCFE8", // Pink
  "#E9D5FF", // Purple
  "#FED7AA", // Orange
]

function WhiteboardInner({
  currentUserId,
  currentUsername,
  onSendStroke,
  onClearBoard,
  onClose,
  incomingStroke,
  incomingHistory,
  isBoardCleared,
}: WhiteboardProps) {
  // Start with completely blank whiteboard
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedNoteColor, setSelectedNoteColor] = useState(NOTE_COLORS[0])
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map())
  const [isMinimized, setIsMinimized] = useState(false)

  // Floating Toolbar Position State (Draggable)
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number }>({ x: 0, y: 16 })
  const isDraggingToolbarRef = useRef(false)
  const dragStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Undo / Redo History Stack
  const historyRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([{ nodes: [], edges: [] }])
  const historyIndexRef = useRef<number>(0)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const lastCursorSendRef = useRef<number>(0)
  const reactFlowInstance = useReactFlow()

  // Helper to push state into Undo/Redo history
  const pushHistory = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1)
    nextHistory.push({ nodes: newNodes, edges: newEdges })
    historyRef.current = nextHistory
    historyIndexRef.current = nextHistory.length - 1
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(false)
  }, [])

  // Node Deletion Handler (passed to all nodes)
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => {
        const nextNodes = nds.filter((n) => n.id !== nodeId)
        setEdges((eds) => {
          const nextEdges = eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
          pushHistory(nextNodes, nextEdges)
          onSendStroke({ type: "nodes_update", payload: nextNodes, senderId: currentUserId })
          onSendStroke({ type: "edges_update", payload: nextEdges, senderId: currentUserId })
          return nextEdges
        })
        return nextNodes
      })
    },
    [currentUserId, onSendStroke, pushHistory]
  )

  // Node Text Update Handler
  const handleUpdateNodeText = useCallback(
    (nodeId: string, text: string) => {
      setNodes((nds) => {
        const nextNodes = nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label: text } } : n))
        pushHistory(nextNodes, edges)
        onSendStroke({ type: "nodes_update", payload: nextNodes, senderId: currentUserId })
        return nextNodes
      })
    },
    [currentUserId, edges, onSendStroke, pushHistory]
  )

  // Bind node callbacks to nodes array
  const preparedNodes = useMemo(() => {
    return nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        onDelete: handleDeleteNode,
        onUpdate: handleUpdateNodeText,
      },
    }))
  }, [nodes, handleDeleteNode, handleUpdateNodeText])

  // Handle Node Changes (Drag / Selection)
  const onNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds))
  }, [])

  // Node Drag Stop (Broadcast final position to network)
  const onNodeDragStop = useCallback(() => {
    pushHistory(nodes, edges)
    onSendStroke({ type: "nodes_update", payload: nodes, senderId: currentUserId })
  }, [nodes, edges, currentUserId, onSendStroke, pushHistory])

  // Handle Edge Changes
  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds))
  }, [])

  // Handle Connections with Arrows
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        id: `e_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        animated: true,
        style: { stroke: "#6366F1", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#6366F1" },
      }
      setEdges((eds) => {
        const updated = addEdge<Edge>(newEdge, eds)
        pushHistory(nodes, updated)
        onSendStroke({ type: "edges_update", payload: updated, senderId: currentUserId })
        return updated
      })
    },
    [nodes, currentUserId, onSendStroke, pushHistory]
  )

  // Undo Handler
  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1
      const state = historyRef.current[historyIndexRef.current]
      setNodes(state.nodes)
      setEdges(state.edges)
      setCanUndo(historyIndexRef.current > 0)
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
      onSendStroke({ type: "nodes_update", payload: state.nodes, senderId: currentUserId })
      onSendStroke({ type: "edges_update", payload: state.edges, senderId: currentUserId })
    }
  }, [currentUserId, onSendStroke])

  // Redo Handler
  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1
      const state = historyRef.current[historyIndexRef.current]
      setNodes(state.nodes)
      setEdges(state.edges)
      setCanUndo(historyIndexRef.current > 0)
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
      onSendStroke({ type: "nodes_update", payload: state.nodes, senderId: currentUserId })
      onSendStroke({ type: "edges_update", payload: state.edges, senderId: currentUserId })
    }
  }, [currentUserId, onSendStroke])

  // Keyboard Shortcuts: Undo (Cmd/Ctrl+Z), Redo (Cmd/Ctrl+Y, Cmd/Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") {
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleUndo, handleRedo])

  // Handle Pointer Movement to Broadcast Live Cursor
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const now = Date.now()
    if (now - lastCursorSendRef.current < 45) return
    lastCursorSendRef.current = now

    const flowPos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY })

    onSendStroke({
      type: "cursor_move",
      payload: {
        userId: currentUserId,
        username: currentUsername || "Participant",
        x: flowPos.x,
        y: flowPos.y,
        color: getParticipantColor(currentUserId || "guest"),
      },
    })
  }

  // Handle Incoming Remote Updates (Nodes, Edges, & Live Cursors)
  useEffect(() => {
    if (!incomingStroke) return

    // Ignore self-echo
    if (incomingStroke.senderId === currentUserId) return

    if (incomingStroke.type === "nodes_update" && Array.isArray(incomingStroke.payload)) {
      setNodes(incomingStroke.payload)
    } else if (incomingStroke.type === "edges_update" && Array.isArray(incomingStroke.payload)) {
      setEdges(incomingStroke.payload)
    } else if (incomingStroke.type === "add_node" && incomingStroke.payload) {
      setNodes((nds) => {
        if (nds.some((n) => n.id === incomingStroke.payload.id)) return nds
        return [...nds, incomingStroke.payload]
      })
    } else if (incomingStroke.type === "cursor_move" && incomingStroke.payload) {
      const { userId: senderId, username: senderName, x, y, color } = incomingStroke.payload
      if (senderId && senderId !== currentUserId) {
        setRemoteCursors((prev) => {
          const next = new Map(prev)
          next.set(senderId, {
            userId: senderId,
            username: senderName,
            x,
            y,
            color: color || getParticipantColor(senderId),
            lastActive: Date.now(),
          })
          return next
        })
      }
    }
  }, [incomingStroke, currentUserId])

  // Inactivity cleanup for remote cursors (> 6 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setRemoteCursors((prev) => {
        let changed = false
        const next = new Map(prev)
        for (const [id, cursor] of next.entries()) {
          if (now - cursor.lastActive > 6000) {
            next.delete(id)
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  // Handle Remote History
  useEffect(() => {
    if (incomingHistory && Array.isArray(incomingHistory) && incomingHistory.length > 0) {
      const last = incomingHistory[incomingHistory.length - 1]
      if (last?.nodes) setNodes(last.nodes)
      if (last?.edges) setEdges(last.edges)
    }
  }, [incomingHistory])

  // Handle Board Cleared
  useEffect(() => {
    if (isBoardCleared) {
      setNodes([])
      setEdges([])
      historyRef.current = [{ nodes: [], edges: [] }]
      historyIndexRef.current = 0
      setCanUndo(false)
      setCanRedo(false)
    }
  }, [isBoardCleared])

  // Helper: Add Node to Center of Viewport
  const addNodeToCanvas = (type: string, dataConfig: any) => {
    const id = `node_${currentUserId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const { x, y, zoom } = reactFlowInstance.getViewport()

    const position = {
      x: -x / zoom + 220 + Math.random() * 60,
      y: -y / zoom + 160 + Math.random() * 60,
    }

    const newNode: Node = {
      id,
      type,
      position,
      data: {
        ...dataConfig,
        author: currentUsername,
      },
    }

    setNodes((nds) => {
      const next = [...nds, newNode]
      pushHistory(next, edges)
      onSendStroke({ type: "nodes_update", payload: next, senderId: currentUserId })
      return next
    })
  }

  // Clear Canvas
  const handleClear = () => {
    if (confirm("Are you sure you want to clear the entire whiteboard for all participants?")) {
      setNodes([])
      setEdges([])
      pushHistory([], [])
      onClearBoard()
    }
  }

  // Draggable Toolbar Event Listeners
  const startDragToolbar = (e: React.PointerEvent) => {
    isDraggingToolbarRef.current = true
    dragStartOffsetRef.current = {
      x: e.clientX - toolbarPos.x,
      y: e.clientY - toolbarPos.y,
    }
  }

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (isDraggingToolbarRef.current) {
        setToolbarPos({
          x: e.clientX - dragStartOffsetRef.current.x,
          y: Math.max(10, e.clientY - dragStartOffsetRef.current.y),
        })
      }
    }
    const onPointerUp = () => {
      isDraggingToolbarRef.current = false
    }
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
    }
  }, [toolbarPos])

  const cursorList = Array.from(remoteCursors.values())

  return (
    <div
      className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none"
      onPointerMove={handlePointerMove}
    >
      {/* 1. Movable & Minimizable Floating Glass Toolbar */}
      <header
        className="absolute z-20 flex items-center gap-2 p-2 rounded-2xl bg-background/90 backdrop-blur-2xl border border-border shadow-2xl transition-all"
        style={{
          left: `calc(50% + ${toolbarPos.x}px)`,
          top: `${toolbarPos.y}px`,
          transform: "translateX(-50%)",
        }}
      >
        {/* Drag Handle */}
        <div
          onPointerDown={startDragToolbar}
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          title="Drag to reposition toolbar"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Minimized Pill View */}
        {isMinimized ? (
          <div className="flex items-center gap-2 pr-1">
            <span className="text-xs font-bold text-foreground pl-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Whiteboard</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMinimized(false)}
              className="rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Expand toolbar"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            {/* Undo / Redo Group */}
            <div className="flex items-center gap-1 border-r border-border pr-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!canUndo}
                      onClick={handleUndo}
                      className="rounded-xl h-9 w-9 text-foreground disabled:opacity-40"
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!canRedo}
                      onClick={handleRedo}
                      className="rounded-xl h-9 w-9 text-foreground disabled:opacity-40"
                    >
                      <Redo2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Node Creation Tools Group */}
            <div className="flex items-center gap-1 border-r border-border pr-2 flex-wrap">
              {/* Sticky Note */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addNodeToCanvas("stickyNote", { label: "New Note", color: selectedNoteColor })}
                      className="rounded-xl gap-1.5 font-semibold text-xs h-9 bg-yellow-400/10 border-yellow-500/30 text-yellow-500 hover:bg-yellow-400/20"
                    >
                      <StickyNote className="w-4 h-4" />
                      <span>Note</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sticky Note</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Process Step */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addNodeToCanvas("process", { label: "Process Step", color: "#3B82F6" })}
                      className="rounded-xl gap-1.5 font-semibold text-xs h-9 bg-blue-500/10 border-blue-500/30 text-blue-500 hover:bg-blue-500/20"
                    >
                      <Square className="w-4 h-4" />
                      <span>Box</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Rectangle / Card</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Circle / Concept */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addNodeToCanvas("circle", { label: "Concept Node", color: "#8B5CF6" })}
                      className="rounded-xl gap-1.5 font-semibold text-xs h-9 bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
                    >
                      <Circle className="w-4 h-4" />
                      <span>Circle</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Circle / Concept</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Decision */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addNodeToCanvas("decision", { label: "Condition?" })}
                      className="rounded-xl gap-1.5 font-semibold text-xs h-9 bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
                    >
                      <Diamond className="w-4 h-4" />
                      <span>Diamond</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Decision Diamond</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Triangle Warning */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addNodeToCanvas("triangle", { label: "Priority / Alert" })}
                      className="rounded-xl gap-1.5 font-semibold text-xs h-9 bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                    >
                      <Triangle className="w-4 h-4" />
                      <span>Alert</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Priority / Alert</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Hexagon Milestone */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addNodeToCanvas("hexagon", { label: "Goal Milestone" })}
                      className="rounded-xl gap-1.5 font-semibold text-xs h-9 bg-pink-500/10 border-pink-500/30 text-pink-400 hover:bg-pink-500/20"
                    >
                      <Hexagon className="w-4 h-4" />
                      <span>Goal</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Milestone Goal</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Database */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addNodeToCanvas("database", { label: "Database Store" })}
                      className="rounded-xl gap-1.5 font-semibold text-xs h-9 bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20"
                    >
                      <Database className="w-4 h-4" />
                      <span>DB</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Database Cylinder</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Cloud */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addNodeToCanvas("cloud", { label: "Cloud API" })}
                      className="rounded-xl gap-1.5 font-semibold text-xs h-9 bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20"
                    >
                      <Cloud className="w-4 h-4" />
                      <span>Cloud</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Cloud Service</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Checklist */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addNodeToCanvas("checklist", { label: "Tasks" })}
                      className="rounded-xl gap-1.5 font-semibold text-xs h-9 bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20"
                    >
                      <CheckSquare className="w-4 h-4" />
                      <span>Tasks</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Task Checklist</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Callout */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addNodeToCanvas("callout", { label: "Note callout" })}
                      className="rounded-xl gap-1.5 font-semibold text-xs h-9 bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Callout</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Speech Callout</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Group Frame */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addNodeToCanvas("groupFrame", { label: "Component Group" })}
                      className="rounded-xl gap-1.5 font-semibold text-xs h-9"
                    >
                      <Layers className="w-4 h-4" />
                      <span>Frame</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Section Container Frame</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Text Annotation */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addNodeToCanvas("text", { label: "Text Label" })}
                      className="rounded-xl gap-1.5 font-semibold text-xs h-9"
                    >
                      <Type className="w-4 h-4" />
                      <span>Text</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Text Label</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Note Color Selector */}
            <div className="flex items-center gap-1.5 border-r border-border pr-2">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedNoteColor(c)}
                  className={cn(
                    "w-5 h-5 rounded-full border border-border/60 transition-transform",
                    selectedNoteColor === c ? "scale-125 ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:scale-110"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* Actions: Minimize, Clear, Close */}
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsMinimized(true)}
                      className="rounded-xl h-9 w-9 text-muted-foreground hover:text-foreground"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Minimize Toolbar</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleClear}
                      className="rounded-xl h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear Whiteboard</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={onClose}
                      className="rounded-xl h-9 w-9 ml-1"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Exit Whiteboard</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </>
        )}
      </header>

      {/* 2. Interactive React Flow Canvas */}
      <div className="flex-1 w-full h-full relative">
        <ReactFlow
          nodes={preparedNodes}
          edges={edges}
          nodeTypes={staticNodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          colorMode="dark"
          className="bg-slate-950"
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="#334155" />
          <Controls className="!bg-background/80 !backdrop-blur-md !border !border-border !rounded-2xl shadow-2xl" />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === "stickyNote") return "#FEF08A"
              if (n.type === "process") return "#3B82F6"
              if (n.type === "circle") return "#8B5CF6"
              if (n.type === "decision") return "#F59E0B"
              if (n.type === "triangle") return "#EF4444"
              if (n.type === "hexagon") return "#EC4899"
              if (n.type === "database") return "#10B981"
              if (n.type === "cloud") return "#6366F1"
              if (n.type === "checklist") return "#14B8A6"
              if (n.type === "callout") return "#06B6D4"
              return "#94A3B8"
            }}
            className="!bg-background/80 !backdrop-blur-md !border !border-border !rounded-2xl shadow-2xl"
          />

          {/* 3. Live Remote Participant Cursors */}
          {cursorList.map((cursor) => {
            const screenPos = reactFlowInstance.flowToScreenPosition({ x: cursor.x, y: cursor.y })
            return (
              <div
                key={cursor.userId}
                className="fixed pointer-events-none z-50 flex items-start gap-1 transition-transform duration-75 ease-out"
                style={{
                  left: `${screenPos.x}px`,
                  top: `${screenPos.y}px`,
                }}
              >
                {/* SVG Pointer Arrow */}
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill={cursor.color}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  className="filter drop-shadow-md -rotate-12"
                >
                  <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35z" />
                </svg>

                {/* Username Badge */}
                <div
                  className="px-2.5 py-1 rounded-full text-[11px] font-bold text-white shadow-xl flex items-center gap-1 -mt-1"
                  style={{ backgroundColor: cursor.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span>{cursor.username}</span>
                </div>
              </div>
            )
          })}
        </ReactFlow>
      </div>
    </div>
  )
}

export function Whiteboard(props: WhiteboardProps) {
  return (
    <ReactFlowProvider>
      <WhiteboardInner {...props} />
    </ReactFlowProvider>
  )
}
