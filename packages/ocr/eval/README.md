# OCR evaluation

Decides which OCR engine VakilMitra uses, on evidence. The Tech Stack Standard requires at least
20 real examples before an AI feature launches; the spec's test set asks for 50 to 100 real bundles
across at least 4 districts, old handwritten and recent digital 7/12s.

## 1. Prepare pages (real client data: never commit)

Put labelled pages in `/eval-data` at the repo root. Git ignores that folder. One folder per page:

```
eval-data/
  pune-112-1995/
    page.jpg        the scan or phone photo (jpg or png)
    truth.txt       exactly what is written on the page, typed by hand
    fields.json     the key values on the page (optional, but needed for the field targets)
    meta.json       {"script": "handwritten", "district": "Pune", "doc_type": "SEVEN_TWELVE"}
```

`script` is `printed`, `handwritten` or `mixed`; results are reported separately for each.

**Typing `truth.txt`:** type what the page says, line by line, without correcting anything. Digits in
either script are fine (४५६ or 456): the scorer treats them as equal. For an unreadable word, type `[?]`.

**`fields.json`** uses these keys (all optional; arrays for several values):

```json
{
  "survey_no": "45",
  "gat_no": "112",
  "hissa_no": "2",
  "village": "माळेगाव",
  "taluka": "बारामती",
  "district": "पुणे",
  "owners": ["सुरेश जाधव", "अनिल जाधव"],
  "area": "0.81",
  "land_class": "भोगवटादार वर्ग 1",
  "ferfar_no": "456",
  "ferfar_date": "20/08/2001"
}
```

Mask personal details on the image where possible (the spec's consent rule), and type the masked
version in `truth.txt` and `fields.json` too.

## 2. Run

```bash
pnpm --filter @vakilmitra/ocr eval -- --data ../../eval-data --engines tesseract,sarvam,gemini
```

Cloud engines need keys in `packages/ocr/.env` (see `.env.example`). Only run them on real client
pages under a provider agreement with no data retention, and with the clients' consent. Without
`--data`, it runs on `eval/sample/`: four synthetic printed pages that only check the harness works.

## 3. Read the report

`eval/out/report.md` gives, per engine, the character error rate (overall and per script), the
accuracy for each of the spec's field groups against its target, timing, and every missed value.
`eval/out/<engine>/<page>.txt` holds each engine's raw text for side-by-side checks.

Pick the cheapest setup that meets every target on handwritten pages. Then set `OCR_CLOUD_ENGINE` and
`OCR_CLOUD_MODE` for the worker accordingly.
