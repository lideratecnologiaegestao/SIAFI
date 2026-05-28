'use client'

/* Shimmer skeleton shapes para o portal */

interface SkeletonLineProps {
  width?: string
  height?: string
  className?: string
}

export function SkeletonLine({ width = '100%', height = '14px', className }: SkeletonLineProps) {
  return (
    <div
      className={`skeleton-shimmer ${className ?? ''}`}
      style={{ width, height, borderRadius: '4px' }}
    />
  )
}

/* Skeleton do hero card da home */
export function SkeletonHero() {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, var(--portal-blue-900), var(--portal-blue-800))',
        borderRadius: 'var(--portal-radius-card)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div className="skeleton-shimmer" style={{ height: '18px', width: '140px', borderRadius: '4px', opacity: 0.3 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {[1, 2].map(i => (
          <div key={i} style={{ background: 'rgba(255,255,255,.08)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="skeleton-shimmer" style={{ height: '11px', width: '60px', borderRadius: '3px', opacity: 0.3 }} />
            <div className="skeleton-shimmer" style={{ height: '22px', width: '80px', borderRadius: '4px', opacity: 0.3 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* Skeleton de um card de contrato */
export function SkeletonContractCard() {
  return (
    <div className="pcard" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonLine width="100px" height="16px" />
        <SkeletonLine width="60px" height="20px" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <SkeletonLine width="50px" height="11px" />
            <SkeletonLine width="70px" height="15px" />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <SkeletonLine width="100%" height="8px" />
      </div>
    </div>
  )
}

/* Skeleton de item de lista */
export function SkeletonListItem() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--portal-gray-100)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div className="skeleton-shimmer" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <SkeletonLine width="120px" height="13px" />
          <SkeletonLine width="80px" height="11px" />
        </div>
      </div>
      <SkeletonLine width="60px" height="16px" />
    </div>
  )
}

/* Skeleton de ticket de suporte */
export function SkeletonTicketCard() {
  return (
    <div className="pcard" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <SkeletonLine width="160px" height="14px" />
        <SkeletonLine width="70px" height="20px" />
      </div>
      <SkeletonLine width="80px" height="11px" />
    </div>
  )
}
