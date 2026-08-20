"use client"

import React, { useState, useCallback, useRef, useEffect } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
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
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  StickyNote,
  Square,
  Diamond,
  Database,
  Type,
  Trash2,
  Download,
  X,
  Plus,
  Palette,
  Sparkles,
  Cloud,
} from "lucide-react"
import { cn } from "@/lib/utils"

// -------------------------------------------------------------
// Custom Node Components
// -------------------------------------------------------------

// 1. Sticky Note Node
function StickyNoteNode({ id, data, selected }: NodeProps) {
  const [text, setText] = useState((data?.label as string) || "Idea / Note")
  const color = (data?.color as string) || "#FEF08A" // Yellow

  return (
    <div
      className={cn(
        "p-4 rounded-xl shadow-lg border transition-all duration-200 min-w-[180px] min-h-[140px] flex flex-col select-none",
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:shadow-xl"
      )}
      style={{ backgroundColor: color, borderColor: `${color}cc`, color: "#1E293B" }}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-slate-700 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-slate-700 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-slate-700 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-slate-700 !border-2 !border-white" />

      <div className="flex items-center justify-between pb-1 mb-2 border-b border-black/10 text-xs font-semibold opacity-70">
        <span className="flex items-center gap-1">
          <StickyNote className="w-3.5 h-3.5" />
          <span>Note</span>
        </span>
        <span className="text-[10px] opacity-60">{data?.author as string || "Participant"}</span>
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (data?.onChange) (data.onChange as (text: string) => void)(e.target.value)
        }}
        className="flex-1 w-full bg-transparent resize-none outline-none font-medium text-sm leading-snug"
        placeholder="Type note..."
      />
    </div>
  )
}

// 2. Process / Card Node
function ProcessNode({ id, data, selected }: NodeProps) {
  const [title, setTitle] = useState((data?.label as string) || "Process Step")
  const color = (data?.color as string) || "#3B82F6"

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-xl bg-background/95 backdrop-blur-md border-2 shadow-xl min-w-[200px] transition-all select-none",
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:shadow-2xl"
      )}
      style={{ borderColor: color }}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-primary !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-primary !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-primary !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-primary !border-2 !border-white" />

      <div className="flex items-center gap-2 mb-1">
        <Square className="w-4 h-4" style={{ color }} />
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            if (data?.onChange) (data.onChange as (text: string) => void)(e.target.value)
          }}
          className="bg-transparent font-bold text-sm text-foreground outline-none w-full"
        />
      </div>
      <p className="text-xs text-muted-foreground">Action / Component Step</p>
    </div>
  )
}

// 3. Decision Diamond Node
function DecisionNode({ id, data, selected }: NodeProps) {
  const [text, setText] = useState((data?.label as string) || "Condition?")

  return (
    <div
      className={cn(
        "w-36 h-36 bg-amber-500/20 backdrop-blur-md border-2 border-amber-500 shadow-xl rounded-2xl flex items-center justify-center p-3 text-center transform rotate-45 transition-all select-none",
        selected ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-background" : "hover:shadow-2xl"
      )}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white" />

      <div className="transform -rotate-45 flex flex-col items-center justify-center">
        <Diamond className="w-4 h-4 text-amber-500 mb-1" />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (data?.onChange) (data.onChange as (text: string) => void)(e.target.value)
          }}
          className="bg-transparent font-bold text-xs text-foreground text-center outline-none w-24"
        />
      </div>
    </div>
  )
}

// 4. Database Node
function DatabaseNode({ id, data, selected }: NodeProps) {
  const [name, setName] = useState((data?.label as string) || "Supabase DB")

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-2xl bg-emerald-500/15 backdrop-blur-md border-2 border-emerald-500 shadow-xl min-w-[180px] flex items-center gap-3 transition-all select-none",
        selected ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-background" : "hover:shadow-2xl"
      )}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white" />

      <Database className="w-6 h-6 text-emerald-500 flex-shrink-0" />
      <div className="flex flex-col">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (data?.onChange) (data.onChange as (text: string) => void)(e.target.value)
          }}
          className="bg-transparent font-bold text-sm text-foreground outline-none w-full"
        />
        <span className="text-[10px] text-emerald-400 font-medium">Data Storage</span>
      </div>
    </div>
  )
}

// 5. Cloud Service Node
function CloudNode({ id, data, selected }: NodeProps) {
  const [name, setName] = useState((data?.label as string) || "API Service")

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-2xl bg-indigo-500/15 backdrop-blur-md border-2 border-indigo-500 shadow-xl min-w-[180px] flex items-center gap-3 transition-all select-none",
        selected ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-background" : "hover:shadow-2xl"
      )}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white" />

      <Cloud className="w-6 h-6 text-indigo-500 flex-shrink-0" />
      <div className="flex flex-col">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (data?.onChange) (data.onChange as (text: string) => void)(e.target.value)
          }}
          className="bg-transparent font-bold text-sm text-foreground outline-none w-full"
        />
        <span className="text-[10px] text-indigo-400 font-medium">Cloud / External</span>
      </div>
    </div>
  )
}

// 6. Free Text Node
function TextNode({ id, data, selected }: NodeProps) {
  const [text, setText] = useState((data?.label as string) || "Add text annotation")

  return (
    <div
      className={cn(
        "p-2 bg-transparent select-none min-w-[120px]",
        selected ? "border border-dashed border-primary rounded-lg" : ""
      )}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (data?.onChange) (data.onChange as (text: string) => void)(e.target.value)
        }}
        className="bg-transparent font-semibold text-base text-foreground outline-none w-full"
      />
    </div>
  )
}

const nodeTypes = {
  stickyNote: StickyNoteNode,
  process: ProcessNode,
  decision: DecisionNode,
  database: DatabaseNode,
  cloud: CloudNode,
  text: TextNode,
}

// -------------------------------------------------------------
// Whiteboard Main Component
// -------------------------------------------------------------

export interface WhiteboardElement {
  id: string
  type: "nodes_update" | "edges_update" | "clear" | "add_node"
  payload: any
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
]

const initialNodes: Node[] = [
  {
    id: "node-1",
    type: "process",
    position: { x: 250, y: 150 },
    data: { label: "InstaMeets Meeting", color: "#3B82F6" },
  },
  {
    id: "node-2",
    type: "stickyNote",
    position: { x: 520, y: 120 },
    data: { label: "Brainstorming Architecture & Real-Time Video", color: "#FEF08A", author: "Host" },
  },
  {
    id: "node-3",
    type: "database",
    position: { x: 260, y: 320 },
    data: { label: "PostgreSQL & SignalR", color: "#10B981" },
  },
]

const initialEdges: Edge[] = [
  {
    id: "e1-2",
    source: "node-1",
    target: "node-2",
    animated: true,
    style: { stroke: "#3B82F6", strokeWidth: 2 },
  },
  {
    id: "e1-3",
    source: "node-1",
    target: "node-3",
    style: { stroke: "#10B981", strokeWidth: 2 },
  },
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
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNoteColor, setSelectedNoteColor] = useState(NOTE_COLORS[0])
  const reactFlowInstance = useReactFlow()

  // Handle Connections
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        id: `e_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        animated: true,
        style: { stroke: "#6366F1", strokeWidth: 2 },
      }
      setEdges((eds) => {
        const updated = addEdge<Edge>(newEdge, eds)
        onSendStroke({ type: "edges_update", payload: updated })
        return updated
      })
    },
    [setEdges, onSendStroke]
  )

  // Handle Incoming Remote Updates
  useEffect(() => {
    if (!incomingStroke) return

    if (incomingStroke.type === "nodes_update" && Array.isArray(incomingStroke.payload)) {
      setNodes(incomingStroke.payload)
    } else if (incomingStroke.type === "edges_update" && Array.isArray(incomingStroke.payload)) {
      setEdges(incomingStroke.payload)
    } else if (incomingStroke.type === "add_node" && incomingStroke.payload) {
      setNodes((nds) => {
        if (nds.some((n) => n.id === incomingStroke.payload.id)) return nds
        return [...nds, incomingStroke.payload]
      })
    }
  }, [incomingStroke, setNodes, setEdges])

  // Handle Remote History
  useEffect(() => {
    if (incomingHistory && Array.isArray(incomingHistory) && incomingHistory.length > 0) {
      const last = incomingHistory[incomingHistory.length - 1]
      if (last?.nodes) setNodes(last.nodes)
      if (last?.edges) setEdges(last.edges)
    }
  }, [incomingHistory, setNodes, setEdges])

  // Handle Board Cleared
  useEffect(() => {
    if (isBoardCleared) {
      setNodes([])
      setEdges([])
    }
  }, [isBoardCleared, setNodes, setEdges])

  // Helper: Add Node to Center of Viewport
  const addNodeToCanvas = (type: string, dataConfig: any) => {
    const id = `node_${currentUserId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const { x, y, zoom } = reactFlowInstance.getViewport()

    const position = {
      x: -x / zoom + 200 + Math.random() * 80,
      y: -y / zoom + 150 + Math.random() * 80,
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
      onSendStroke({ type: "nodes_update", payload: next })
      return next
    })
  }

  // Clear Canvas
  const handleClear = () => {
    if (confirm("Are you sure you want to clear the entire whiteboard for all participants?")) {
      setNodes([])
      setEdges([])
      onClearBoard()
    }
  }

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* 1. Floating Top Glass Toolbar */}
      <header className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-2 rounded-2xl bg-background/85 backdrop-blur-xl border border-border shadow-2xl transition-all">
        {/* Node Creation Tools */}
        <div className="flex items-center gap-1 border-r border-border pr-2">
          {/* Sticky Note */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addNodeToCanvas("stickyNote", { label: "New Idea", color: selectedNoteColor })}
                  className="rounded-xl gap-1.5 font-semibold text-xs h-9 bg-yellow-400/10 border-yellow-500/30 text-yellow-500 hover:bg-yellow-400/20"
                >
                  <StickyNote className="w-4 h-4" />
                  <span>Note</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Sticky Note</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Process Step */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addNodeToCanvas("process", { label: "Step / Process", color: "#3B82F6" })}
                  className="rounded-xl gap-1.5 font-semibold text-xs h-9 bg-blue-500/10 border-blue-500/30 text-blue-500 hover:bg-blue-500/20"
                >
                  <Square className="w-4 h-4" />
                  <span>Card</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Process Card</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Decision */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addNodeToCanvas("decision", { label: "Decision?" })}
                  className="rounded-xl gap-1.5 font-semibold text-xs h-9 bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
                >
                  <Diamond className="w-4 h-4" />
                  <span>Decision</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Decision Node</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Database */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addNodeToCanvas("database", { label: "Database" })}
                  className="rounded-xl gap-1.5 font-semibold text-xs h-9 bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20"
                >
                  <Database className="w-4 h-4" />
                  <span>DB</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Database Node</TooltipContent>
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
                  className="rounded-xl gap-1.5 font-semibold text-xs h-9 bg-indigo-500/10 border-indigo-500/30 text-indigo-500 hover:bg-indigo-500/20"
                >
                  <Cloud className="w-4 h-4" />
                  <span>Cloud</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Cloud API Node</TooltipContent>
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
              <TooltipContent>Add Text Label</TooltipContent>
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

        {/* Actions: Clear, Close */}
        <div className="flex items-center gap-1">
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
      </header>

      {/* 2. Interactive React Flow Canvas */}
      <div className="flex-1 w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={(changes) => {
            onNodesChange(changes)
            onSendStroke({ type: "nodes_update", payload: nodes })
          }}
          onEdgesChange={(changes) => {
            onEdgesChange(changes)
            onSendStroke({ type: "edges_update", payload: edges })
          }}
          onConnect={onConnect}
          fitView
          colorMode="dark"
          className="bg-slate-950"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#334155" />
          <Controls className="!bg-background/80 !backdrop-blur-md !border !border-border !rounded-xl shadow-xl" />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === "stickyNote") return "#FEF08A"
              if (n.type === "process") return "#3B82F6"
              if (n.type === "decision") return "#F59E0B"
              if (n.type === "database") return "#10B981"
              if (n.type === "cloud") return "#6366F1"
              return "#94A3B8"
            }}
            className="!bg-background/80 !backdrop-blur-md !border !border-border !rounded-xl shadow-xl"
          />
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
