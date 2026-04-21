# Testimonialstr

Cliente Nostr focado em **testemunhos públicos** (NIP-A1). Sem timeline, sem
ruído — você recebe endossos cifrados, decide o que aparece no seu perfil, e
qualquer pessoa pode ver os testemunhos verificados em qualquer cliente
compatível.

## Como rodar

```bash
npm install
npm run dev
```

Abre em http://localhost:5174.

Você precisa de uma extensão NIP-07 instalada no navegador (nos2x, Alby,
nostr-keyx, etc.) — a extensão deve expor `window.nostr.nip44` para conseguir
descriptografar a inbox.

## Rotas

- `/` — onboarding ou redireciona pro perfil do user logado
- `/p/:npub` — perfil público de qualquer pubkey (read-only se você não for o dono)
- `/inbox` — testemunhos pendentes pra você aceitar/recusar

## NIPs implementados

- **NIP-A1** — kind:63 (testemunho assinado), kind:10064 (lista pública)
- **NIP-59** — gift wrap kind:1059 (sem seal kind:13, conforme NIP-A1)
- **NIP-44 v2** — encriptação dos wraps
- **NIP-07** — assinatura via extensão (login obrigatório)
- **NIP-65** — descoberta de relays (kind:10002)
- **NIP-17 DM relays** — descoberta de relay de entrega (kind:10050)
- **NIP-19** — npub/nprofile encoding
- **NIP-09** — checagem de deleções (kind:5) feitas pelo autor

## Decisões de arquitetura

- **Login só via NIP-07.** Sem nsec digitada, sem chaves geradas, sem
  personas. A extensão é a fonte de verdade da identidade.
- **Encriptação do wrap usa chave efêmera local.** A `signEvent` da NIP-07
  serve só pra kind:63 e kind:10064 (eventos do user). O wrap em si é assinado
  por uma chave gerada e descartada — o usuário nunca confirma uma assinatura
  por wrap enviado.
- **Decriptação do inbox usa `nip44.decrypt` da NIP-07.** Cada wrap pendente
  pede uma confirmação na extensão (comportamento esperado).
- **Sem `alt` tag no wrap** (NIP-A1): manter uniformidade com NIP-17 e
  outros gift-wraps.
- **`expiration` de 30 dias** (NIP-40): bound do tempo de vida de wraps não
  entregues/recusados.
- **Render só do que está em `kind:10064`.** Mesmo que um kind:63 com seu `p`
  apareça em algum relay, ele não vai ser exibido a menos que você tenha
  aceitado e listado.
- **Verificação obrigatória** de assinatura de cada kind:63 antes de exibir;
  conferência de kind:5 dos autores pra esconder deletados.
- **Recusados** ficam num set local (localStorage), pra não ficar reaparecendo
  no inbox.

## Limitações conhecidas

- Sem proof-of-work no envio (NIP-A1 sugere como mitigação opcional de spam).
- Sem checagem de mute list (NIP-51) — também opcional.
- Cache de perfis em `localStorage` com TTL de 24h; sem invalidação ativa por
  novos kind:0.
- Inbox só assina relays atualmente configurados — não puxa relays adicionais
  do `kind:10050` do user logado pra escutar.

## Aprendido com

`~/AndroidStudioProjects/nostr/nipa1/` (PoC do mesmo NIP). A lógica de
gift-wrap e verify foi adaptada pra usar uma interface de signer NIP-07 em vez
de chaves brutas.
