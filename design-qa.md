# Prompt Style Lab — design QA

Date: 2026-11-02
Scope: clickable local prototype, approved prompt-driven Lab extension.
final result: passed

## Visual authority and evidence

- Approved design: workspace outputs/prompt-style-lab/concept.png.
- Actual CUA browser captures: outputs/prompt-style-lab/implemented/desktop.png, desktop-full.png, tablet.png, mobile.png, mobile-320.png, batch.png.
- Mandatory combined comparison: target-vs-browser.jpg (target left, browser right; both normalized to 720 × 512 for comparison). Original captures are retained.
- Focused text/controls review: prompt-detail.png. All nine generated assets inspected in sample-sheet.jpg; rows are paper / clay / comic and columns are fjord / city / coffee.
- The old QA report is preserved as implemented/previous-design-qa.md.

## Design comparison

- Layout: preserves the approved photo-dominant composition, full-width comparison, description below, primary preview action at right, saved Styles at the bottom. Shared outer edges and the three primary destinations remain.
- Typography: system Chinese UI face retained; distinct heading / description / metadata scales; text fields use 16px. Saved labels wrap without colliding; tablet cards switch to a vertical image/title arrangement.
- Spacing: image/editor/Style list share canvas edges. Source-photo strip and explicit example status add a deliberate row absent from the concept. Reference image and basic color controls remain secondary disclosures.
- Palette: green charcoal, bone white, muted green-gray and one olive-gold primary action. No decorative gradient/glow. Existing dialog/dock/toast elevation is retained for overlays.
- Images: all nine assets are actual pre-generated image edits. Composition and scene remain recognizable; handcrafted material and comic linework change visibly. Generated details can differ from the source; these are illustrative outputs, not deterministic guarantees.
- Icons: one Lucide outline family; save/reference/batch/close controls have names or visible labels.
- Content: “预览示例”, “预生成示例”, “待生成” replace the concept's live generation wording to reflect the approved example-only mode. This is intentional product truth, not a missing live service.

## Functional observations

- Paper / clay / comic selection loads distinct image assets. City and coffee source selection use their corresponding output, not a recolored fjord.
- Comparison range responds to keyboard arrows (38 → 39 observed).
- Editing a prompt or preservation/reference requirement immediately removes an incompatible result and disables saving it as an image. No fake generation timer is used.
- A custom prompt and unchecked preservation setting were saved, page reloaded, Style loaded again: exact text and false setting restored, with no generated image.
- A local sample reference image was uploaded, saved in a Style, reloaded and reopened: filename 1060.jpg and local data image restored; preservation true; no generated result asserted.
- Saving a matching named Style retains an example cover. Selection highlights only its own ID, so an equivalent saved recipe does not mark multiple cards active.
- Batch preview shows source/result pairs. Three supported photos yielded three separate creative records: gallery 17 → 20. Original records remain, and original toggle resolves to /photos/fjord-demo.png.
- Mixed selection correctly shows 3 / 4 available, with the unsupported mountain photograph marked “暂无示例，保留原片”.
- Repeating the same save reports that the results already exist, without adding duplicates.
- Basic color adjustment on a generated paper image produces a JPEG of the paper image. Returning to its unadjusted base restores /styles/paper-fjord.png. The source photograph and generation base remain separate.
- Upload dialog opens and closes with its existing example/file controls. Collage still renders a real data:image/jpeg preview. Existing classification/album flows were preserved; this pass did not repeat their earlier full QA.
- Escape closes native dialogs; keyboard Tab reaches a visible 2px focus ring.

## Responsive and accessibility checks

CUA desktop 1440 × 1024, tablet 768 × 1024, phone 390 × 844 and narrow phone 320 × 800.

- No horizontal page overflow observed. At 320 CSS width the document client/scroll widths both equal 309 (scrollbar consumes the remainder); source strip client/scroll widths both equal 178 after correction.
- Batch dialogs also had equal client/scroll widths at 390 and 320; action buttons stayed reachable.
- Long custom names and multi-line prompts wrap. Phone prompt has 144px minimum height to keep the built-in description readable.
- Computed color checks: body 14.23:1, primary action 7.78:1, prompt 12.66:1, status 8.35:1.
- Current Lab images all complete with nonzero natural width. Browser captured error/warning log was empty.
- No exhaustive screen-reader, browser-zoom, forced network-failure or cross-browser audit is claimed.

## Fix history

- P1: Old filter-first Lab did not represent prompt-based image recreation. Replaced with genuine pre-generated edits plus explicit pending states for unmatched input.
- P1: Preserve original/generated records separately; retain generation base through secondary color adjustment and reset.
- P2: Ambiguous static/live action wording changed to example preview and status.
- P2: Equivalent saved recipe could highlight two cards; active ID now selects one.
- P2: Narrow tablet metadata wrapping corrected with vertical cards.
- P2: A 1px overflow produced a photo-strip scrollbar at 320; strip width corrected and measured again.
- P2: Mobile prompt was cramped; increased field height and inspected again.
- P2: Image retry now remounts the failed asset; loading is labeled as image loading, never model generation. Retry handler is implemented; a forced failure was not exercised.

No remaining P0/P1/P2 findings for the approved prototype scope.

## Checks and limits

- npm run build passed. Vite retains the existing dependency “use client” directive warnings from lucide-react.
- node scripts/check-style-samples.mjs passed: nine asset/provenance pairs, exact recipe eligibility, unsupported/custom input exclusion, immutable originals and generation-base retention.
- git diff --check passed.
- Impeccable 4.8.0 engine context and one mechanical detect run completed; detector returned []. It is defect evidence, not a visual pass by itself.
- Taste app lint returned 0 FAIL / 3 WARN. The three warnings concern existing shadows on the floating selection dock, native dialog and toast; retained as real overlays. Its browser inspector was replaced by CUA observations to follow this session's browser-control requirement.
- No new visual draw: this is a scoped component extension with an approved direction; Taste's component exception preserves that direction. UI UX Pro Max is an existing manually invoked reference.
- Skills installed only within project .agents/skills, revisions recorded in installed.json; global installation and automatic hooks were not changed.
- No real gallery connection, cloud sync, live arbitrary-prompt generation, model billing, production storage or tens-of-GB capacity claim. Current state is browser-local. Previous cloud Site has not been redeployed.

## Subsequent English Lab pass

The English type/density pilot supersedes the Lab visuals above. See workspace outputs/english-lab/qa.md, desktop.png and mobile.png for current scope, findings and browser evidence. Existing flow checks above remain historical evidence.

## Shared English workbench pass

The application-wide English/font unification supersedes the earlier Lab-only scope. Current evidence and validation are in workspace outputs/english-workbench/qa.md. Result: passed for this prototype refinement.
