[PUMMA_PATCH_README.md](https://github.com/user-attachments/files/28985057/PUMMA_PATCH_README.md)
# PUMMA Dashboard Patch — Apply Instructions

## What this fixes

### Fix 1 — Grade inflation (the +44% bonus bug)
**Root cause:** `totalMeritsSum = sem1 + sem2 + sem3`. If a cadet has
150 merits each semester that's 450 total. But `maxMeritCap = 450` is
meant to be per-semester. So `excessMerits = 450`, giving
`autoBonus = (450/10) × 0.5 = 22.5%` — or worse if 3 sems total 900.

**Fix:** Cap `autoBonus` at **5% maximum**.

---

### Fix 2 — Manual Grade Converter auto-populates from selected cadet
Adds a **"Load Selected Cadet"** button next to the Cadet Name field in
the Formula & Converter tab. Clicking it pulls these values automatically:

| Converter Field | Source |
|---|---|
| Mockboat Duties | avg of `technicalCS` + `softCS` (mapped 1-5 → 0-100) |
| Logbook Recording | `logbookCompletion` ratio × 100 |
| Patriotism / Merits | `patriotismCS` (mapped 1-5 → 0-100) |
| ICPE Exam Score | Mean `gwa` (already 0-100) |

---

## How to apply

### Option A — Add to your existing index.html (easiest)

Open `index.html`, find the closing `</body>` tag, and paste this
**immediately before** it:

```html
<!-- PUMMA PATCH v1.1 — bonus fix + converter auto-load -->
<script>
/* paste the full contents of pumma_patch_apply.js here */
</script>
</body>
```

### Option B — Add as a separate file

1. Upload `pumma_patch_apply.js` to your GitHub repo root
2. In `index.html`, just before `</body>`, add:

```html
<script src="pumma_patch_apply.js"></script>
```

### Option C — Inline fix in index.html (permanent, no extra file)

In the `<script type="module">` block, find:

```js
cadet.autoBonus = (excessMerits / 10) * bonusRate;
```

Change it to:

```js
cadet.autoBonus = Math.min(5, (excessMerits / 10) * bonusRate);
```

This alone fixes Fix 1. For Fix 2, also paste the `window.loadCadetIntoConverter`
function from `pumma_patch_apply.js` into the same module script.

---

## Quick test after applying

1. Open the dashboard, log in as Admin
2. Click **Assess** on any cadet
3. Open **Matrix** → **Formula & Converter** tab
4. Click **"Load Selected Cadet"** — fields should auto-fill
5. Click **Calculate & Add to Sheet** — grade should be reasonable
6. Check the Cadet Appraisal Board: bonus badge should show ≤ 5%
