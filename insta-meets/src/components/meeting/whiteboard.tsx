"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Pencil,
  Eraser,
  Square,
  Circle,
  ArrowRight,
  Minus,
  Type,
  Undo2,
  Redo2,
  Trash2,
  Download,
  X,
  Palette,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type ToolType = "pen" | "eraser" | "rectangle" | "circle" | "arrow" | "line" | "text"

export interface WhiteboardElement {
  id: string
  tool: ToolType
  color: string
  width: number
  points?: { x: number; y: number }[]
  x?: number
  y?: number
  widthShape?: number
  heightShape?: number
  text?: string
}

interface WhiteboardProps {
  currentUserId: string
  currentUsername: string
  onSendStroke: (strokeData: WhiteboardElement) => void
  onClearBoard: () => void
  onClose: () => void
  incomingStroke?: WhiteboardElement | null
  incomingHistory?: WhiteboardElement[] | null
  isBoardCleared?: boolean
}

const PRESET_COLORS = [
  "#3B82F6", // Blue
  "#EF4444", // Red
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#FFFFFF", // White
  "#000000", // Black
]

const STROKE_WIDTHS = [
  { label: "Fine", value: 2 },
  { label: "Medium", value: 5 },
  { label: "Bold", value: 10 },
  { label: "Extra", value: 18 },
]

export function Whiteboard({
  currentUserId,
  currentUsername,
  onSendStroke,
  onClearBoard,
  onClose,
  incomingStroke,
  incomingHistory,
  isBoardCleared,
}: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // State
  const [tool, setTool] = useState<ToolType>("pen")
  const [color, setColor] = useState<string>("#3B82F6")
  const [strokeWidth, setStrokeWidth] = useState<number>(5)
  const [elements, setElements] = useState<WhiteboardElement[]>([])
  const [history, setHistory] = useState<WhiteboardElement[][]>([])
  const [redoList, setRedoList] = useState<WhiteboardElement[][]>([])

  // Drawing state
  const isDrawing = useRef(false)
  const currentElement = useRef<WhiteboardElement | null>(null)

  // Render elements onto Canvas
  const redrawCanvas = useCallback((elementsList: WhiteboardElement[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)

    elementsList.forEach((el) => {
      ctx.save()
      ctx.strokeStyle = el.tool === "eraser" ? "#0F172A" : el.color
      ctx.fillStyle = el.color
      ctx.lineWidth = el.width
      ctx.lineCap = "round"
      ctx.lineJoin = "round"

      if (el.tool === "pen" || el.tool === "eraser") {
        if (el.points && el.points.length > 0) {
          ctx.beginPath()
          ctx.moveTo(el.points[0].x, el.points[0].y)
          for (let i = 1; i < el.points.length; i++) {
            ctx.lineTo(el.points[i].x, el.points[i].y)
          }
          ctx.stroke()
        }
      } else if (el.tool === "rectangle" && el.x !== undefined && el.y !== undefined && el.widthShape !== undefined && el.heightShape !== undefined) {
        ctx.beginPath()
        ctx.strokeRect(el.x, el.y, el.widthShape, el.heightShape)
      } else if (el.tool === "circle" && el.x !== undefined && el.y !== undefined && el.widthShape !== undefined && el.heightShape !== undefined) {
        ctx.beginPath()
        const radiusX = Math.abs(el.widthShape) / 2
        const radiusY = Math.abs(el.heightShape) / 2
        const centerX = el.x + el.widthShape / 2
        const centerY = el.y + el.heightShape / 2
        ctx.ellipse(centerX, centerY, Math.max(radiusX, 1), Math.max(radiusY, 1), 0, 0, 2 * Math.PI)
        ctx.stroke()
      } else if (el.tool === "line" && el.points && el.points.length >= 2) {
        ctx.beginPath()
        ctx.moveTo(el.points[0].x, el.points[0].y)
        ctx.lineTo(el.points[1].x, el.points[1].y)
        ctx.stroke()
      } else if (el.tool === "arrow" && el.points && el.points.length >= 2) {
        const from = el.points[0]
        const to = el.points[1]
        const headLength = 15
        const angle = Math.atan2(to.y - from.y, to.x - from.x)

        ctx.beginPath()
        ctx.moveTo(from.x, from.y)
        ctx.lineTo(to.x, to.y)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(to.x, to.y)
        ctx.lineTo(to.x - headLength * Math.cos(angle - Math.PI / 6), to.y - headLength * Math.sin(angle - Math.PI / 6))
        ctx.moveTo(to.x, to.y)
        ctx.lineTo(to.x - headLength * Math.cos(angle + Math.PI / 6), to.y - headLength * Math.sin(angle + Math.PI / 6))
        ctx.stroke()
      } else if (el.tool === "text" && el.x !== undefined && el.y !== undefined && el.text) {
        ctx.font = `${Math.max(el.width * 4, 16)}px sans-serif`
        ctx.fillText(el.text, el.x, el.y)
      }
      ctx.restore()
    })
  }, [])

  // Sync canvas dimensions with DPR
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.scale(dpr, dpr)
    }
    redrawCanvas(elements)
  }, [elements, redrawCanvas])

  useEffect(() => {
    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)
    return () => window.removeEventListener("resize", resizeCanvas)
  }, [resizeCanvas])

  // Redraw when elements change
  useEffect(() => {
    redrawCanvas(elements)
  }, [elements, redrawCanvas])

  // Handle incoming remote stroke from SignalR
  useEffect(() => {
    if (incomingStroke) {
      setElements((prev) => {
        if (prev.some((e) => e.id === incomingStroke.id)) return prev
        const updated = [...prev, incomingStroke]
        redrawCanvas(updated)
        return updated
      })
    }
  }, [incomingStroke, redrawCanvas])

  // Handle incoming whiteboard history from SignalR
  useEffect(() => {
    if (incomingHistory && incomingHistory.length > 0) {
      setElements(incomingHistory)
      redrawCanvas(incomingHistory)
    }
  }, [incomingHistory, redrawCanvas])

  // Handle incoming clear event
  useEffect(() => {
    if (isBoardCleared) {
      setElements([])
      setHistory([])
      setRedoList([])
      redrawCanvas([])
    }
  }, [isBoardCleared, redrawCanvas])

  // Mouse / Touch Coordinations
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()

    if ("touches" in e) {
      const touch = e.touches[0]
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  // Start Drawing
  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e)
    isDrawing.current = true

    if (tool === "text") {
      const text = prompt("Enter text for whiteboard:")
      if (text) {
        const textElement: WhiteboardElement = {
          id: `wb_${currentUserId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          tool: "text",
          color,
          width: strokeWidth,
          x,
          y,
          text,
        }
        setHistory((prev) => [...prev, elements])
        setRedoList([])
        const nextElements = [...elements, textElement]
        setElements(nextElements)
        onSendStroke(textElement)
      }
      isDrawing.current = false
      return
    }

    const newElement: WhiteboardElement = {
      id: `wb_${currentUserId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tool,
      color,
      width: strokeWidth,
      points: [{ x, y }],
      x,
      y,
      widthShape: 0,
      heightShape: 0,
    }

    currentElement.current = newElement
    setHistory((prev) => [...prev, elements])
    setRedoList([])
    setElements((prev) => [...prev, newElement])
  }

  // Move / Draw
  const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !currentElement.current) return
    const { x, y } = getCanvasCoords(e)

    const el = currentElement.current
    if (tool === "pen" || tool === "eraser") {
      el.points = [...(el.points || []), { x, y }]
    } else if (tool === "rectangle" || tool === "circle") {
      el.widthShape = x - (el.x || 0)
      el.heightShape = y - (el.y || 0)
    } else if (tool === "line" || tool === "arrow") {
      el.points = [el.points![0], { x, y }]
    }

    setElements((prev) => {
      const next = [...prev]
      next[next.length - 1] = { ...el }
      return next
    })
  }

  // End Drawing
  const handleEnd = () => {
    if (!isDrawing.current || !currentElement.current) return
    isDrawing.current = false
    const finalElement = currentElement.current
    currentElement.current = null
    onSendStroke(finalElement)
  }

  // Undo
  const handleUndo = () => {
    if (history.length === 0) return
    const previous = history[history.length - 1]
    setRedoList((prev) => [...prev, elements])
    setHistory((prev) => prev.slice(0, prev.length - 1))
    setElements(previous)
  }

  // Redo
  const handleRedo = () => {
    if (redoList.length === 0) return
    const next = redoList[redoList.length - 1]
    setHistory((prev) => [...prev, elements])
    setRedoList((prev) => prev.slice(0, prev.length - 1))
    setElements(next)
  }

  // Clear Canvas
  const handleClear = () => {
    if (confirm("Are you sure you want to clear the entire whiteboard for all participants?")) {
      setElements([])
      setHistory([])
      setRedoList([])
      onClearBoard()
    }
  }

  // Download / Export as PNG
  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Create temporary export canvas with dark background
    const exportCanvas = document.createElement("canvas")
    exportCanvas.width = canvas.width
    exportCanvas.height = canvas.height
    const ctx = exportCanvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = "#0F172A"
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    ctx.drawImage(canvas, 0, 0)

    // Add watermark
    ctx.fillStyle = "#94A3B8"
    ctx.font = "20px sans-serif"
    ctx.fillText(`InstaMeets Whiteboard • ${new Date().toLocaleDateString()}`, 30, exportCanvas.height - 30)

    const url = exportCanvas.toDataURL("image/png")
    const a = document.createElement("a")
    a.href = url
    a.download = `InstaMeets_Whiteboard_${Date.now()}.png`
    a.click()
  }

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* 1. Floating Top Glass Toolbar */}
      <header className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-2 rounded-2xl bg-background/80 backdrop-blur-xl border border-border shadow-2xl transition-all">
        {/* Tool Selectors */}
        <div className="flex items-center gap-1 border-r border-border pr-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === "pen" ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setTool("pen")}
                  className="rounded-xl h-9 w-9"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pen Tool</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === "eraser" ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setTool("eraser")}
                  className="rounded-xl h-9 w-9"
                >
                  <Eraser className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Eraser</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === "rectangle" ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setTool("rectangle")}
                  className="rounded-xl h-9 w-9"
                >
                  <Square className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rectangle</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === "circle" ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setTool("circle")}
                  className="rounded-xl h-9 w-9"
                >
                  <Circle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Circle</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === "line" ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setTool("line")}
                  className="rounded-xl h-9 w-9"
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Line</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === "arrow" ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setTool("arrow")}
                  className="rounded-xl h-9 w-9"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Arrow</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === "text" ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setTool("text")}
                  className="rounded-xl h-9 w-9"
                >
                  <Type className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Text Note</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Color Palette */}
        <div className="flex items-center gap-1.5 border-r border-border pr-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                "w-5 h-5 rounded-full border border-border/60 transition-transform",
                color === c ? "scale-125 ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:scale-110"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="relative cursor-pointer flex items-center justify-center w-5 h-5 rounded-full border border-border hover:scale-110">
            <Palette className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
        </div>

        {/* Stroke Width Selector */}
        <div className="flex items-center gap-1 border-r border-border pr-2">
          {STROKE_WIDTHS.map((sw) => (
            <button
              key={sw.value}
              onClick={() => setStrokeWidth(sw.value)}
              className={cn(
                "px-2 py-1 text-xs rounded-md font-medium transition-colors",
                strokeWidth === sw.value ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
              )}
            >
              {sw.label}
            </button>
          ))}
        </div>

        {/* Canvas Operations: Undo, Redo, Clear, Download, Close */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={history.length === 0}
                  onClick={handleUndo}
                  className="rounded-xl h-9 w-9"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={redoList.length === 0}
                  onClick={handleRedo}
                  className="rounded-xl h-9 w-9"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo</TooltipContent>
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
                  variant="ghost"
                  size="icon"
                  onClick={handleDownload}
                  className="rounded-xl h-9 w-9"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save Snapshot (PNG)</TooltipContent>
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

      {/* 2. Interactive Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        className={cn(
          "flex-1 w-full h-full touch-none",
          tool === "eraser" ? "cursor-cell" : tool === "text" ? "cursor-text" : "cursor-crosshair"
        )}
      />
    </div>
  )
}
