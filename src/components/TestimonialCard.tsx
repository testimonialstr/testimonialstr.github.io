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
                    "Remover este testemunho do seu perfil? Ele continuará existindo em relays — só não aparecerá mais na sua lista.",
                  )
                )
                  onRemove();
              }}
            >
              remover
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
