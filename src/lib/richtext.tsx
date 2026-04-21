import type { ReactNode } from "react";
import { nip19 } from "nostr-tools";
import { useProfile, profileName } from "../state/profiles";
import { RouterLink } from "../router";

type Token =
  | { kind: "text"; value: string }
  | { kind: "url"; value: string }
  | { kind: "mdlink"; text: string; url: string }
  | { kind: "nostr"; value: string; withPrefix: boolean }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "code"; value: string };

const NOSTR_BECH_TYPES = "npub|nprofile|note|nevent|naddr";

const PATTERNS: Array<[RegExp, (m: RegExpExecArray) => Token]> = [
  // [text](url)
  [
    /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/,
    (m) => ({ kind: "mdlink", text: m[1], url: m[2] }),
  ],
  // nostr:npub1... / nostr:nprofile1... / nostr:note1... / nostr:nevent1... / nostr:naddr1...
  [
    new RegExp(`nostr:((?:${NOSTR_BECH_TYPES})1[02-9ac-hj-np-z]+)`),
    (m) => ({ kind: "nostr", value: m[1], withPrefix: true }),
  ],
  // bare bech32 entity — must have word boundary before so we don't match inside other strings
  [
    new RegExp(`(?:^|(?<=[\\s(]))((?:${NOSTR_BECH_TYPES})1[02-9ac-hj-np-z]+)`),
    (m) => ({ kind: "nostr", value: m[1], withPrefix: false }),
  ],
  // http(s) url
  [
    /https?:\/\/[^\s<>]+[^\s<>.,;:!?)'"»]/,
    (m) => ({ kind: "url", value: m[0] }),
  ],
  // `code`
  [/`([^`\n]+)`/, (m) => ({ kind: "code", value: m[1] })],
  // **bold** / __bold__
  [/\*\*([^*\n]+)\*\*/, (m) => ({ kind: "bold", value: m[1] })],
  [/__([^_\n]+)__/, (m) => ({ kind: "bold", value: m[1] })],
  // *italic* / _italic_ — require non-word boundary to avoid eating snake_case
  [
    /(?:^|(?<=[\s(]))\*([^*\s][^*\n]*?[^*\s]|\S)\*(?=$|[\s.,;:!?)])/,
    (m) => ({ kind: "italic", value: m[1] }),
  ],
  [
    /(?:^|(?<=[\s(]))_([^_\s][^_\n]*?[^_\s]|\S)_(?=$|[\s.,;:!?)])/,
    (m) => ({ kind: "italic", value: m[1] }),
  ],
];

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let rest = text;
  // Safety: cap iterations for pathological input.
  for (let iter = 0; iter < 10_000 && rest.length > 0; iter++) {
    let bestIdx = -1;
    let bestLen = 0;
    let bestToken: Token | null = null;
    for (const [re, factory] of PATTERNS) {
      const m = re.exec(rest);
      if (m && (bestIdx === -1 || m.index < bestIdx)) {
        bestIdx = m.index;
        bestLen = m[0].length;
        bestToken = factory(m);
      }
    }
    if (!bestToken) {
      out.push({ kind: "text", value: rest });
      break;
    }
    if (bestIdx > 0) out.push({ kind: "text", value: rest.slice(0, bestIdx) });
    out.push(bestToken);
    rest = rest.slice(bestIdx + bestLen);
  }
  return out;
}

function truncateMiddle(s: string, max = 44): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 8) + "…" + s.slice(-5);
}

function Mention({ pk, npubStr }: { pk: string; npubStr: string }) {
  const profile = useProfile(pk);
  const name = profileName(profile, "");
  const label = name || `${npubStr.slice(0, 12)}…`;
  return (
    <RouterLink
      route={{ view: "profile", npub: npubStr }}
      className="rt-mention"
    >
      @{label}
    </RouterLink>
  );
}

function renderNostr(
  entity: string,
  withPrefix: boolean,
  key: number,
): ReactNode {
  let decoded: ReturnType<typeof nip19.decode>;
  try {
    decoded = nip19.decode(entity);
  } catch {
    return <span key={key}>{withPrefix ? `nostr:${entity}` : entity}</span>;
  }
  if (decoded.type === "npub") {
    const pk = decoded.data as string;
    return <Mention key={key} pk={pk} npubStr={entity} />;
  }
  if (decoded.type === "nprofile") {
    const pk = (decoded.data as { pubkey: string }).pubkey;
    const n = nip19.npubEncode(pk);
    return <Mention key={key} pk={pk} npubStr={n} />;
  }
  if (
    decoded.type === "note" ||
    decoded.type === "nevent" ||
    decoded.type === "naddr"
  ) {
    return (
      <a
        key={key}
        href={`https://njump.me/${entity}`}
        target="_blank"
        rel="noreferrer noopener"
        className="rt-nostr-ref"
      >
        {entity.slice(0, 10)}…
      </a>
    );
  }
  return <span key={key}>{withPrefix ? `nostr:${entity}` : entity}</span>;
}

function renderToken(t: Token, key: number): ReactNode {
  switch (t.kind) {
    case "text":
      return <span key={key}>{t.value}</span>;
    case "url":
      return (
        <a
          key={key}
          href={t.value}
          target="_blank"
          rel="noreferrer noopener"
          className="rt-link"
        >
          {truncateMiddle(t.value.replace(/^https?:\/\//, ""), 44)}
        </a>
      );
    case "mdlink":
      return (
        <a
          key={key}
          href={t.url}
          target="_blank"
          rel="noreferrer noopener"
          className="rt-link"
        >
          {t.text}
        </a>
      );
    case "nostr":
      return renderNostr(t.value, t.withPrefix, key);
    case "bold":
      return <strong key={key}>{t.value}</strong>;
    case "italic":
      return <em key={key}>{t.value}</em>;
    case "code":
      return (
        <code key={key} className="rt-code">
          {t.value}
        </code>
      );
  }
}

export function RichText({ text }: { text: string }) {
  if (!text) return null;
  return <>{tokenize(text).map((t, i) => renderToken(t, i))}</>;
}
