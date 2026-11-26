# Items

The stage select's **Items** rule sets `MatchConfig.items` (`resolveMatch`, `src/session/setup.ts`). With it on,
`stepItems` (`src/sim/items/spawn.ts`) runs once per frame, after the fighters and the stage move and before
entities do. Items are entities (docs/fighters.md, "Entities and projectiles") registered as `item/<name>` with
`registerEntity`. They are plain data in `MatchState.entities`, so replays and state hashes cover them. All their
randomness comes from the match RNG (`MatchState.rng`). With the rule off, nothing in `stepItems` runs and the RNG
is never drawn from, so matches without items play exactly as before. With it on, a two-player match doesn't get the
1v1 damage multiplier (x1.2 damage taken), as in Ultimate (`addDamage`, docs/physics-reference.md section 2).

The Coolmath Planet is the only item so far.

## Spawning

Ultimate's item timer and Smash Ball rules (SmashWiki, Item Switch and Smash Ball):

| Value                       | Ultimate                                              | Here                    |
| --------------------------- | ----------------------------------------------------- | ----------------------- |
| Item timer (Medium)         | 500 to 800 frames between items                       | `ITEM_TIMER`, uniform   |
| Smash Ball chance per timer | 10% x 1.625 (Medium compensation) x early-game factor | `planetChance(frame)`   |
| Early-game factor           | frames since the starting lockout / 6660, capped at 1 | linear over 6660 frames |
| Starting lockout            | 900 frames                                            | 900 from frame 0        |
| Later lockout               | 4800 frames after a Smash Ball leaves play            | 4800                    |
| While one is out or held    | no new Smash Ball                                     | same                    |

When the item timer runs out and the planet's roll fails, Ultimate spawns another item. There are no other items
yet, so nothing spawns. The planet appears at one of the stage's respawn points, chosen at random (they are open
air on every stage). Frame 0 is the start of the "3, 2, 1" countdown, so the 900-frame lockout ends 720 frames after
GO!. Over seeds 1 to 20 on Battlefield with nobody moving, every seven-minute match had 2 to 4 planets, and the
first one appeared between frames 1782 and 10884.

## The Coolmath Planet

`src/sim/items/planet.ts`, kind `item/coolmath-planet`, the game's Smash Ball.

- **HP.** 40, as a fresh Smash Ball in Ultimate. It loses 2 HP every 60 frames on its own until it has 2.5 or less,
  so an untouched planet is down to 2 HP after 1140 frames.
- **Lifetime.** 1320 frames (22 s). Then it leaves with `entityDestroy` reason `expired`. It blinks for its last 90
  frames.
- **Movement.** No gravity. Every 120 frames it picks a spot up to 40 units to either side of the trailing fighter
  (fewest stocks, then most damage) and 24 to 40 units above them, and drifts there at up to 0.6 units per frame
  with a small bob. It bounces off floors, platforms and walls. SmashWiki gives no speed for the Smash Ball, so
  these numbers are tuned by eye.
- **Hits.** It belongs to nobody, so every fighter's attacks and every owned projectile can hit it, once per move.
  It shares hitlag with the attacker and is launched by Ultimate's knockback formula at weight 100. Damage is not
  staled, and Ultimate's KO-score damage multiplier is not applied.
- **Breaking it.** The hit that takes its last HP gives the attacker's port the charge: `FighterState.finalReady`
  becomes true and a `finalReady` event follows the `entityDestroy` (reason `broken`). The holder glows with a
  shifting rainbow aura and three sparkles (`drawFinalGlow`, `src/render/items.ts`).
- **Losing the charge.** A KO clears `finalReady`, as in Ultimate, and starts the 4800-frame lockout.

Neutral special while it is set plays the fighter's Final Smash and clears the flag (docs/fighters.md, "Final
Smash"); `stepItems` then starts the 4800-frame lockout on the same frame.

## Pickup

`EntityDef.pickup` makes an entity an item that fighters pick up. Standing or walking, Attack without a smash input
picks up the first item in spawn order that rests on the stage and touches the fighter's hurtbox. That replaces the
jab or tilt (`pickUpItem`, `src/sim/items/pickup.ts`). The item's `pickup(m, f, e)` runs, an `itemPickup` event is
emitted, and the item leaves with reason `pickup`. Items take effect when picked up, like Ultimate's Maxim Tomato.
Holding, throwing and dropping items are not built yet. The planet is broken, never picked up.

## Not built yet

- Ultimate's Final Smash Meter, and Final Smashes for the roster (the framework and its test fighters are in).
- Items other than the planet, and the item list and frequency settings.
- Ultimate's heavy Smash Ball that rolls along the ground, losing the charge to a strong hit, glancing hits that push
  the ball without damaging it, and the damage multiplier from KO score.
- CPU players ignore the planet.
