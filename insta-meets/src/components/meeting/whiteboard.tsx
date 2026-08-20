"use client"

import React, { useCallback, useEffect, useRef } from "react"
import { Tldraw, Editor, TLRecord, loadSnapshot } from "tldraw"
import "tldraw/tldraw.css"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

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
  const editorRef = useRef<Editor | null>(null)
  const isApplyingRemoteRef = useRef(false)

  // Configure editor on mount
  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor

      // Set user presence (name & color)
      editor.user.updateUserPreferences({
        name: currentUsername || "Participant",
        color: "#3B82F6",
      })

      // Load initial history if provided
      if (incomingHistory && Array.isArray(incomingHistory) && incomingHistory.length > 0) {
        const lastSnapshot = incomingHistory[incomingHistory.length - 1]
        if (lastSnapshot) {
          isApplyingRemoteRef.current = true
          try {
            if (lastSnapshot.store || lastSnapshot.schema) {
              loadSnapshot(editor.store, lastSnapshot)
            } else if (lastSnapshot.records) {
              editor.store.put(Object.values(lastSnapshot.records) as TLRecord[])
            }
          } catch (err) {
            console.warn("[tldraw] Error loading initial snapshot:", err)
          } finally {
            isApplyingRemoteRef.current = false
          }
        }
      }

      // Listen for local changes and broadcast to SignalR
      const cleanup = editor.store.listen(
        (entry) => {
          if (isApplyingRemoteRef.current) return

          const added = Object.values(entry.changes.added)
          const updated = Object.values(entry.changes.updated).map(([, to]) => to)
          const removed = Object.values(entry.changes.removed).map((record) => record.id)

          if (added.length > 0 || updated.length > 0 || removed.length > 0) {
            onSendStroke({
              type: "tldraw_changes",
              senderId: currentUserId,
              payload: { added, updated, removed },
            })
          }
        },
        { source: "user", scope: "document" }
      )

      return () => {
        cleanup()
      }
    },
    [currentUserId, currentUsername, incomingHistory, onSendStroke]
  )

  // Ingest incoming remote changes from SignalR
  useEffect(() => {
    if (!incomingStroke || !editorRef.current) return
    if (incomingStroke.senderId === currentUserId) return

    if (incomingStroke.type === "tldraw_changes" && incomingStroke.payload) {
      const editor = editorRef.current
      const { added, updated, removed } = incomingStroke.payload

      isApplyingRemoteRef.current = true
      try {
        editor.store.mergeRemoteChanges(() => {
          if (added && Array.isArray(added)) {
            editor.store.put(added as TLRecord[])
          }
          if (updated && Array.isArray(updated)) {
            editor.store.put(updated as TLRecord[])
          }
          if (removed && Array.isArray(removed)) {
            editor.store.remove(removed)
          }
        })
      } catch (err) {
        console.warn("[tldraw] Error merging remote changes:", err)
      } finally {
        isApplyingRemoteRef.current = false
      }
    }
  }, [incomingStroke, currentUserId])

  // Handle Board Cleared from SignalR
  useEffect(() => {
    if (isBoardCleared && editorRef.current) {
      isApplyingRemoteRef.current = true
      try {
        const editor = editorRef.current
        const shapeIds = Array.from(editor.getCurrentPageShapeIds())
        editor.deleteShapes(shapeIds)
      } finally {
        isApplyingRemoteRef.current = false
      }
    }
  }, [isBoardCleared])

  return (
    <div className="relative w-full h-full flex flex-col bg-background overflow-hidden select-none">
      {/* Floating Top Exit Button */}
      <div className="absolute top-3 right-3 z-50">
        <Button
          variant="destructive"
          size="sm"
          onClick={onClose}
          className="rounded-xl h-9 px-3 gap-1.5 font-semibold shadow-xl border border-white/20"
        >
          <X className="w-4 h-4" />
          <span>Exit Whiteboard</span>
        </Button>
      </div>

      {/* tldraw Infinite Collaborative Canvas */}
      <div className="flex-1 w-full h-full tldraw__editor">
        <Tldraw
          onMount={handleMount}
          autoFocus={false}
        />
      </div>
    </div>
  )
}
