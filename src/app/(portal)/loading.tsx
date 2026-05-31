export default function PortalLoading() {
  return (
    <div className="stack">
      <div className="skeleton" style={{ height: 28, width: 260 }} />
      <div className="skeleton skeleton-line" style={{ width: 420 }} />
      <div className="skeleton skeleton-card" />
      <div className="grid grid-4">
        <div className="skeleton skeleton-block" />
        <div className="skeleton skeleton-block" />
        <div className="skeleton skeleton-block" />
        <div className="skeleton skeleton-block" />
      </div>
      <div className="grid grid-3">
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
      </div>
    </div>
  );
}
