import { AuthorLine } from "./Avatar";
import { RichText } from "../lib/richtext";

type Props = {
  content: string;
  authorPk: string;
  createdAt: number;
  onRemove?: () => void;
};

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function TestimonialCard({
  content,
  authorPk,
  createdAt,
  onRemove,
}: Props) {
  return (
    <article className="testimonial-card">
      <div className="testimonial-quote">“</div>
      <div className="testimonial-content">
        <RichText text={content} />
      </div>
      <div className="testimonial-foot">
        <AuthorLine pk={authorPk} />
        <div className="testimonial-meta">
          <time>{formatDate(createdAt)}</time>
          {onRemove && (
            <button
              className="link-btn danger"
              onClick={() => {
                if (
                  confirm(
                    "Remove this testimonial from your profile? It will still exist on relays — it just won't appear on your list anymore.",
                  )
                )
                  onRemove();
              }}
            >
              remove
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
