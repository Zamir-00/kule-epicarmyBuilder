![CI](https://github.com/Zamir-00/kule-epicarmyBuilder/actions/workflows/ci.yml/badge.svg)

# Epic Army Builder

A Net-EA / Epic 40K army builder — fork of the classic Prototype.js-era web app, being modernised toward a clean data layer, a JSON API backend, and a new frontend.

## Background

want to add in unit cards so its easyer to see what you are making for the armybuilder, only netea

## Quick local setup

1. Clone the repo.
2. Start a local server from the repo root:
   ```
   python3 -m http.server 8080
   ```
3. Open `http://localhost:8080/war/indexNETEA.html` in your browser.

No npm install or build step needed — the project is plain JS served as static files.

## Running tests

```
node --test tools/test/loader.test.js
node tools/inventory-factions.js
```

## Links

- [ROADMAP.md](ROADMAP.md) — stage-by-stage plan and open stories
- [docs/design/data-model.md](docs/design/data-model.md) — data model and loader API
