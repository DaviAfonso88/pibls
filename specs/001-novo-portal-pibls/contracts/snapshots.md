# Contrato: snapshots JSON públicos (`/data/*.json`)

> **Origem**: ADR-014; Performance → Snapshots; Frontend → Regras de cache.

## Regras gerais

| Regra | Valor |
|---|---|
| Onde ficam | `public_html/data/` (homologação: `homolog_html/data/`) |
| Quem serve | Apache, direto, sem PHP |
| Quem grava | Backend (módulo Platform), em arquivo temporário seguido de `rename()` atômico |
| Quando regenera | (1) Evento `PublicContentChanged`, síncrono na requisição que alterou o dado; (2) `pibls:snapshots:refresh-scheduled` a cada 5 min, quando um conteúdo agendado passa a valer; (3) ativação de release (`finalize.php`) |
| Formato | **O mesmo serializador** (Resource) da API correspondente. Um teste de contrato compara snapshot × API |
| Cache HTTP | `no-cache` + ETag (revalidação barata com 304) |
| Tamanho | ≤ 50 KB gzip cada (verificado no CI e no k6) |
| Fallback na SPA | Se o arquivo falhar, usa a API. Se a API também falhar, usa o snapshot gravado no build, com o aviso "Algumas informações podem estar desatualizadas." (FR-011) |
| Privacidade | **Nunca** contém `notification_recipients`, `private_address`, `contact_email` nem conteúdo agendado (BR-042, BR-048, BR-050). Teste obrigatório |

## `data/settings.json`

Mesmo formato de `GET /api/public/settings` (schema `PublicSettings` em `openapi.yaml`), incluindo `features`.

```json
{
  "data": {
    "schedule": [
      { "day": "Quinta-feira", "recurrence": "semanal", "activity": "Culto de Oração", "time": "20:00", "mode": "Presencial e online" },
      { "day": "Domingo", "recurrence": "semanal", "activity": "EBD", "time": "09:00", "mode": "Presencial" },
      { "day": "Domingo", "recurrence": "semanal", "activity": "Culto Matinal", "time": "10:10", "mode": "Presencial e YouTube" },
      { "day": "Domingo", "recurrence": "semanal", "activity": "Culto Noturno", "time": "19:30", "mode": "Presencial e YouTube" },
      { "day": "Sexta-feira", "recurrence": "1ª do mês", "activity": "Culto Salt", "time": "19:30", "mode": "Presencial" }
    ],
    "campaign_notice": { "active": true, "title": "Estamos Construindo", "text": "…" },
    "lords_supper_notice": { "active": true, "text": "A Ceia do Senhor acontece no 1º domingo do mês." },
    "address": { "street": "…", "number": "…", "complement": null, "neighborhood": "…", "city": "Lagoa Santa", "state": "MG", "zip": "33000000" },
    "map_links": { "google_maps_url": "https://…", "waze_url": "https://…", "embed_url": "https://…" },
    "whatsapp": { "phone": "+5531…", "default_text": "Olá! Vim pelo site." },
    "youtube_links": { "channel_url": "https://…", "live_url": "https://…" },
    "social_links": [],
    "pix": { "pix_key": "20969119000184", "beneficiary_name": "Primeira Igreja Batista em Lagoa Santa", "qr_image_url": "/uploads/pix/….png", "copy_paste_code": null },
    "features": { "events": false }
  },
  "generated_at": "2026-11-08T13:10:00Z"
}
```

## `data/ministries.json`

Mesmo formato de `GET /api/public/ministries` sem filtros (schema `MinistryPublic[]`): todos os itens ativos, ordenados por `display_order` e `name`. A SPA filtra por categoria e bairro no cliente.

```json
{
  "data": [
    { "id": 7, "category": "CELULA", "name": "Célula de CL Promissão", "description": null, "leaders_text": "Anfitriões: …", "schedule_text": "Terças, 20h", "neighborhood": "Promissão", "contact_phone": null }
  ],
  "generated_at": "2026-11-08T13:10:00Z"
}
```

## `data/home.json`

Destaques da página inicial.

```json
{
  "data": {
    "latest_bulletin": { "id": 120, "edition_number": 1234, "reference_date": "2026-11-08", "title": "…", "summary_text": "…", "pdf_url": "/uploads/…", "pdf_size_bytes": 1843200 },
    "latest_posts": [ { "id": 15, "title": "…", "slug": "…", "excerpt": "…", "author_display": "…", "youtube_video_id": null, "published_at": "…" } ],
    "upcoming_events": []
  },
  "generated_at": "2026-11-08T13:10:00Z"
}
```

| Campo | Regra |
|---|---|
| `latest_bulletin` | Último boletim publicado (`BulletinPublic`) ou `null` |
| `latest_posts` | Até 3 últimas mensagens publicadas (`PalavraVivaSummary[]`) |
| `upcoming_events` | Até 3 próximos eventos publicados (`EventSummary[]`); **sempre `[]` com `FEATURE_EVENTS` desligado** |

## Testes obrigatórios

- Snapshot = API (mesmo serializador) para os três arquivos.
- BR-048 e BR-050: nenhum campo interno aparece no arquivo.
- BR-042: conteúdo agendado só entra depois do horário, pela regeneração agendada.
- A gravação atômica não deixa arquivo parcial: um leitor concorrente sempre recebe JSON válido.
- Regeneração ≤ 1 s (Performance).
