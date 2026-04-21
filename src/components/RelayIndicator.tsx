import { useState } from "react";
import { useRelay } from "../state/relay";

export default function RelayIndicator() {
  const { urls, addUrl, removeUrl } = useRelay();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <div className="relay-indicator">
      <button
        className="relay-pill"
        onClick={() => setOpen((o) => !o)}
        title="Configured relays"
      >
        <span className="dot" />
        {urls.length} relays
      </button>
      {open && (
        <div className="relay-pop" onMouseLeave={() => setOpen(false)}>
          <div className="relay-pop-title">Relays</div>
          <ul className="relay-list">
            {urls.map((u) => (
              <li key={u}>
                <span className="mono">{u}</span>
                <button
                  className="link-btn danger"
                  onClick={() => removeUrl(u)}
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
          <form
            className="relay-add"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) {
                addUrl(draft.trim());
                setDraft("");
              }
            }}
          >
            <input
              placeholder="wss://relay.example.com"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit">+</button>
          </form>
        </div>
      )}
    </div>
  );
}
