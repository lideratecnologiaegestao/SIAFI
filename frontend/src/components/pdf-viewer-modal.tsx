'use client'

import { Download, ExternalLink, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface PDFViewerModalProps {
  url:      string
  titulo:   string
  aberto:   boolean
  aoFechar: () => void
}

export function PDFViewerModal({ url, titulo, aberto, aoFechar }: PDFViewerModalProps) {
  return (
    <Dialog open={aberto} onOpenChange={aoFechar}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between shrink-0 space-y-0">
          <DialogTitle className="text-base font-medium">{titulo}</DialogTitle>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 h-8 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <ExternalLink className="size-3.5" />
              Nova aba
            </a>
            <a
              href={url}
              download
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 h-8 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Download className="size-3.5" />
              Baixar
            </a>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={aoFechar}
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>
        <iframe
          src={url}
          className="flex-1 w-full border-0 rounded-b-lg"
          title={titulo}
        />
      </DialogContent>
    </Dialog>
  )
}
