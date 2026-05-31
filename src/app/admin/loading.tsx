export default function AdminLoading() {
  return (
    <div className="stack">
      <div className="skeleton" style={{ height: 28, width: 280 }} />
      <div className="skeleton skeleton-line" style={{ width: 420 }} />
      <div className="grid grid-4">
        <div className="skeleton skeleton-block" />
        <div className="skeleton skeleton-block" />
        <div className="skeleton skeleton-block" />
        <div className="skeleton skeleton-block" />
      </div>
      <div className="grid grid-2">
        <div className="skeleton" style={{ height: 200 }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
      <div className="skeleton" style={{ height: 160 }} />
    </div>
  );
}
