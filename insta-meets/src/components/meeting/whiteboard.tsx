"use client"

import React, { useCallback, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
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
  const lastSendTimestampRef = useRef<number>(0)

  // 1. Send Local Drawing Changes to SignalR (Debounced for network efficiency)
  const handleChange = useCallback(
    (elements: readonly any[], appState: any) => {
      if (isApplyingRemoteRef.current) return

      const now = Date.now()
      if (now - lastSendTimestampRef.current < 50) return // ~20fps smooth sync
      lastSendTimestampRef.current = now

      onSendStroke({
        type: "excalidraw_elements",
        senderId: currentUserId,
        payload: elements,
      })
    },
    [currentUserId, onSendStroke]
  )

  // 2. Ingest Incoming Remote Drawing Elements from SignalR
  useEffect(() => {
    if (!incomingStroke || !excalidrawApiRef.current) return
    if (incomingStroke.senderId === currentUserId) return

    if (incomingStroke.type === "excalidraw_elements" && Array.isArray(incomingStroke.payload)) {
      isApplyingRemoteRef.current = true
      try {
        excalidrawApiRef.current.updateScene({
          elements: incomingStroke.payload,
        })
      } catch (err) {
        console.warn("[Whiteboard] Error applying remote stroke:", err)
      } finally {
        isApplyingRemoteRef.current = false
      }
    }
  }, [incomingStroke, currentUserId])

  // 3. Ingest Initial Meeting Whiteboard History on Mount
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

  // 4. Handle Clear Whiteboard Event
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
      {/* Excalidraw Collaborative Canvas */}
      <div className="flex-1 w-full h-full relative" style={{ width: "100%", height: "100%" }}>
        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawApiRef.current = api
          }}
          onChange={handleChange}
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
