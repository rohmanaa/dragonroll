# Final RPG FX Architecture Audit

Audit date: 2026-11-17  
Repository: `rohmanaa/dragonroll`  
Branch: `restruktur-fx`  
Phase 6 baseline: `ae1f824c2c817b74040a5d27b00c944c4e05f59c`

## Architecture and module ownership

No replacement FX engine or duplicate manager was introduced. Presentation is divided among the existing modules:

| Module | Responsibility |
|---|---|
| `gameplay/js/fx.js` (`UT.GameplayFX`) | Three.js gameplay FX, device quality and particle caps, L1-L4 count multiplier, seeded spatial effects, cue identity/dedup, tracking, natural completion, stop/stop-all, and shared-resource disposal. |
| `gameplay/js/particle-fx.js` (`UT.ParticleFX`) | DOM/CSS burst particles. One delegated `animationend` listener removes nodes and completes tracked groups. |
| `assets/js/renderers/aura-fx.js` (`UT.AuraFX`) | Existing aura catalogs, shaders, particle system, aura quality presets, and reduced-motion behavior. |
| `assets/js/renderers/aura-view.js` (`UT.AuraView`) | Attaches/updates/clears aura systems on existing character roots. |
| `assets/js/renderers/power-3d/` | Existing Power model, material, aura, animation, lighting, and particle pipeline. `power-config.js` owns its quality/rarity profiles; `power-renderer.js` owns that preview pipeline and its lifecycle. |
| `gameplay/js/audio.js` (`UT.GameplayAudio`) | Existing native SFX playback, configured fallbacks, mute/volume, ready gate, and audio helpers. |
| `gameplay/js/main.js` | Connects FX to actual gameplay events and the existing animation/multiplayer loops. It does not send particle instances. |

World, Dragon, mob, and transition presentation also uses existing local pools and update paths in gameplay. No new per-particle timer or second gameplay render loop was added.

## Implemented category coverage on this branch

- FX core: global tracking, quality caps, seeds, multiplayer cue identity/dedup, disposal.
- Spatial: teleport, Ender Hole/Swap layers, portal, and spatial distortion.
- Combat: sword slash/trail/release, supported projectile and impact feedback, damage/hit, shield/totem defense.
- Character: the existing 15 registered aura catalog entries and supported shield/buff feedback.
- Reward/UI: reward bursts for supported reward/claim events, chest feedback, button press, existing turn/dice/modal/notification feedback, victory and defeat feedback.
- Environment: active World/Nether and Dragon-boss ambient/transition feedback.
- Audio: existing gameplay SFX and menu reward UI sounds, using their respective existing audio modules.

**Known Phase 4 coverage gap:** only Phase 4.1 has a report and commit. Phase 4.2 Elemental FX and Phase 4.3 full Summon/Mob/Boss FX have no reports/commits on this branch and are not claimed as implemented. Existing combat hit/Dragon effects are not equivalent to the missing Phase 4.3 spawn/entrance/despawn set.

## Lifecycle and cleanup

- `GameplayFX` effects are tracked as `created -> playing -> stopping -> disposed`; natural completion untracks without running stop cleanup a second time.
- Reset and `stopAll` remove tracked visual effects; hidden-tab handling stops visual work; `pagehide` disposes owned listeners and shared FX resources, while BFCache keeps the relevant page instance alive.
- Shared Three.js geometries/materials are reused where their appearance is identical and disposed by their owner. Per-effect materials are removed/disposed when the effect ends. Confetti/explosion particles use shared resources; spatial controls dispose their owned materials.
- `ParticleFX` tracks groups, enforces per-quality total/burst limits, and removes all nodes on completion, clear, stop, and dispose.
- Aura and Power renderers retain their own update/stop/dispose ownership; Power overlay timers are cleared when stopped.
- Cue identity and cue logs are bounded: 256 recent cue IDs, 256 sender-session epochs, and 64 entries each for cue logs and lifecycle history.
- Phase 6 added the missing bound to `cueEpoch`; the stale-epoch guard is therefore retained for the most recent 256 sender sessions, not an unbounded lifetime set.

## Quality, complexity, and Reduce Motion

### GameplayFX / ParticleFX

`GameplayFX` keeps device quality separate from item tier:

| Device profile | Three.js active particle cap | DOM total / burst cap |
|---|---:|---:|
| Low | 120 | 40 / 12 |
| Medium | 220 | 60 / 20 |
| High | 320 | 100 / 30 |
| Ultra | 450 | 150 / 45 |

The core L1-L4 count multipliers remain 0.4, 0.8, 1.3, and 2.0. Reduce Motion applies a separate count reduction; important static/low-motion feedback remains available.

### Power-3D and Aura

- Power-3D now has Low/Medium/High/Ultra profiles and auto-detection for all four levels. Its bounded particle caps are 500/1200/2500/3000. Existing effect rarity uses tiers 1-6, not the core L1-L4 labels.
- AuraFX has Low/Medium/High/Ultra profiles and reads reduced motion live. The 15-entry aura catalog uses its existing rarity metadata (not a separate L1-L4 field).
- The specialized rarity systems were preserved rather than rewritten or silently remapped. Thus the core L1-L4 contract is verified, but tier labels are not normalized across every legacy renderer.

Reduce Motion is read live by `GameplayFX` and AuraFX. Phase 6 changed gameplay's legacy snapshot to follow the media-query `change` event and removes that listener on non-BFCache `pagehide`; BFCache retains it. Reduced motion limits motion/counts and avoids intense animation while existing static status feedback stays readable.

## Multiplayer and audio

- FX cues remain small primitive data with fid/seed/position/style; the receiver builds local visuals. No particle arrays or Three.js objects are sent.
- Existing duplicate/stale cue rejection, legacy cue compatibility, and host/guest visual routing are preserved and tested.
- Gameplay audio remains `UT.GameplayAudio`; volume/mute and `MP_SFX_GAIN` are existing paths. No audio engine, gain rule, or new synthesized fallback was added.
- Audio audit found 48 unique referenced paths: 43 present and five optional Power files absent: `powerup/feather.mp3`, `powerup/golden-apple.mp3`, `powerup/shield-up.mp3`, `powerup/diamond-sword-use.mp3`, and `powerup/netherite-sword-use.mp3`. Existing fallback behavior remains; no filenames/assets were invented.
- The game-over/claim UI outside gameplay also uses its existing `UT.Audio` wrapper. Summon audio cannot be verified because the requested summon FX event set is absent.

## Performance and memory findings

- 3D active particle allocations are bounded by device quality; DOM particles use a separate bounded pool. Power-3D has its own cap and reuses a single preview renderer.
- Common particle geometry/materials and renderer systems are reused. Effect-owned resources and listeners are disposed along their existing lifecycle paths.
- The cue epoch cache was the one confirmed unbounded FX structure found during this audit; it is now FIFO-bounded at 256 sessions.
- Sparkle still creates a material per particle because each particle has independent opacity/fade. Sharing one mutable material would make concurrent particles overwrite one another's opacity and change their fade behavior. Materials are disposed with their particles; no visual-quality regression was accepted to remove that bounded allocation.
- Automated harnesses cover count limits, natural/forced completion, reset/game-over, tab visibility, dedup, and cleanup. No browser heap profile, FPS measurement, or Android device benchmark was available, so runtime memory/performance is not certified.
