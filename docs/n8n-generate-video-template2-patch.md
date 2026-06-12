# n8n Workflow Patch — Add Second Creatomate Template (Listing Price + CTA)

**Workflow:** Generate Video (`0T0wSqshQOCGV1a9`)  
**n8n instance:** https://n8n-bahaymo.onrender.com  
**Status:** Requires manual application OR REST API PUT (see below)

---

## What this patch does

Inserts a **Switch node** immediately before the existing "Start Creatomate Render" node,
routing on `template_id`:

- Branch A (`7752bc3f-…`) → existing "Start Creatomate Render" node, **untouched**
- Branch B (`1cd7f2c8-…`) → new "Start Creatomate Render — Listing CTA" node

---

## How to apply manually in the n8n UI

1. Open workflow **0T0wSqshQOCGV1a9** in the n8n editor.
2. Find the node that currently feeds into "Start Creatomate Render" — disconnect it.
3. Add a **Switch** node between that upstream node and "Start Creatomate Render".
4. Configure the Switch node (see JSON below).
5. Connect Switch output 0 → existing "Start Creatomate Render".
6. Add a new **HTTP Request** node and configure it from the JSON below.
7. Connect Switch output 1 → new HTTP node.
8. Save and publish.

---

## Switch node JSON

Paste this into the n8n node editor (triple-dot menu → "Edit JSON"):

```json
{
  "parameters": {
    "rules": {
      "rules": [
        {
          "conditions": {
            "options": {
              "caseSensitive": true,
              "leftValue": "",
              "typeValidation": "strict"
            },
            "conditions": [
              {
                "leftValue": "={{ $json.template_id }}",
                "rightValue": "7752bc3f-fde2-4592-b521-101c1bfd69cd",
                "operator": {
                  "type": "string",
                  "operation": "equals"
                }
              }
            ],
            "combinator": "and"
          },
          "renameOutput": true,
          "outputKey": "Classic"
        },
        {
          "conditions": {
            "options": {
              "caseSensitive": true,
              "leftValue": "",
              "typeValidation": "strict"
            },
            "conditions": [
              {
                "leftValue": "={{ $json.template_id }}",
                "rightValue": "1cd7f2c8-7ca3-4980-b2b4-785a59c0a32f",
                "operator": {
                  "type": "string",
                  "operation": "equals"
                }
              }
            ],
            "combinator": "and"
          },
          "renameOutput": true,
          "outputKey": "ListingCTA"
        }
      ]
    },
    "options": {}
  },
  "type": "n8n-nodes-base.switch",
  "typeVersion": 3,
  "name": "Route by Template"
}
```

---

## New HTTP node JSON — "Start Creatomate Render — Listing CTA"

**Critical:** copy the `credentials` block from the existing "Start Creatomate Render" node
and paste it into this node's JSON to reuse the same Creatomate API credential.

This node expects upstream nodes to have already resolved the listing data into `$json`
with these fields (same as what the existing Supabase + Code nodes produce upstream):

| Field in `$json` | Source |
|-----------------|--------|
| `template_id` | From app payload |
| `title` or `property_name` | Listing record |
| `price` | Listing record (numeric) |
| `bedrooms` | Listing record |
| `bathrooms` | Listing record |
| `floor_area` | Listing record (sqm) |
| `address` or `street_address` | Listing record |
| `city` | Listing record |
| `photos` | Array of photo URL strings |
| `webhook_url` or `callback_url` | Set by upstream Creatomate config node |

> **Note:** Check what field names the existing Supabase node outputs — adjust the
> `={{ $json.fieldName }}` expressions below to match exactly.

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://api.creatomate.com/v1/renders",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "creatomateApi",
    "sendBody": true,
    "contentType": "json",
    "body": {
      "template_id": "1cd7f2c8-7ca3-4980-b2b4-785a59c0a32f",
      "modifications": "={{ (() => {\n  const d = $json;\n  const mods = {};\n\n  // Title\n  mods['Title.text'] = d.property_name || d.title || 'New Listing';\n\n  // Price — ₱ + thousands separators\n  if (d.price) {\n    mods['Price.text'] = '₱' + Number(d.price).toLocaleString('en-PH');\n  }\n\n  // Details — omit missing parts\n  const parts = [];\n  if (d.bedrooms)   parts.push(d.bedrooms + ' bd');\n  if (d.bathrooms)  parts.push(d.bathrooms + ' ba');\n  if (d.floor_area) parts.push(d.floor_area + ' sqm');\n  if (parts.length) mods['Details.text'] = parts.join(' · ');\n\n  // Address — street \\n city\n  const street = d.street_address || d.address || '';\n  const city   = d.city || '';\n  if (street && city)   mods['Address.text'] = street + '\\n' + city;\n  else if (street)      mods['Address.text'] = street;\n  else if (city)        mods['Address.text'] = city;\n\n  // CTA — static\n  mods['CTA-Text.text'] = 'More info at bahaymo.com';\n\n  // Photos — first 4 only; omit slots with no URL\n  const photos = Array.isArray(d.photos) ? d.photos.slice(0, 4) : [];\n  photos.forEach((url, i) => {\n    if (url) mods['Photo-' + (i + 1) + '.source'] = url;\n  });\n\n  return mods;\n})() }}",
      "webhook_url": "={{ $json.webhook_url || $json.callback_url }}"
    },
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "name": "Start Creatomate Render — Listing CTA"
}
```

### ⚠️ Credentials: copy from existing node

After adding the node above, open the existing "Start Creatomate Render" node, copy its
credentials reference (the Creatomate API credential name/ID), and apply the same
credential to the new node. Do **not** hardcode an API key.

---

## REST API application (once n8n API key is available)

If you have the n8n API key (Settings → API → API Keys in the n8n UI), run:

```powershell
# 1. GET current workflow
$headers = @{ 'X-N8N-API-KEY' = 'YOUR_N8N_API_KEY_HERE' }
$wf = Invoke-RestMethod -Uri 'https://n8n-bahaymo.onrender.com/api/v1/workflows/0T0wSqshQOCGV1a9' -Headers $headers
$wf | ConvertTo-Json -Depth 20 | Out-File C:\claude.install.app\bamo-ads-manager\docs\wf-generate-video-backup.json

# 2. Share the backup JSON with Claude Code and ask it to apply the patch programmatically
```

Claude Code can then mutate the JSON and PUT it back — no WAF issues expected since the
body contains no SQL strings.

---

## Smoke-test checklist

See `n8n-template2-smoke-test.md` in this folder.
