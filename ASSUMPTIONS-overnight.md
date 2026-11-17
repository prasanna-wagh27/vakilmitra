# Assumptions made while working unattended (night of 16–17 Nov 2026)

## Review and fixes (PR #3)

1. **Juniors and billing.** I assumed fees are the case owner's private business. Junior advocates (even "can edit") no longer see a shared case's fee agreements or payments, and only the owner can bill on a case or change which client a case belongs to.
2. **Deleting a case keeps billing.** I assumed you want a client's fee and payment history to survive when a case is deleted (the agreement stays, just unlinked from the case). Before, deleting a case erased its fees.
3. **"Next date not recorded" includes brand-new cases.** Any active case with no upcoming hearing now shows there, even if it never had a hearing. I assumed a new case without a first date is something you'd want to be reminded about.
4. **Production storage must be chosen explicitly.** The server now refuses to start in production without `STORAGE_DRIVER`, rather than quietly saving files on the server's own disk.
5. **The worker never uses the free/consumer Gemini API** for client pages, only Gemini on Vertex AI (paid terms, Mumbai). The consumer API stays usable only in the eval tool for non-client pages.
6. **One harmless issue left as is:** editing a case reads the case twice when the client field is sent. Fixing it would mean changing every route's access check for no user-visible gain.

## UI refresh (feat/ui-refresh)

7. **Fonts are bundled, not loaded from Google (needs your OK).** Hanken Grotesk (HK Grotesk, chosen by the owner) and IBM Plex Sans Devanagari are OFL-1.1 licensed, which is not on the license gate's allowlist. I added them as a "pending owner confirmation" exception (README, "Exceptions to the standard"). If you reject this, delete the font imports at the top of apps/web/src/main.tsx and the two entries in scripts/check-licenses.mjs; the app falls back to system fonts.
8. **Light mode only.** The earlier dark palette was removed to match the reference designs (ailawyer / Harvey). Dark mode can come back later as an opt-in.
9. **Primary buttons are black ("ink"); blue is kept for links, focus and highlights.**
10. **The header language control is one switch** (EN / मराठी); the full two-option control remains on sign-in and in Settings.
11. **Sign-in copy:** "Your practice, in Marathi, in your pocket." I removed an earlier draft line, "stored in India", because the hosting region is not decided yet.
12. **Phone sign-in:** the subtitle and trust points are shortened, so the form sits near the top of the screen.

## Cloud OCR queue (fix/cloud-ocr-queue, merged)

13. **Local text first, cloud reading after.** With cloud reading on, the advocate sees Tesseract's text at once, and the cloud reading replaces it a minute or two later. I assumed fast text is worth more than showing only the final reading.
14. **Repeat views are logged once per 10 minutes.** Screens refresh themselves while OCR runs. Opening the same case, document or page again within 10 minutes is recorded once in the access log. Changes (share, delete, extract …) are always recorded.

## Land-file analyzer extraction (feat/land-extraction)

15. **Rules, not AI.** Extraction reads labelled fields ("गाव :", "गट क्रमांक :", "भोगवटादाराचे नाव :" …) from the OCR text. No language model is involved, in line with "flags come from rules" and with no API keys being available.
16. **Synthetic eval only.** The 24-record eval set is synthetic (rendered pages, read by real Tesseract). It scores 100%, but that is not accuracy on real 7/12s, which are tables, often handwritten or faded. **Real labelled pages from you are needed** before switching this on for clients.
17. **Table-layout 7/12s are not read yet.** Only "label : value" layouts are (as on the digital 7/12 header and on Ferfar and Index-II printouts). Advocates can add missing details by hand.
18. **A 7/12's date.** A 7/12 extract usually carries only a year. When no date is read, the "record date" box defaults to 1 January of the document's year, and the advocate is asked to correct it.
19. **"Unclear" means below 80% OCR confidence** for the weakest word in a fact.
20. **No deed type, no guess.** An Index-II whose deed type is not stated is added with no type, rather than assumed to be a sale.
21. **Frozen after use.** Once a document is in a property's timeline, its facts cannot be changed until that record is removed from the timeline.
22. **A record can join more than one property** (e.g. one 7/12 covering two survey numbers), but only once per property.
