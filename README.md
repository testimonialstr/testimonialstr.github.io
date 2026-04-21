# Testimonialstr

Nostr client focused on **public testimonials** (NIP-A1). No timeline, no
noise — you receive encrypted endorsements, decide what appears on your
profile, and anyone can see the verified testimonials from any compatible
client.

## How to run

```bash
npm install
npm run dev
```

Opens at http://localhost:5174.

You need a NIP-07 extension installed in the browser (nos2x, Alby,
nostr-keyx, etc.) — the extension must expose `window.nostr.nip44` to
decrypt the inbox.

## Routes

All routes are query-string based (single-page, works from any GitHub Pages
subpath):

- `/` — onboarding, or redirects to the profile of the logged-in user
- `?p=<npub>` — public profile of any pubkey (read-only if you're not the owner)
- `?p=<npub>&write=1` — profile with the compose modal open
- `?view=inbox` — testimonials pending your accept/reject
- `?view=friends` — your follow list (kind:3)
- `?view=rejected` — your private rejection list (kind:10065)
- `?view=sent` — testimonials you wrote that were accepted (with delete action)

## Implemented NIPs

- **NIP-A1** — kind:63 (signed testimonial), kind:10064 (public list), kind:10065 (private rejection list)
- **NIP-59** — gift wrap kind:1059 (no kind:13 seal, per NIP-A1)
- **NIP-44 v2** — wrap encryption
- **NIP-07** — signing via extension (login required)
- **NIP-09** — deletion requests (kind:5) by the original author
- **NIP-65** — relay discovery (kind:10002)
- **NIP-17 DM relays** — delivery relay discovery (kind:10050)
- **NIP-19** — npub/nprofile encoding

## Architecture decisions

- **Login only via NIP-07.** No typed nsec, no generated keys, no personas.
  The extension is the source of truth for identity.
- **Wrap encryption uses a local ephemeral key.** NIP-07's `signEvent` is
  only used for kind:63 and kind:10064 (the user's events). The wrap itself
  is signed by a generated-and-discarded key — the user never has to confirm
  a signature per wrap sent.
- **Inbox decryption uses `nip44.decrypt` from NIP-07.** Each pending wrap
  prompts a confirmation in the extension (expected behavior).
- **No `alt` tag on the wrap** (NIP-A1): keeps uniformity with NIP-17 and
  other gift-wraps.
- **30-day `expiration`** (NIP-40): bounds the lifetime of undelivered/rejected
  wraps.
- **Render only what is in `kind:10064`.** Even if a kind:63 with your `p`
  tag shows up on some relay, it won't be displayed unless you've accepted
  and listed it.
- **Mandatory verification** of each kind:63 signature before display;
  check of kind:5 from authors to hide deleted ones.
- **Rejections** live in kind:10065 (NIP-A1), encrypted via NIP-44 to self,
  following the NIP-51 private list pattern.
- **Sent view** lists kind:63 events you authored that the recipient
  accepted (only those are public). Delete publishes a kind:5 retraction.

## Known limitations

- No proof-of-work on send (NIP-A1 suggests it as an optional spam mitigation).
- No mute-list check (NIP-51) — also optional.
- Profile cache in `localStorage` with 24h TTL; no active invalidation on
  new kind:0 events.
- Inbox only subscribes to the relays currently configured — doesn't fetch
  additional relays from the logged-in user's `kind:10050` to listen on.

## Deploying to GitHub Pages

A workflow is provided at `.github/workflows/deploy.yml`. To enable:

1. Push the repo to GitHub.
2. Settings → Pages → **Source: GitHub Actions**.
3. Each push to `main` (or manual `workflow_dispatch`) rebuilds and
   republishes.

Vite is configured with `base: "./"` so the build is agnostic to the
deployed subpath.

## Learned from

`~/AndroidStudioProjects/nostr/nipa1/` (PoC of the same NIP). The gift-wrap
and verify logic was adapted to use a NIP-07 signer interface instead of
raw keys.
