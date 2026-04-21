export function LeadCardSkeleton() {
  return (
    <div className="animate-pulse rounded-[10px] border border-[#2A2A3C] bg-[#111118] p-3">
      <div className="mb-3 h-4 w-3/4 rounded bg-[#1A1A24]" />
      <div className="mb-3 h-3 w-1/2 rounded bg-[#1A1A24]" />
      <div className="mb-3 h-6 w-20 rounded-full bg-[#1A1A24]" />
      <div className="mb-3 h-3 w-1/3 rounded bg-[#1A1A24]" />
      <div className="mb-3 h-3 w-2/3 rounded bg-[#1A1A24]" />
      <div className="h-3 w-1/2 rounded bg-[#1A1A24]" />
    </div>
  )
}
