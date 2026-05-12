"use client"

import { KanbanBoard } from "@/components/kanban/KanbanBoard"
import { BlobBackground } from "@/components/kanban/BlobBackground"
import { useMediaQuery } from "@/lib/hooks/useMediaQuery"

export default function PipelinePage() {
  const isMobile = useMediaQuery("(max-width: 768px)")

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent">
      {/* Animated blob canvas — absolute, z-0, pointer-events: none.
          Sits behind the kanban content. Drag-and-drop is unaffected. */}
      <BlobBackground />

      {/* All kanban content sits above the canvas via z-10 */}
      <div className="relative z-10 h-full min-h-screen">
        <KanbanBoard isMobile={isMobile} />
      </div>
    </main>
  )
}
