export function CardSkeleton() {
  return (
    <div className="testimonial-card skeleton">
      <div className="testimonial-quote">“</div>
      <div className="skeleton-line" style={{ width: "92%" }} />
      <div className="skeleton-line" style={{ width: "78%" }} />
      <div className="skeleton-line" style={{ width: "60%" }} />
      <div className="testimonial-foot">
        <div className="author-line">
          <div className="skeleton-avatar" />
          <div>
            <div className="skeleton-line" style={{ width: 100, height: 12 }} />
            <div
              className="skeleton-line"
              style={{ width: 140, height: 10, marginTop: 4 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
