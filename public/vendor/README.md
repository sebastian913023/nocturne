# public/vendor

`three-0.186.1.min.js` is a tree-shaken, minified ESM subset of [three.js](https://threejs.org) r186
(MIT, see `three-LICENSE.txt`), vendored so the app keeps its no-build-step frontend and its
`script-src 'self'` CSP. It is loaded lazily by `public/js/scene3d.js` via dynamic `import()`.

Rebuild (one-off tooling, not a project dependency):

    npm i three@0.186.1 esbuild
    # entry.js re-exports the symbols listed in scene3d.js's THREE usage, then:
    npx esbuild entry.js --bundle --minify --format=esm --target=es2020 --legal-comments=none \
      --outfile=three-0.186.1.min.js
