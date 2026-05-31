export default function LessonLoading() {
  return (
    <div className="stack">
      <div className="skeleton" style={{ height: 28, width: 300 }} />
      <div className="lesson-grid">
        <div className="stack">
          <div className="skeleton" style={{ aspectRatio: "16 / 9", width: "100%" }} />
          <div className="skeleton skeleton-card" />
        </div>
        <div className="stack">
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
        </div>
      </div>
    </div>
  );
}
