# Backend Limitations

1. **Embedded Images in Documents**: In v1, raster images embedded inside DOCX packages and PDF text pages are not extracted or passed to vision OCR. A warning code `EMBEDDED_IMAGES_NOT_ANALYZED` is emitted.
2. **OCR Page Cap**: For scanned PDFs, OCR is capped at `OCR_PAGE_CAP` pages (default 40 pages). Remaining pages are skipped with warning `OCR_PAGE_CAP` and source status set to `partial`.
3. **In-Memory Rate Limiting**: General and auth rate limiters run in-memory per API container instance, suitable for single-container v1 deployments.
4. **Chat Streaming**: Chat is synchronous JSON in v1 with a 60-second timeout.
5. **Generations Quota on Failure**: Quota counters are consumed on generation job creation to prevent quota exhaustion abuse; unmetered refunds are not implemented in v1.
