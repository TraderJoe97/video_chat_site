"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface NameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guestName: string
  setGuestName: (name: string) => void
  handleNameSubmit: () => void
}

export function NameDialog({ open, onOpenChange, guestName, setGuestName, handleNameSubmit }: NameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enter your name to join the meeting</DialogTitle>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <div className="grid flex-1 gap-2">
            <Input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Your name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleNameSubmit()
                }
              }}
            />
          </div>
        </div>
        <DialogFooter className="sm:justify-start">
          <Button type="button" variant="default" onClick={handleNameSubmit}>
            Join Meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

