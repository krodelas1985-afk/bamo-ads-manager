# Smoke-test — New Listing Price + CTA Template

## Pre-conditions
- Both templates visible in Creatives → Generate New → Template picker
- n8n workflow branching applied (Switch node live)

---

## Test 1 — Happy path (listing with ≥ 4 photos)

1. Open Ads Manager → Creatives → Generate New
2. Source = **Creatomate**, Creative type = **Video**
3. Template picker — select **"New Listing — Price + CTA"**
4. Photo source — **From Listing** — pick a listing that has at least 4 photo URLs
5. Click **Generate Creative**

**Expected:**
- Webhook fires to n8n; Switch node routes to Branch B
- Creatomate render starts with template `1cd7f2c8-…`
- `creatives` row created with `job_status = 'pending'`, correct `template_id`
- After ~30–60 s render completes → Render Complete callback flips `job_status` to `completed`
- Video preview loads in the form; price shows as **₱X,XXX,XXX** (thousands separators)
- Address has a **line break** between street and city lines in the video
- CTA reads **"More info at bahaymo.com"**
- No agent name/email/phone/brand/music elements attempted (they don't exist in this template — Creatomate would error if sent)

---

## Test 2 — Partial photos (listing with 2 photos)

1. Same flow, but pick a listing that has exactly **2 photo URLs**
2. Click **Generate Creative**

**Expected:**
- `Photo-1.source` and `Photo-2.source` are set to the two URLs
- `Photo-3.source` and `Photo-4.source` are **absent** from the modifications object (not empty strings)
- Creatomate renders successfully (does not error on missing photo slots)
- Video shows 2 photos; remaining photo slots use template defaults or are hidden per Creatomate's template logic

---

## Test 3 — Classic template regression

1. Same flow, but select **"BaMo Listing Video — Classic"** (the original template)
2. Click **Generate Creative**

**Expected:**
- Switch node routes to Branch A (Classic)
- Render fires with template `7752bc3f-…` and original modifications (Name/Email/Phone/Brand/Photo-5/Music etc.)
- No regression in behavior

---

## Failure checklist

| Symptom | Likely cause |
|---------|-------------|
| Template picker only shows 1 template | `ad_templates` insert failed or RLS blocking — re-check Supabase |
| Switch node not found in workflow | Patch not applied yet — see `n8n-generate-video-template2-patch.md` |
| Creatomate error: element not found | Wrong element names — verify against Creatomate template editor for `1cd7f2c8-…` |
| 401 from `/api/creatives/generate` | Not logged in or session expired |
| Render stays `pending` forever | Render Complete callback not firing — check n8n `g1tsCRa4k4iyIqIR` webhook logs |
