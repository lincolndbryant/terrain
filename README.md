# terrain

Procedural 3D terrain built with React Three Fiber and Three.js.

## Live demos

- **Playground** — [lincolndbryant.github.io/terrain](https://lincolndbryant.github.io/terrain/) — camera + biome switcher (earth / mars / ocean floor), fog and view-distance sliders.
- **Gizmo Golf** — [lincolndbryant.github.io/terrain/golf](https://lincolndbryant.github.io/terrain/golf/) — physics-based game on top of the terrain lib.

## Workspace

- `packages/terrain` — `@ourizon/terrain`, the reusable terrain mesh, noise, strategies, and keyboard camera. Rapier-based `TerrainCollider` is behind the `@ourizon/terrain/physics` subpath.
- `apps/playground` — minimal viewer app.
- `apps/gizmo-golf` — game app consuming the terrain lib.

## Development

```bash
pnpm install
pnpm run dev:playground   # http://localhost:7777
pnpm run dev:golf         # http://localhost:7778
pnpm run build            # build both apps
```
