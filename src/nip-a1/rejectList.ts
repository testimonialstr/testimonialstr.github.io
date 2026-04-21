import type { Event, EventTemplate } from "nostr-tools/pure";

export const KIND_REJECT_LIST = 10065;

type Encrypt = (pubkey: string, plaintext: string) => Promise<string>;
type Decrypt = (pubkey: string, ciphertext: string) => Promise<string>;

export async function buildRejectListTemplate(
  innerIds: string[],
  selfPk: string,
  encrypt: Encrypt,
): Promise<EventTemplate> {
  const unique = Array.from(new Set(innerIds));
  const content = await encrypt(selfPk, JSON.stringify(unique));
  return {
    kind: KIND_REJECT_LIST,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content,
  };
}

export async function parseRejectList(
  ev: Event | null,
  selfPk: string,
  decrypt: Decrypt,
): Promise<string[]> {
  if (!ev || !ev.content) return [];
  try {
    const json = await decrypt(selfPk, ev.content);
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}
