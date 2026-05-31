export default function ManagerCardLoading() {
  return (
    <div className="stack">
      <div className="skeleton" style={{ height: 28, width: 220 }} />
      <div className="grid grid-2">
        <div className="skeleton" style={{ height: 240 }} />
        <div className="skeleton" style={{ height: 240 }} />
      </div>
      <div className="skeleton" style={{ height: 320 }} />
    </div>
  );
}
