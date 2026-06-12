// Reads backup, applies mutations, writes patched JSON, then PUTs to n8n
const fs   = require('fs');
const https = require('https');
const path = require('path');

const API_KEY = process.env.N8N_API_KEY;
const WF_ID   = '0T0wSqshQOCGV1a9';
const BASE_URL = 'n8n-bahaymo.onrender.com';
const DOCS = path.join(__dirname);

// Strip UTF-8 BOM if present
function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}

const wf = readJson(path.join(DOCS, 'wf-generate-video-backup.json'));
console.log('Loaded backup — nodes:', wf.nodes.length);

// ── 1. Remove options:{} from IF node (causes 400 in PUT) ─────────────────────
for (const n of wf.nodes) {
  if (n.name === 'Check Data Source') delete n.parameters.options;
}

// ── 2. Add extra fields to Normalize From Listing ────────────────────────────
const nl = wf.nodes.find(n => n.name === 'Normalize From Listing');
nl.parameters.assignments.assignments.push(
  { id:'a14', name:'title',            type:'string', value:'={{ $json.property_name ?? $json.title ?? "" }}' },
  { id:'a15', name:'priceFormatted',   type:'string', value:'={{ $json.price ? "₱" + Number($json.price).toLocaleString("en-PH") : "" }}' },
  { id:'a16', name:'detailsFormatted', type:'string', value:'={{ [($json.bedrooms ? $json.bedrooms + " bd" : null), ($json.bathrooms ? $json.bathrooms + " ba" : null), ($json.floor_area ? $json.floor_area + " sqm" : null)].filter(Boolean).join(" · ") }}' },
  { id:'a17', name:'addressFormatted', type:'string', value:'={{ [$json.street_address ?? "", $json.city ?? ""].filter(Boolean).join("\\n") || $json.location ?? "" }}' }
);

// ── 3. Add extra fields to Normalize From Manual ──────────────────────────────
const nm = wf.nodes.find(n => n.name === 'Normalize From Manual');
nm.parameters.assignments.assignments.push(
  { id:'m14', name:'title',            type:'string', value:'={{ $json.body.manual_data.title ?? "" }}' },
  { id:'m15', name:'priceFormatted',   type:'string', value:'={{ $json.body.manual_data.details2 ?? "" }}' },
  { id:'m16', name:'detailsFormatted', type:'string', value:'={{ $json.body.manual_data.details1 ?? "" }}' },
  { id:'m17', name:'addressFormatted', type:'string', value:'={{ $json.body.manual_data.address ?? "" }}' }
);

// ── 4. Shift existing node positions to make room ─────────────────────────────
const pos = (name, x, y) => { const n = wf.nodes.find(n => n.name === name); if(n) n.position = [x,y]; };
pos('Start Creatomate Render', 1156, -80);
pos('Create Render Job',       1380, 96);
pos('Respond With Job',        1604, 96);

// ── 5. Route by Template — IF node (mirrors Check Data Source format) ─────────
//    True (output 0)  = Classic template (7752bc3f-…)
//    False (output 1) = everything else  (1cd7f2c8-…)
wf.nodes.push({
  parameters: {
    conditions: {
      options:    { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 1 },
      combinator: 'and',
      conditions: [{
        id:         'r1',
        leftValue:  '={{ $("Video Request Webhook").item.json.body.template_id }}',
        rightValue: '7752bc3f-fde2-4592-b521-101c1bfd69cd',
        operator:   { type: 'string', operation: 'equals' }
      }]
    }
  },
  id:          'route-by-template-if',
  name:        'Route by Template',
  type:        'n8n-nodes-base.if',
  typeVersion: 2.3,
  position:    [896, 96]
});

// ── 6. New CTA HTTP render node ────────────────────────────────────────────────
const ctaJsonBody = '={{ JSON.stringify({ template_id: "1cd7f2c8-7ca3-4980-b2b4-785a59c0a32f", modifications: (() => { const d = $json; const m = {}; m["Title.text"] = d.title || "New Listing"; if (d.priceFormatted) m["Price.text"] = d.priceFormatted; if (d.detailsFormatted) m["Details.text"] = d.detailsFormatted; if (d.addressFormatted) m["Address.text"] = d.addressFormatted; m["CTA-Text.text"] = "More info at bahaymo.com"; if (d.photo1) m["Photo-1.source"] = d.photo1; if (d.photo2) m["Photo-2.source"] = d.photo2; if (d.photo3) m["Photo-3.source"] = d.photo3; if (d.photo4) m["Photo-4.source"] = d.photo4; return m; })(), webhook_url: "https://n8n-bahaymo.onrender.com/webhook/bamo-video-complete" }) }}';
wf.nodes.push({
  parameters: {
    method: 'POST',
    url: 'https://api.creatomate.com/v2/renders',
    authentication: 'genericCredentialType',
    genericAuthType: 'httpBearerAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: ctaJsonBody
  },
  id:          'cta-render-node-001',
  name:        'Start Creatomate Render - Listing CTA',
  type:        'n8n-nodes-base.httpRequest',
  typeVersion: 4.4,
  position:    [1156, 260],
  credentials: { httpBearerAuth: { id: 'NEJcstQDnq3HPGLK', name: 'Createomate' } }
});

// ── 7. Update connections ──────────────────────────────────────────────────────
const conn = wf.connections;
// Normalize → Route by Template (was → Start Creatomate Render)
conn['Normalize From Listing'].main[0] = [{ node: 'Route by Template', type: 'main', index: 0 }];
conn['Normalize From Manual'].main[0]  = [{ node: 'Route by Template', type: 'main', index: 0 }];
// Route by Template → two render nodes
conn['Route by Template'] = {
  main: [
    [{ node: 'Start Creatomate Render',             type: 'main', index: 0 }],
    [{ node: 'Start Creatomate Render - Listing CTA', type: 'main', index: 0 }]
  ]
};
// CTA render → Create Render Job
conn['Start Creatomate Render - Listing CTA'] = {
  main: [[{ node: 'Create Render Job', type: 'main', index: 0 }]]
};

// ── 8. Build PUT body ──────────────────────────────────────────────────────────
const body = {
  name:        wf.name,
  nodes:       wf.nodes,
  connections: conn,
  settings:    { executionOrder: 'v1' },
  staticData:  null
};

const bodyStr = JSON.stringify(body);
fs.writeFileSync(path.join(DOCS, 'wf-patched-final.json'), bodyStr);
console.log('Patched JSON written — nodes:', wf.nodes.length);

// ── 9. PUT ─────────────────────────────────────────────────────────────────────
const options = {
  hostname: BASE_URL,
  path:     `/api/v1/workflows/${WF_ID}`,
  method:   'PUT',
  headers: {
    'X-N8N-API-KEY':  API_KEY,
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(bodyStr)
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log(`PUT response: HTTP ${res.statusCode}`);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const r = JSON.parse(data);
      console.log('Success! updatedAt:', r.updatedAt, '— nodes:', r.nodes.length);
      r.nodes.forEach(n => console.log('  ·', n.name));
    } else {
      console.error('Error body:', data.slice(0, 500));
    }
  });
});
req.on('error', e => console.error('Request error:', e.message));
req.write(bodyStr);
req.end();
