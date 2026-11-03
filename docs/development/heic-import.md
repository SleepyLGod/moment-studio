# Photo import: HEIC, capture time and orientation

## Contract

- Existing 20-file batch and 12 MiB/file limits remain. Processing is sequential. Original bytes are never converted or overwritten.
- File selection accepts still HEIC/HEIF with HEVC still-image brands (`heic` / `heix`), including browser-empty MIME. Actual byte headers determine MIME on both browser and server. Generic HEIF, AVIF, HEIC sequences, Live Photos and videos are outside this release. A valid header is format validation, not full server-side image decoding.
- Native browser image decoding applies orientation once. If HEIC is unsupported, lazy `heic-to/csp` decodes its primary image in a browser worker and applies the container's transformations. No second EXIF rotation is applied to the decoded pixels.
- One JPEG preview is flattened upright, maximum 768 pixels and quality 0.8. White is used behind transparent input. Bitmaps and per-photo canvases are released after use. The HEIC decoder worker is shared by the dependency for the page lifetime. No full-size JPEG intermediate is persisted.
- R2 retains the immutable original plus its preview. D1 stores their URLs and small metadata. The API will not create a HEIC photo record without a ready, owner-owned web-compatible preview. Failed upload/preparation is not shown as completed.
- HEIC previews are used consistently in gallery/detail, Style Lab, browser tones, collages and album exports. Downloads return the original `.heic`. Thus current HEIC creative input is capped at the 768-pixel preview; high-resolution/HDR editing is future work, not claimed here.

## Date rules

Only DateTimeOriginal, OffsetTimeOriginal, Orientation and image dimensions are parsed. GPS and maker notes are not saved in the photo record. Original files can still contain their original metadata, including GPS.

1. A valid EXIF capture time plus valid numeric offset is retained as `capturedAt` and `capturedLocal`. Existing Hong Kong library-calendar grouping applies to that known instant (`dateSource=captured`).
2. A valid capture time without a valid offset is retained as an unzoned `capturedLocal`. Its local calendar day is used unchanged (`dateSource=captured-local`); detail UI explicitly says timezone unknown. Browser timezone, GPS and guessed location never supply an offset.
3. Missing/invalid capture time falls back to file modification day in the Hong Kong library calendar. DateTimeDigitized is not treated as capture time. Metadata parser errors add a visible metadata-unavailable indication; they are not silently labelled as capture-time success.

Existing photo rows and manual albums are not migrated or rewritten. Future changes can improve time policies without replacing original files. Migration 0005's previously recorded historical Hong Kong DST backfill limitation remains a separate deferred item.

## Evidence

Local Node/API tests cover canonical format recognition, rejection of sequence/spoofed files, exact HEIC bytes/private downloads, required preview, capture-local persistence, offsets, invalid dates, real iPhone metadata and direction6 fixtures. The existing nine generated-sample provenance checks remain in the suite.

Local browser/Workers observation (2026-11-03): imported `iphone-exifr.heic`, `exifreader-test.heic`, `portrait-orientation-6.jpg`. The iPhone appears in August 2019 with timezone explicitly unknown; direction6 HEIC has an upright 576×768 preview. Download SHA-256 equals fixture `4ea589f9728e7e3c08060473ffde0189719a1810550571de693d743e1bf86292`. HEIC renders in Style Lab, tone save and collage. This is local simulation, not production evidence. Final suite: 52/52, TypeScript and both builds pass; the local real Workers smoke also passed.

Hosted acceptance (2026-11-03, application commit `59d39ba`): imported the same three public samples into the existing owner-private Site (18→21 records). D1 retains exactly the expected capture-local/file-modified sources and one original plus preview URL per sample. The direction6 HEIC preview is 576×768; JPEG direction6 preview is 512×768. Downloaded original HEIC hash equals the fixture. Reload preserved August 2019 grouping and photos. Both tested original-file requests without user identity returned 401. Exact before/after comparison of all three manual album rows is unchanged. GitHub remains private. [Machine-readable evidence](evidence/2026-11-03-heic-import.json). No claim is made about new-provider image-edit inference or native Safari testing.

Public sample coverage is deliberately bounded: this does not establish every iPhone generation, Safari/iOS version, HDR/gain-map fidelity or damaged-container compatibility. Native-browser and decoder behavior vary by device.
