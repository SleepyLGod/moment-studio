# Moment Studio

A photo workbench for browsing, organizing and reimagining a personal library.

| Edition | What you can try | Where the data lives |
| --- | --- | --- |
| [Public demo](https://sleepylgod.github.io/moment-studio/) | Browse sample photos, make albums and collages, and try pre-generated Style Lab examples | Your browser only |
| Private workspace | Upload originals, organize photos, edit with your OpenAI subscription and manage Trash | Owner-only Sites app, with D1 metadata and R2 files |

Both editions share the React interface. The demo loads bundled examples and can import files into the current browser. It has no live AI generation or connection to the private library.

![Library preview](docs/screenshots/library.png)

## Private workspace

- **Library:** Import still HEIC, JPG, PNG or WebP, up to 12 MiB per file and 20 files per batch. Browse by month, use AI tags and recent groups, or organize manually. Manual albums are edited independently of automatic grouping.
- **Style Lab:** Choose originals, write a prompt and save a reusable Style. The connected OpenAI cloud task edits an upright preview and saves the result separately. Collages and tone adjustments render in the browser.
- **Trash:** Restore photos or select several and review permanent deletion. Photos with album or creation references stay in Trash. A result lists what was deleted and why each remaining photo was kept. Trash is cleared only by explicit action.
- **Settings:** Set the thumbnail size for this browser and check the OpenAI cloud connection.

Original uploads are immutable and downloadable in their original format. The browser creates one upright JPEG preview up to 768 pixels. Capture dates use EXIF when available and fall back to the file modification date. See [import behavior](docs/development/heic-import.md) for metadata details.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev:demo
```

The local demo opens at `http://127.0.0.1:4173/`. Run `npm run check` for tests, TypeScript and both builds. To run the cloud app against local D1/R2 or publish either edition, follow [Deployment](DEPLOYMENT.md).

## Project docs

- [Deployment](DEPLOYMENT.md) covers GitHub Pages, owner-private Sites and local storage simulation.
- [Developer index](docs/development/README.md) links to architecture, current contracts and dated evidence.
- [Assets and credits](docs/ASSETS.md) documents bundled samples and fonts.
- [Later work](TODO.md) tracks open work, including export/restore and import options.
