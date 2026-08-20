"use client"

import React, { useCallback, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { reconcileElements } from "@excalidraw/excalidraw"
import "@excalidraw/excalidraw/index.css"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

// Dynamically import Excalidraw for client-only rendering
const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-full w-full bg-slate-950 text-muted-foreground">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary mb-3" />
        <span className="text-sm font-medium">Loading Collaborative Whiteboard...</span>
      </div>
    ),
  }
)

export interface WhiteboardElement {
  id?: string
  type: string
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

// Deterministic participant cursor colors
const CURSOR_COLORS = [
  { background: "#fee2e2", stroke: "#ef4444" },
  { background: "#dbeafe", stroke: "#3b82f6" },
  { background: "#d1fae5", stroke: "#10b981" },
  { background: "#fef3c7", stroke: "#f59e0b" },
  { background: "#ede9fe", stroke: "#8b5cf6" },
  { background: "#fce7f3", stroke: "#ec4899" },
  { background: "#cffafe", stroke: "#06b6d4" },
]

function getParticipantCursorColor(userId: string) {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

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
  const excalidrawApiRef = useRef<any>(null)
  const isApplyingRemoteRef = useRef(false)
  const lastSentVersionRef = useRef<number>(0)
  const lastPointerSendRef = useRef<number>(0)
  const collaboratorsMapRef = useRef<Map<string, any>>(new Map())

  // 1. Send Local Drawing Elements to SignalR only when elements are updated
  const handleChange = useCallback(
    (elements: readonly any[], appState: any) => {
      if (isApplyingRemoteRef.current) return

      // Calculate aggregate element version to detect actual user drawing mutations
      let currentVersion = 0
      for (const el of elements) {
        currentVersion += el.version || 0
      }

      if (currentVersion === lastSentVersionRef.current) return
      lastSentVersionRef.current = currentVersion

      onSendStroke({
        type: "excalidraw_elements",
        senderId: currentUserId,
        payload: elements,
      })
    },
    [currentUserId, onSendStroke]
  )

  // 2. Broadcast Local Pointer / Cursor Movement for Multiplayer Presence
  const handlePointerUpdate = useCallback(
    ({ pointer, button }: { pointer: { x: number; y: number }; button: "down" | "up" }) => {
      const now = Date.now()
      if (now - lastPointerSendRef.current < 40) return // ~25fps smooth presence
      lastPointerSendRef.current = now

      onSendStroke({
        type: "excalidraw_pointer",
        senderId: currentUserId,
        payload: {
          pointer,
          button,
          username: currentUsername || "Participant",
          color: getParticipantCursorColor(currentUserId || "guest"),
        },
      })
    },
    [currentUserId, currentUsername, onSendStroke]
  )

  // 3. Ingest Incoming Remote Drawing Elements & Cursors from SignalR
  useEffect(() => {
    if (!incomingStroke || !excalidrawApiRef.current) return
    if (incomingStroke.senderId === currentUserId) return

    const api = excalidrawApiRef.current

    // Handle Remote Stroke Changes with Reconciler (Prevents flashing/overwriting)
    if (incomingStroke.type === "excalidraw_elements" && Array.isArray(incomingStroke.payload)) {
      isApplyingRemoteRef.current = true
      try {
        const localElements = api.getSceneElementsIncludingDeleted()
        const appState = api.getAppState()
        const reconciled = reconcileElements(localElements, incomingStroke.payload, appState)
        api.updateScene({ elements: reconciled })
      } catch (err) {
        console.warn("[Whiteboard] Error reconciling remote stroke:", err)
      } finally {
        isApplyingRemoteRef.current = false
      }
    }

    // Handle Remote Multiplayer Cursors
    if (incomingStroke.type === "excalidraw_pointer" && incomingStroke.payload) {
      const { pointer, button, username, color } = incomingStroke.payload
      collaboratorsMapRef.current.set(incomingStroke.senderId, {
        pointer,
        button: button || "up",
        username,
        color,
      })

      api.updateScene({
        collaborators: new Map(collaboratorsMapRef.current),
      })
    }
  }, [incomingStroke, currentUserId])

  // Inactivity cleanup for remote cursors (> 6 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (collaboratorsMapRef.current.size > 0 && excalidrawApiRef.current) {
        // Excalidraw handles pointer expiration, refresh map
        excalidrawApiRef.current.updateScene({
          collaborators: new Map(collaboratorsMapRef.current),
        })
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // 4. Ingest Initial Meeting Whiteboard History on Mount
  useEffect(() => {
    if (!incomingHistory || !excalidrawApiRef.current) return

    if (Array.isArray(incomingHistory) && incomingHistory.length > 0) {
      const last = incomingHistory[incomingHistory.length - 1]
      if (Array.isArray(last)) {
        isApplyingRemoteRef.current = true
        try {
          excalidrawApiRef.current.updateScene({ elements: last })
        } finally {
          isApplyingRemoteRef.current = false
        }
      }
    }
  }, [incomingHistory])

  // 5. Handle Clear Whiteboard Event
  useEffect(() => {
    if (isBoardCleared && excalidrawApiRef.current) {
      isApplyingRemoteRef.current = true
      try {
        excalidrawApiRef.current.updateScene({ elements: [] })
      } finally {
        isApplyingRemoteRef.current = false
      }
    }
  }, [isBoardCleared])

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none" style={{ width: "100%", height: "100%" }}>
      {/* Excalidraw Collaborative Canvas with Reconciler & Cursors */}
      <div className="flex-1 w-full h-full relative" style={{ width: "100%", height: "100%" }}>
        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawApiRef.current = api
          }}
          onChange={handleChange}
          onPointerUpdate={handlePointerUpdate}
          theme="dark"
          name="InstaMeets Whiteboard"
          renderTopRightUI={() => (
            <Button
              variant="destructive"
              size="sm"
              onClick={onClose}
              className="rounded-xl h-8 px-3 gap-1.5 font-semibold shadow-md ml-2 my-auto hover:scale-105 active:scale-95 transition-all"
            >
              <X className="w-4 h-4" />
              <span>Exit Whiteboard</span>
            </Button>
          )}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              export: { saveFileToDisk: true },
            },
          }}
        />
      </div>
    </div>
  )
}
