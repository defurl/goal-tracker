# 10 — Tech Stack & Engineering Contract

> The versions below are what the room was built and tuned against. R3F's API
> surface moved between major versions — if you upgrade, expect to re-verify
> the lighting and the `<Html>` label behaviour.

---

## 1. Runtime dependencies

| package | version | why |
|---|---|---|
| `react` / `react-dom` | `^18.3.1` | R3F 8.x targets React 18 |
| `three` | `^0.169.0` | the renderer |
| `@react-three/fiber` | `^8.17.10` | React reconciler for three |
| `@react-three/drei` | `^9.114.0` | `<Html>` (in-world labels), `GradientTexture` (screen glow) |
| `@react-three/postprocessing` | `^2.16.3` | `EffectComposer` + `Bloom` |
| `zustand` | `^5.0.0` | two tiny stores, `getState()` reads inside `useFrame` |
| `react-router-dom` | `^6.27.0` | one route per scene, lazily loaded |
| `tone` | `^15.0.4` | ambient audio engine |
| `@fontsource/fraunces`, `@fontsource/geist-sans` | `^5.0.0` | self-hosted display + body faces |
| `marked` | `^14.0.0` | markdown content → panel HTML |

**Drei usage is deliberately minimal** — two components. Everything else in the
room is hand-built primitives. No model loaders, no GLTF, no physics, no
`OrbitControls`. Keep it that way unless a mechanic forces otherwise.

## 2. Build and tooling

- **Vite 5** + `@vitejs/plugin-react`, TypeScript 5.6 (`tsc --noEmit` in CI)
- **pnpm 9**, Node pinned via `.nvmrc`
- ESLint 9 flat config + `eslint-plugin-react` / `react-hooks`, `--max-warnings=0`
- Husky + commitlint (conventional commits) on `commit-msg` / `pre-commit` / `pre-push`
- Lighthouse CI (`@lhci/cli`) with asserted budgets
- `axe-core` + Playwright for an a11y smoke test
- Playwright also drives **state capture** — scripted screenshots of every
  scene state into `captures/checkpoint-*/`

### Custom scripts worth porting
| script | purpose |
|---|---|
| `lint:colors` | fails the build on any hex literal outside the token palette |
| `bundle:check` | asserts the initial JS budget (portfolio shipped at 69.4 KB gz) |
| `a11y:check` | axe-core smoke over the rendered routes |
| `capture:states` | Playwright screenshots of every named scene state |
| `lh:check` | Lighthouse CI autorun |

`lint:colors` and `capture:states` are the two that kept the design honest
across five phases. Port both on day one — the colour lint stops drift, and
scripted captures give reviewers a diffable visual record instead of "looks
fine on my machine".

---

## 3. Performance budget

| metric | target |
|---|---|
| FPS, desktop | 60 |
| FPS, mobile | 45 |
| initial JS | ≤ 200 KB (portfolio achieved 69.4 KB gz) |
| LCP | ≤ 2.5 s |
| Lighthouse performance | ≥ 85 |

Rules:
- **Lazy-load each scene.** Do not preload a deep scene from the entry scene.
- Use **instanced meshes** for anything repeated (buildings, and in the new
  project: leaves, task nodes, calendar cells). One draw call per type.
- **Reuse geometries and materials**; clone with new transforms.
- Texture atlases over individual textures; KTX2/Basis where possible.
- **Cap `dpr` at 2** even on retina. Offer a "high fidelity" opt-in toggle
  rather than defaulting up.
- Mobile disables bloom by default.

---

## 4. Architecture shape

```
src/
  routes/          one route per scene; each mounts its own <Canvas>
  scenes/<name>/
    <Name>Scene.tsx      lights + objects + rig, no DOM
    lighting.ts          exported light constants, commented against the plan
    cameraPoses.ts       REST + per-object focus poses
    CameraRig.tsx        useFrame-only, renders null
    InteractiveObject.tsx  the shared interaction wrapper
    objects/*.tsx        one file per prop, pure geometry + material
    postfx/*.tsx         gated effect passes
  overlay/         DOM panels and corner controls (CSS modules)
  lib/
    style/colors.ts      palette mirror #1 (TS)
    stores/*.ts          zustand
    motion/              reduced-motion hooks
    perf/                useAdaptiveFps
  styles/
    tokens.css           palette mirror #2 (CSS)
    globals.css          resets, fonts, grain
design-spec.jsonc        palette mirror #3 — the contract
lighting-plan.svg        the visual lighting contract
```

Three conventions that make this work and should be preserved:

1. **Lighting constants live in their own file**, exported, with a comment on
   every value explaining *why* it differs from the plan. When a value gets
   tuned, the reason is recorded next to it. This file is the single most
   valuable artefact in the whole project.
2. **A visual spec document outranks prose.** `lighting-plan.svg` is a top-down
   plan with coordinates, ratios, a material table and a five-item acceptance
   test. It supersedes any prose brief. Make an equivalent for any new scene.
3. **One file per object**, pure geometry and material, no state. Interaction is
   injected by the wrapper from outside.

---

## 5. Content pipeline

Content is markdown + JSON on disk, loaded and rendered with `marked` into the
DOM panels. Some content is fetched at build time by prebuild scripts and
committed as generated JSON. Nothing in the 3D layer reads a CMS at runtime.

For the habit tracker this will invert — habit data is user-owned and live —
but keep the principle: **the 3D scene reads from a store, never from the
network.** A data layer writes into the store; the scene observes it inside
`useFrame` via `getState()`.
