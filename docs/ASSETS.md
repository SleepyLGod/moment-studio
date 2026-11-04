# Assets and development tools

- `public/photos/credits.json` retains the source URLs and photographer credits for the Lorem Picsum / Unsplash examples.
- `public/photos/fjord-demo.png` and the nine files in `public/styles/` are AI-generated demonstration assets. Adjacent provenance JSON retains prompts and source references. Machine-local paths have been replaced with portable references; generated-image references identify external generation records, not files included in this repository.
- `public/fonts/SleetMono-Regular.ttf` comes from https://github.com/Case3y/sleet-mono. Its MIT license is included alongside it.
- Runtime packages and their dependency licenses remain managed by npm and package-lock.json.
- `exifr@7.1.3` reads selected capture-time, dimensions and orientation tags only (MIT). `heic-to@1.6.7` provides the lazy browser-only CSP decoder (LGPL-3.0, libheif-based). Unmodified upstream runtime libraries are bundled separately by Vite; licenses are served at `/legal/exifr-LICENSE.txt` and `/legal/heic-to-LICENSE.txt`. Corresponding source: https://github.com/MikeKovarik/exifr and https://github.com/hoppergee/heic-to ; exact npm distribution: https://registry.npmjs.org/heic-to/-/heic-to-1.6.7.tgz . No decoder is executed by the Sites server.
- `tests/fixtures/import/SOURCES.json` pins the public compatibility fixtures, hashes, source repositories and accompanying licenses. Fixtures are used for tests, not bundled as public photo/demo assets. They are not user photos.
- Design tools are optional. `.agents/skills/installed.json` records upstream sources and revisions of the project-local Taste and Impeccable skills. Their local copies are excluded from this source repository. No design skill is required to install, build or run the application.

The original application source and documentation are under the [MIT License](../LICENSE). Photos, generated examples, screenshots, fonts, and third-party code retain their own terms. The MIT license does not grant rights to those assets.
