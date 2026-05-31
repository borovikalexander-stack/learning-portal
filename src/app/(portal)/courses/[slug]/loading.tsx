export default function CourseLoading() {
  return (
    <div className="stack">
      <div className="skeleton" style={{ height: 28, width: 320 }} />
      <div className="skeleton skeleton-line" style={{ width: 520 }} />
      <div className="row" style={{ flexWrap: "wrap" }}>
        <div className="skeleton" style={{ height: 30, width: 96 }} />
        <div className="skeleton" style={{ height: 30, width: 120 }} />
        <div className="skeleton" style={{ height: 30, width: 140 }} />
      </div>
      <div className="stack">
        <div className="skeleton" style={{ height: 72 }} />
        <div className="skeleton" style={{ height: 72 }} />
        <div className="skeleton" style={{ height: 72 }} />
      </div>
    </div>
  );
}
