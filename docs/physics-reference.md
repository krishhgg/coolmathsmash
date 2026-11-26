# Coolmath Smash physics reference

Baseline: **Super Smash Bros. Ultimate v13.0.1** (final patch), compared with Brawlhalla and MultiVersus. Every number below has a source link. Where sources disagree, both values are given and one is picked with a reason (summary in section 21). Values marked **ESTIMATE** or **PROPOSAL** are the researcher's own work, not measured game data.

Companion file: `physics-constants.json` (same folder). It holds the same numbers in machine-readable form. Every object with numbers in it has a `_source` key that points into its `sources` map, and the test vectors are reproduced exactly by the script in section 23.

## 0. How to use this

- **Physics tests.** Load `physics-constants.json` in your test runner and assert that your implementation reproduces `knockback.test_vectors` (KB, hitstun, launch speed, vx/vy, speed-up), `hitlag.test_vectors`, `shield.shieldstun.test_vectors`, `launch.sakurai_angle.test_vectors`, `hitstun.speedup_balloon_knockback.test_vectors`, `rage`, `ledge.intangibility_test_vectors`, `grab` and `shield_break`. Floats should match to 1e-6. Frame counts should match exactly.
- **Feel tests.** Section 20 lists acceptance checks: airtimes, dodge frames, ledge rules and so on. A judge panel can score the game against them.
- **Units.** 1 Smash unit (u) is about 1 decimetre from Melee onward ([SmashWiki: Distance unit](https://www.ssbwiki.com/Distance_unit)). Speeds are u/frame and accelerations are u/frame² at **60 fps**. Map units to pixels with section 1.

## 1. Frame rate, coordinates and pixel mapping

- Fixed timestep: **60 fps**. All frame counts assume 60 updates per second. Ultimate's frame data (UFD, SmashWiki, param dumps) is all in 60 fps frames.
- World axes: +x right, +y up. Stage surfaces sit at y = 0 on Battlefield and Final Destination ([calc stage data](https://github.com/rubendal/SSBU-Calculator), Data/Stages/ssbustagedata.json, commit 233590e).
- **PROPOSAL, pixel mapping:**
  - **1280×720 canvas:** scale **3.0 px/u**, world origin (0,0) at pixel **(640, 435)**. Use px = 640 + 3x and py = 435 − 3y. The visible window is x ∈ [−213.3, 213.3] u and y ∈ [−95, 145] u.
  - **1920×1080 canvas:** scale **4.5 px/u**, origin at **(960, 652.5)**. This is the same framing.
  - **Why it fits Battlefield:** Battlefield's camera box is x ∈ [−170, 170] and y ∈ [−80, 130] (calc stage data). That is 340×210 u, which maps to 1020×630 px and sits inside 1280×720 with margin. The main stage (−80…80) is 480 px wide (x 400…880 px) with its top at y 435 px. Side platforms (y 24.119) sit at py 362.6, at px 461.7…565.6 and 714.4…818.3. The top platform (y 47.189) sits at py 293.4, px 588.1…691.9. The underside bottom (y −40.1) is at py 555.4.
  - **Blast zones:** at ±240, 192 and −140 they map to px −80…1360 and py −141…855. They are off-screen, as in Smash, where KOs happen beyond the camera. Use off-screen indicators.
  - Final Destination's camera (±180, −60…130) and Smashville's (−159…160, −50…140) also fit at 3 px/u.
- **ESTIMATE, fighter size:** no source gives per-fighter hurtbox or body dimensions (see section 22). Mario's full-shield radius is 9.7 u (calc fighter data), and a full shield covers the body, so a Mario-sized fighter is under about 19 u tall. 15 u (45 px at 3 px/u) is a reasonable starting height. Tune it against reference frames.

## 2. Knockback

Formula, Melee onward ([SmashWiki: Knockback](https://www.ssbwiki.com/Knockback); same as [SSBU-Calculator js/formulas.js](https://github.com/rubendal/SSBU-Calculator) `VSKB`):

```
kb = ((((p/10 + p*d/20) * 200/(w+100) * 1.4) + 18) * (kbg/100) + bkb) * r
p  = target % after the hit = pre_percent + damage * s        (s = stale multiplier)
d  = damage * (1 - (1 - s) * 0.3)                             (Ultimate: d uses 0.3x of staleness/freshness)
w  = target weight (100 for weight-independent hits)
r  = crouch-cancel 0.85 x rage (1.0-1.1) x launch rate x ...
```

- **Constants.** 1.4 and 18 are `reaction_damage_mul` and `reaction_damage_add`. The knockback cap is 2500 (`reaction_max`) and damage caps at 999% ([param sheet, battle_object tab](https://docs.google.com/spreadsheets/d/1UdH2L0xi8dO6jyPCcO5e5-8j7SGzezxkeZuF1uP8uOw)).
- **Set (weight-based) knockback.** Use p = 10 and d = WBKB, so kb = (((1 + wbkb/2)·200/(w+100)·1.4) + 18)·kbg/100 + bkb. It ignores %, staleness and rage ([SmashWiki: Knockback](https://www.ssbwiki.com/Knockback); [SmashWiki: Rage](https://www.ssbwiki.com/Rage)).
- **1v1 multiplier.** In two-player itemless matches, damage *taken* is ×1.2 (param `0x1af80fd893` = 1.2). It changes the displayed %, but the knockback formula uses the un-multiplied damage of the current hit. A move that KOs at 120% does so with or without the multiplier. Hitstun, hitlag and shieldstun ignore it too ([SmashWiki: 1v1 multiplier](https://www.ssbwiki.com/1v1_multiplier)). The calculator does the same: it applies 1.2× only to earlier hits (`preDamage`) and to displayed damage. **All test vectors use `one_v_one_multiplier_applied: false`,** and `pre_percent` is the displayed % before the hit.
- **Crouch cancel.** Knockback ×0.85 (`squat_damage_reaction_mul`) and hitlag ×0.67 (`hit_stop_squat_mul`) (param sheet; [SmashWiki: Knockback](https://www.ssbwiki.com/Knockback)).
- **Short-hop aerials.** Damage ×0.85 (`mini_jump_attack_mul`, param sheet).
- **Rage.** r_rage = 1 + (clamp(attacker %, 35, 150) − 35)/115 × 0.1, so it runs from 1.0 to 1.1. It does not apply to set knockback ([SmashWiki: Rage](https://www.ssbwiki.com/Rage); params `damage_reaction_mul_max` 1.1, `_min_damage` 35, `_max_damage` 150).

**Test vectors** (all generated by the script in section 23 and cross-checked against the calculator's own JS). Speeds are in u/frame. vx and vy are magnitudes on the first knockback frame and include the tumble gravity bonus. "actionable frame (speed-up)" is the real frame the victim can act, after balloon speed-up. "grd" means the target is grounded.

| id | target (w, g) | pre % | dmg | KBG | BKB | angle | stale mult | KB | hitstun | tumble | launch speed | vx | vy | actionable frame (speed-up) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| kb01_low_jab_like | mario (98, 0.087) | 0 | 10 | 100 | 40 | 45 | 1.0 | 66.4848 | 25 | no | 1.9945 | 1.4104 | 1.4104 | 26 |
| kb02_mid_tilt | mario (98, 0.087) | 50 | 12 | 100 | 30 | 45 | 1.0 | 109.3737 | 42 | yes | 3.2812 | 2.3202 | 2.3802 | 37 |
| kb03_smash_100pct | mario (98, 0.087) | 100 | 15 | 100 | 40 | 40 | 1.0 | 196.2323 | 77 | yes | 5.8870 | 4.5097 | 3.8441 | 49 |
| kb04_fox_kill_hit | fox (77, 0.23) | 120 | 18 | 98 | 37 | 45 | 1.0 | 268.5790 | 106 | yes | 8.0574 | 5.6974 | 6.4724 | 67 |
| kb05_bowser_same_hit | bowser (135, 0.125) | 120 | 18 | 98 | 37 | 45 | 1.0 | 215.7770 | 85 | yes | 6.4733 | 4.5773 | 4.8273 | 53 |
| kb06_puff_361_aerial | jigglypuff (68, 0.053) | 80 | 14 | 104 | 34 | 361 | 1.0 | 183.0667 | 72 | yes | 5.4920 | 4.3278 | 3.2712 | 47 |
| kb07_361_grounded_low | mario (98, 0.087) | 0 | 3 | 50 | 20 | 361 grd | 1.0 | 29.5303 | 10 | no | 0.8859 | 0.7087 | 0.0000 | 11 |
| kb08_vertical_upsmash | mario (98, 0.087) | 90 | 17 | 92 | 30 | 90 grd | 1.0 | 178.8077 | 70 | yes | 5.3642 | 0.0000 | 5.3642 | 47 |
| kb09_stale_slots_1_2 | mario (98, 0.087) | 60 | 12 | 100 | 30 | 45 | 0.82455 | 114.0671 | 44 | yes | 3.4220 | 2.4197 | 2.4797 | 38 |
| kb10_fresh_bonus | mario (98, 0.087) | 60 | 12 | 100 | 30 | 45 | 1.05 | 120.7907 | 47 | yes | 3.6237 | 2.5624 | 2.6224 | 39 |
| kb11_crouch_cancel | mario (98, 0.087) | 20 | 8 | 50 | 20 | 45 grd | 1.0 (CC 0.85) | 33.0641 | 12 | no | 0.9919 | 0.7014 | 0.7014 | 13 |
| kb12_rage_150_fresh | mario (98, 0.087) | 100 | 15 | 100 | 40 | 45 | 1.05 (rage@150%) | 218.8728 | 86 | yes | 6.5662 | 4.6430 | 4.7030 | 54 |
| kb13_zero_angle_over_120 | mario (98, 0.087) | 150 | 20 | 100 | 50 | 0 grd | 1.0 | 332.4444 | 131 | yes | 9.9733 | 8.4579 | 5.3451 | 82 |
| kb14_set_knockback | mario (98, 0.087) | 0 | 5 | 100 | 0 | 45 | 1.0 (set KB wbkb 80) | 75.9798 | 29 | no | 2.2794 | 1.6118 | 1.6118 | 30 |
| kb15_heavy_finisher | mario (98, 0.087) | 140 | 22 | 106 | 30 | 40 | 1.0 | 340.4836 | 135 | yes | 10.2145 | 7.8248 | 6.6258 | 85 |

Cross-check: I ran all 15 vectors through the calculator's own `formulas.js`/`knockback.js` in Node. KB, hitstun, tumble, launch speed, vx, vy and speed-up FAF matched to 1e-5 or better. The one reporting difference is kb13: for grounded 0° hits the calculator prints the hitbox angle (32°) instead of atan2(vy, vx) (32.29°). Its vx and vy are identical to ours.

## 3. Hitstun, tumble and balloon knockback

- **Hitstun** = floor(max(kb × 0.4, 5)) − 1. Ultimate always subtracts 1 frame, even for tumble and electric hits; Smash 4 added the frame back ([SmashWiki: Hitstun](https://www.ssbwiki.com/Hitstun); params `damage_frame_mul` 0.4, `damage_frame_min` 5). Flinch hits always deal at least 4 frames.
- **Tumble** starts at 32 hitstun frames before modifiers, which means kb ≥ 80 ([SmashWiki: Tumbling](https://www.ssbwiki.com/Tumbling); param `damage_level3` 32). The flinch animations change at 15 and 21 frames (`damage_level1/2`).
- **Balloon speed-up** applies to tumble hits only, not set knockback. The un-sped first actionable frame (FAF = hitstun + 1) maps to a speed multiplier from 1× to 6× as FAF goes from 30 to 80. That multiplier applies to the first knockback frame and shrinks each frame by (FAF₀·0.3 − faf)/(FAF₀·0.3 − FAF₀). The wiki's examples: 90 KB gives 33 frames of hitstun and 145 KB gives 41 ([SmashWiki: Hitstun](https://www.ssbwiki.com/Hitstun); calc `GetSpeedUpFAF`; params `damage_fly_speed_up_*`: 30, 80, end rate 70, max mag 6, angle rate 100. Angle rate 100 means the launch angle has no effect). Vectors: FAF 30 → 30, 36 → 34, 40 → 36, 50 → 39, 58 → 42, 80 → 50, 100 → 62.
- **Hitstun canceling.** Air dodge from frame 40 if launch speed ≤ 2.5. Aerial from frame 45 if launch speed ≤ 2.0 (calc `parameters.hitstunCancel`; params `damage_fly_escape_frame` 40, `damage_fly_escape_speed` 2.5). The 40 and 45 frame windows themselves are not sped up ([SmashWiki: Hitstun](https://www.ssbwiki.com/Hitstun)).

## 4. Launch

- **Launch speed** = kb × 0.03 u/frame. This separate knockback velocity decays by **0.051 u/frame** along its direction. Air friction is off during knockback, but gravity and fall speed still act on the fighter's own velocity ([SmashWiki: Knockback](https://www.ssbwiki.com/Knockback); calc `parameters.launch_speed`, `decay`).
- **Tumble gravity bonus.** When tumbling at angles outside 70–110°, add vy += 5 × (gravity − 0.075). This launches heavy-gravity fighters faster (Fox +0.775 u/frame, vector kb04) and floaty ones slower (Jigglypuff −0.11, kb06).
- **Vertical launches (70–110°)** get no bonus. Instead the fighter uses fall speed 1.8 and its `DamageFlyTopGravity` during hitstun (Mario 0.074928, Fox 0.067872) ([SmashWiki: Knockback](https://www.ssbwiki.com/Knockback); [SmashWiki: Gravity](https://www.ssbwiki.com/Gravity); calc fighter data; params `fly_top_angle_lw/hi` 1.22173/1.91986 rad).
- **Sakurai angle (361).** On grounded targets it is 0° below 60 KB and 38° at 88 KB or more, linear in between as min((kb−60)/28·38 + 1, 38). Against aerial targets it is always 38° (0.663225 rad) ([SmashWiki: Sakurai angle](https://www.ssbwiki.com/Sakurai_angle); calc `SakuraiAngle`). Vectors: kb 50 → 0, 60 → 1, 74 → 20, 88 → 38, aerial → 38.
- **0° and 180° hits** change to 32° at kb ≥ 120 ([SmashWiki: Sakurai angle](https://www.ssbwiki.com/Sakurai_angle)). Grounded 0° hits below that threshold launch at 0.8× speed (calc; param `damage_angle_ground_zero_speed_mul` 0.8).
- **Meteor (spike) angles** are 230–310° (`meteor_vector_min/max`).
- **DI.** Up to 0.17 rad (9.74°) perpendicular to the launch angle. **LSI** scales launch speed by 0.92–1.095. Both apply only to tumble hits ([SmashWiki: DI](https://www.ssbwiki.com/Directional_influence); calc `parameters.di/lsi_*`).
- **SDI.** Each input moves the victim 2.0 u, with a 4-frame flick window and stick threshold 0.7, at least 4 frames between inputs, up to 16 inputs per hit. Shield SDI is ×0.66 (params `hit_stop_delay_*`; [SmashWiki: SDI](https://www.ssbwiki.com/Smash_directional_influence)).

## 5. Hitlag (freeze frames)

`hitlag = min(floor((damage*0.65 + 6) * hitlag_mult * electric), 30)`, and crouch-cancelling then multiplies it by 0.67 (floored). In Ultimate the 0.67 applies to both the attacker and the victim. The damage used is stale damage; the 1v1 multiplier is not used ([SmashWiki: Hitlag](https://www.ssbwiki.com/Hitlag); calc `Hitlag`; params `hitstop_frame_mul` 0.65, `_add` 6, `_max` 30, `hitstop_elec_mul` 1.5).

- The victim shakes for hitlag×0.75 + 4 frames (`damage_shake_*`).
- **Parry:** the attacker gets +14 frames (max 30), and the defender +11 against direct attacks ([SmashWiki: Perfect shield](https://www.ssbwiki.com/Perfect_shield); param `just_shield_hitstop_frame_add` 0xE).
- **3+ players:** hitlag above 10 frames is scaled down, and the wiki and calculator disagree on the exact form. The vectors below are 2-player.

| id | damage | modifier | hitlag frames |
|---|---|---|---|
| hl01 | 2 | none | 7 |
| hl02 | 5 | none | 9 |
| hl03 | 10 | none | 12 |
| hl04 | 15 | none | 15 |
| hl05 | 20 | none | 19 |
| hl06 | 30 | none | 25 |
| hl07_cap | 40 | none | 30 |
| hl08_electric | 10 | electric 1.5x | 18 |
| hl09_crouch | 15 | crouch-cancel 0.67x | 10 |
| hl10_crouch | 20 | crouch-cancel 0.67x | 12 |
| hl11_mult_1.5 | 12 | hitlag mult 1.5 | 20 |
| hl12_mult_0.5 | 10 | hitlag mult 0.5 | 6 |

## 6. Shields

Shield stats in Ultimate ([SmashWiki: Shield](https://www.ssbwiki.com/Shield) table; param sheet common tab):

- **HP:** 50, and shield damage is ×1.19, so the effective HP is 42.02.
- **Depletion while held:** 0.15/frame (9/s). **Regeneration:** 0.08/frame (4.8/s).
- **Minimum hold** is 3 frames (`shield_min_frame`), and **shield drop** takes **11 frames** (`guard_off_cancel_frame` 0xB). UFD /smash agrees: "Dropping your shield (Shield Drop) takes 11 frames".
- **Size:** radius = fighter shield size × ((HP/50) × 0.85 + 0.15). Fighter shield sizes run from 8.0 to 18.5, Mario 9.7 (calc fighter data).
- **Shieldstun** = floor(damage × 0.8 × t + 3) − 1, with t = 0.725 for smash attacks, 0.33 for aerials (excluding grab aerials and landing hits), 0.29 for projectiles and 1.0 otherwise ([SmashWiki: Shieldstun](https://www.ssbwiki.com/Shieldstun); [BenArthur 1](https://twitter.com/BenArthur_7/status/1073252767496617986), [BenArthur 2](https://twitter.com/BenArthur_7/status/1079237233192910849); params `shield_setoff_*`, `shield_stiff_mul_attack_4/air`). `shield_stiff_frame_max` is 60 (added in 9.0.0). It is probably a shieldstun cap; the meaning is inferred from the name.
- **Pushback:**
  - Defender: (shieldstun + 1) × 0.09, capped at 1.3.
  - Attacker: damage × 0.04 + 0.025, braked at 1.1 × friction.
  - No edge slip off shield in Ultimate ([SmashWiki: Shield](https://www.ssbwiki.com/Shield); params `shield_rebound_*`).
- **Parry (perfect shield):** release shield as the hit connects. It is active during the first **5 frames** of the 11-frame shield drop (`shield_just_frame` 5). Since shield must be held 3 frames first, the earliest parry is 4 frames after pressing shield. Parry is disabled until 3 frames after a normal shieldstun ends ([SmashWiki: Perfect shield](https://www.ssbwiki.com/Perfect_shield)).
- **Out of shield:** jumping out of shield takes 3 frames. Up-special and up-smash come out of shield without the shield drop ([UFD /smash](https://ultimateframedata.com/smash)). A shield grab is possible 4 frames after shieldstun ends (`shield_setoff_catch_frame`).
- **Shield break:** the fighter is launched upward, lands, then is stunned for **400 − %** frames, with mashing removing 3 frames per stick input. The shield comes back at 37.5 HP (75%) ([SmashWiki: Stun](https://www.ssbwiki.com/Stun); [SmashWiki: Shield](https://www.ssbwiki.com/Shield); params `furafura_frame` 400, `shield_reset` 37.5).
- Moves that hit a shield are staled at 0.85 weight (`shield_pattern_power_mul`).

| id | damage | kind | shieldstun frames |
|---|---|---|---|
| ss01_tilt | 10 | other | 10 |
| ss02_smash | 17.7 | smash | 12 |
| ss03_aerial | 10 | aerial | 4 |
| ss04_projectile | 10 | projectile | 4 |
| ss05_jab | 4 | other | 5 |

## 7. Dodges

Mario frame data from [UFD Mario](https://ultimateframedata.com/mario). Most of the cast is close to this; see the UFD stats tables.

| dodge | first actionable / total | intangible | notes |
|---|---|---|---|
| spot dodge | 20 if cancelled / 25 full | 3–17 | |
| forward roll | 29 | 4–15 | distance cast median 31.755 u (26.53–39.73), Mario 32.17 ([SmashWiki: Roll](https://www.ssbwiki.com/Roll)) |
| back roll | 34 | 5–16 | median 31.47 u (26.44–36.56), Mario 30.63 |
| neutral air dodge | 52 | 3–29 | landing lag 10; keeps momentum |
| directional air dodge | down 71, diagonal down 77, side 87, diagonal up 102, up 116 | 3–21 | landing lag 11–19 (max 20 per [MMSP](https://gamebanana.com/mods/38616)); distance 20 u fresh, 13.33 u fully stale; ends in helpless fall |

- **Ground dodge frames are totals.** SmashWiki labels the spot dodge and roll numbers above as total frames, so the first actionable frame is one later: spot dodge 26, forward roll 30, back roll 35. The data viewer has no CancelFrame for `escape`, `escape_f` or `escape_b` (they end with their animation); for ledge getups its CancelFrame is UFD's total + 1 (climb 34 and 35). A spot dodge can be cancelled 5 frames early into any ground attack or special, but not a grab or dash attack ([SmashWiki: Spot dodge](https://www.ssbwiki.com/Spot_dodge)), so an attack comes out on frame 21. The engine's values are in `src/sim/constants.ts` (`SPOT_DODGE`, `ROLL_FORWARD`, `ROLL_BACK`).
- **One air dodge per airtime.** It refreshes on landing, on being hit, or on grabbing a ledge ([SmashWiki: Air dodge](https://www.ssbwiki.com/Air_dodge)). Ultimate's air dodges average 49–50 frames, up from 32–33 in Smash 4.
- **Dodge staling** (params `escape_penalty_*`; meaning inferred from names): penalties are counted within 60 frames of a dodge ending, up to 5, and one is removed every 120 frames. Each penalty slows spot dodge and forward roll by 0.06 and back roll by 0.10; air dodges are not slowed.
- **Inputs:** spot dodge needs stick y ≤ −0.7 within a 4-frame flick. Rolls need |stick x| ≥ 0.7 within a 4-frame flick. The air-dodge direction threshold is 0.66 (param sheet).

## 8. Ledge (edge)

([SmashWiki: Edge](https://www.ssbwiki.com/Edge); param sheet `cliff_*`; [UFD stats](https://ultimateframedata.com/stats) Ledge Stats)

- **Catch animation:** 19 frames, so the fighter can act on frame 20 (data viewer `cliff_catch` CancelFrame 20).
- **Intangibility** = 60·(min(airtime,300)/300) + 44 − 44·(min(%,120)/120), minimum 4, plus the 19-frame catch, for a total of 23–123 frames. Examples:
  - fresh with no airtime: 63
  - 120% with no airtime: 23
  - 300 frames of airtime at 0%: 123
  - 300 frames of airtime at 120%: 79
  - 150 frames of airtime at 60%: 71
- **Hang time:** at most **360 frames** (`cliff_catch_time_quick` 0x168); then the fighter drops. The wiki says 6.5 s; see section 21.
- **Regrab penalties:**
  - At most **6 grabs** before landing. Getting hit resets the count.
  - A regrab gives no new hang intangibility.
  - Getup-option intangibility is ×1, 0.8, 0.5, then 0 on later regrabs.
  - The catch animation slows to 1, 1, 0.9375, 0.875, 0.8125, 0.75× speed on consecutive grabs.
- **Grab range behind the fighter** is 40% shorter (`cliff_back_range_x_mul` 0.6). Holding down (stick y ≤ −0.66) stops the auto-snap.
- **Ledge options (Mario, UFD):**

| option | intangible | total frames |
|---|---|---|
| neutral getup | 1–33 | 34 |
| roll | 1–25 | 45 |
| jump | 1–12 | 14 |
| attack | 1–26 | 55 |

- **Ledge trump:** the trumped fighter is pushed off with speed x 0.9 and has no control for 28 frames.
- **Regrab lockouts:** 44 frames after letting go and 30 after being hit (`cliff_no_catch_frame`, `damage_cliff_no_catch_frame`; these have no description in the sheet, so the meaning is inferred from the names).

## 9. Jumps and air movement

- **Jumpsquat:** 3 frames for almost the whole cast. The calculator's maximum is 6 (Kazuya); the wiki says Kazuya's is 7 ([SmashWiki: Short hop](https://www.ssbwiki.com/Short_hop); calc fighter data).
- **Short hop:** release jump before jumpsquat ends, or use the two-button short-hop macro. Short-hop aerials deal ×0.85 damage.
- **Jump arc, ESTIMATE model** (my fit; it reproduces 247 of 252 UFD airtimes for 65 uniquely matched fighters, including all 28 archetype values):
  - Full hop: rise JumpInitialSpeed/4 per frame for 4 frames (`jump_initial_frame` 4). Then v₀ = √(2g(JumpHeight − JumpInitialSpeed)) + g/2.
  - Short hop: v₀ = √(2g·HopHeight) + g/2.
  - Each frame: v −= g, cap v at −fall_speed, then move.
  - Fast fall starts 1 frame after the apex (v ≤ 0).
  - Airtime = simulated frames − 1.
  - Misses: Mewtwo FH 51 vs 52, Dr. Mario SH 40 vs 34 and SHFF 28 vs 23 (possibly a UFD data error), Kirby SHFF 27 vs 26, Snake SH 36 vs 37.
- **Fast fall:** tap down (stick ≤ −0.66 within a 4-frame flick) **while falling** and not tumbling. vy is set straight to the fast-fall speed with no acceleration. It ends on landing, knockback or jump ([SmashWiki: Fast-fall](https://www.ssbwiki.com/Fast-fall); params `dive_*`). The fast-fall/fall ratio is 1.6 for 83 of 89 fighters; the others use 1.316, 1.4 or 1.9 (calc fighter data).
- **Air acceleration** = base + add × |stick x|, up to air speed. Mario's is 0.01 + 0.07 ([SmashWiki: Air acceleration](https://www.ssbwiki.com/Air_acceleration)). Air friction slows the fighter when there is no input.
- **Hard caps:** air speed x 2.5 and fall speed 10 (params `air_speed_x_limit`, `air_speed_y_limit`).
- **Jump counts:** 80 fighters have 2. Banjo, Charizard and Ridley have 3; Pit and Dark Pit 4; King Dedede 5; Kirby, Meta Knight and Jigglypuff 6 ([SmashWiki: Double jump](https://www.ssbwiki.com/Double_jump)).
- **Wall movement:** 32 fighters can wall jump. Bayonetta, Diddy Kong, Greninja, Lucario, Squirtle and Sheik can also wall cling ([SmashWiki: Wall jump](https://www.ssbwiki.com/Wall_jump)).
- **Footstool:** each repeat is ×0.75, with at least 8 frames between footstools.

## 10. Ground movement and input

- **Buffer:** 7 frames, plus 2 more for held inputs (`precede`, `precede_extension`).
- **Dash:** a fast turnaround is possible in the first 5 frames of an initial dash. Mario's initial dash lasts 10 frames and his pivot dash 12. Dash speed is kept for 6 frames ([UFD stats](https://ultimateframedata.com/stats) Dash Turnaround and Dash and Run; params `turn_dash_frame` 5, `dash_speed_keep_frame` 6; [MMSP](https://gamebanana.com/mods/38616) gives the same 6).
- **Stick thresholds:** dash 0.85, run 0.75.
- **Keyboards are digital,** so walking and tilt attacks need a modifier key (see section 18).
- **Turnaround special and B-reverse** ([SmashWiki: B-reversing](https://www.ssbwiki.com/B-reversing); [SmashWiki: Side special move](https://www.ssbwiki.com/Side_special_move)). The engine's values are `SPECIAL_REVERSE` in `src/sim/constants.ts`, tested in `src/sim/actions/bReverse.test.ts`.
  - *Turnaround special:* the stick behind the fighter when Special is pressed turns it around before the special starts. Facing changes and momentum does not. It works for every special, on the ground and in the air ("In Ultimate, the new dash cancel mechanics now allow characters to perform grounded turnaround-Bs"; "when a player reverses the direction of their up special to recover, they are performing a turnaround up special").
  - *B-reverse:* "In Ultimate, the direction input must be within 4 frames of the special input." The press is the special's frame 1, so the stick behind the fighter on frames 2-5 turns it around and reverses its horizontal speed ("turning around and reversing their momentum"). Frame 6 is too late. It happens once per special, on the ground and in the air. Knockback still decaying from an earlier hit keeps its direction. The window counts frames since the press, so a charge that holds the move on its charge frame doesn't stretch it. Charging specials can be B-reversed: the page lists Samus's Charge Shot as an exception only "prior to Ultimate".
  - *Which specials:* "In Brawl, SSB4 and Ultimate, most side special moves can be reversed in the first few frames." The B-reversing page's exceptions include Falcon Punch, Warlock Punch and Mewtwo's Disable ("Not every special move can be B-reversed"), so neutral and down specials allow it by default. SmashWiki only describes reversing an up special as a turnaround, so up specials don't B-reverse by default. `MoveDef.bReverse` overrides the default per move.
  - *Wavebounce:* "a matter of performing both a turnaround-B and a B-reverse within the same special move. The result is that the character will change the direction they move, but not the direction they are facing."
  - *Not stated by SmashWiki:* the stick threshold (the engine uses its direction threshold, 0.25) and whether a tap is needed (the engine accepts any stick position past the threshold). The tap-and-release form of the turnaround, where the stick is back at neutral when Special is pressed, is not modelled; only a stick held behind on the press turns.
- **Speed ranges in the cast:** walk 0.62–1.575, initial dash 1.45–2.45, run 1.18–3.85 u/frame. Ground friction (traction) is 0.076–0.138 (section 17).

## 11. Tech, missed tech and jab lock

- **Tech window:** **11 frames** before touching the surface. The input is then locked out, and you can't tech again until **40 frames** after the press ([SmashWiki: Tech](https://www.ssbwiki.com/Tech)). The params say `passive_trigger_frame` 12 and `no_rapid_frame_value` 28. 12 + 28 = 40, so the wiki's 40 counts from the press (my reconciliation). Use 11 and 40.
- **Maximum launch speed to tech:** 6.0 (`invalid_passive_speed`). The calculator uses 6 for walls and ceilings and 3 for floors.
- **Other windows:** an air dodge can be cancelled into a tech within 15 frames (`air_escape_passive_trigger_frame`), and a wall tech can go into a wall jump within 5 frames.
- **Tech options, Mario** (data viewer motion list, [rubendal/ssbu](https://github.com/rubendal/ssbu) 13.0.1):
  - Neutral tech: intangible 1–21, FAF 27.
  - Tech roll: intangible 1–21, FAF 41.
  - Ceiling tech: intangible 1–18, FAF 27.
  - Wall tech: intangible 1–21.
- **Missed tech:** the fighter bounces for 26 frames, then lies down. From there:
  - Getup: intangible 1–23, FAF 30.
  - Getup roll: intangible 1–23, FAF 36.
  - Getup attack: intangible 1–26, FAF 46.
  - Auto-getup after 220 frames (`down_frame`).
- **Jab lock:** at most 2 locks in Ultimate, and after a lock the victim can pick any getup option. The minimum KB to lock is 7 ([SmashWiki: Lock](https://www.ssbwiki.com/Lock); `down_damage_reaction`).

## 12. Landing lag

- **Normal landings:** soft landing lag is 1 frame. Hard landing lag is 2–5 frames, median 3 and Mario 3 (calc fighter data). UFD lists these as frames until actionable, so soft is 2 and Mario's hard is 4 ([UFD stats](https://ultimateframedata.com/stats)). The calc attribute `FallingFrameToUseHardLandingLag` is 4 for Mario (cast mode 4, range 1–8). From its name, it is probably the number of falling frames after which a landing counts as hard.
- **Aerial landing lag:** cast medians are nair 9, fair 12, bair 11, uair 10 and dair 16. Mario's aerials (startup / total / landing lag) are:
  - nair 3 / 45 / 6, auto-cancels on frames 1–2 and 39+
  - fair 16 / 59 / 17
  - bair 6 / 33 / 6
  - uair 4 / 30 / 6
  - dair 5 / 37 / 15

  ([UFD Mario](https://ultimateframedata.com/mario))
- **Other landings:** air dodge landing lag is 10 frames (neutral) and 11–19 (directional). Landing from helpless fall is FAF 30 for Mario (data viewer `landing_fall_special`).

## 13. Platforms

- **Soft (pass-through) platforms** can be jumped through from below (calc stage data `passthroughAngle` 90).
- **Platform drop:** tap down while standing or walking on a platform. You can't drop while running, attacking, crouching or shielding; a lightly tilted stick crouches instead ([Dragdown: Grounded movement](https://dragdown.wiki/wiki/SSBU/System_Mechanics/Grounded_Movement)). Drop thresholds: stick y ≤ −0.6875 within a 6-frame flick, and the fighter starts falling at vy −0.5 (params `pass_stick_y`, `pass_flick_y`, `pass_speed_y`).
- **No source gives a platform-drop duration in frames.** PROPOSAL: drop on the frame the flick registers.

## 14. Grabs

- **Hold time:** floor(90 + 1.7 × %) frames. Each mash input removes 8 frames (stick) or 14.4 (button), with a minimum of 19 frames ([SmashWiki: Grab](https://www.ssbwiki.com/Grab); [SmashWiki: Button mashing](https://www.ssbwiki.com/Button_mashing); params `capture_cut_frame` 90, `capture_cut_frame_damage` 1.7, `capture_clatter_frame` 8). Examples: 0% → 90, 50% → 175, 100% → 260.
- **After release** the fighter can't be grabbed again for 60 frames. A grabbed fighter breaks free after taking 10% total from others.
- **Grab range:** Mario 12 u, Bowser 20 u ([UFD stats](https://ultimateframedata.com/stats) Grab Range).

## 15. Stale moves

- **Queue:** the last 9 moves that hit. The reductions by slot are 0.09, 0.08545, 0.07635, 0.0679, 0.05945, 0.05035, 0.04255, 0.03345 and 0.025, summed over the slots holding the move ([SmashWiki: Stale-move negation](https://www.ssbwiki.com/Stale-move_negation); calc `parameters.staling`). Total possible reduction is 0.5305.
- **Freshness:** a move not in the queue gets ×1.05.
- **Example:** a move in slots 1, 2 and 6 deals 77.42% damage.
- **In the KB formula,** p uses the full stale damage and d uses 0.3× of the staleness (section 2).

## 16. Stages

All values come from LVD-derived collision data ([SSBU-Calculator Data/Stages/ssbustagedata.json](https://github.com/rubendal/SSBU-Calculator), commit 233590e), in units.

| | Battlefield | Final Destination | Smashville |
|---|---|---|---|
| main stage x | −79.99 … 79.99 (width 159.98) | −80 … 80 (160) | −69.05 … 70.25 (139.30) |
| stage top y | 0 | 0 | 0.1 |
| soft platforms | y 24.119 at x [−59.422, −24.789] and [24.789, 59.422] (width 34.633); y 47.189 at x [−17.317, 17.317] | none | 1 moving platform at y 28.80, width 47.68 (path not in the data) |
| blast zones L/R/T/B | −240 / 240 / 192 / −140 | −240 / 240 / 180 / −140 | −229 / 230 / 190 / −115 |
| camera L/R/T/B | −170 / 170 / 130 / −80 | −180 / 180 / 130 / −60 | −159 / 160 / 140 / −50 |
| spawns | (−40, 24.23), (40, 24.23), (0, 0.11), (0, 47.3) | (±30, 0), (±70, 0) | (±27, 0.1), (±63, 0.1) |
| respawn platforms | (0, 70), (±36, 70), (72, 70) | (−25, 50), (5, 50), (−55, 50), (35, 50) | (0, 70), (±26, 70), (52, 70) |

- **Underside:** Battlefield's main stage drops to y −40.1, with walls slanting in from the ledges. Final Destination's polygon is the same shape. The full Battlefield polygon is in the JSON.
- **Pixel mapping** is in section 1.
- **Reference screenshots** were downloaded for judges from [ssb.wiki.gallery](https://ssb.wiki.gallery/) and are not included here: Battlefield 1366×768, Battlefield Ω 1280×720, Final Destination 1920×1080.

## 17. Archetypes and cast ranges

Archetypes for Coolmath Smash fighters, each taken from a real Ultimate fighter. Stats come from the calc fighter data (Data/<fighter>/data.json), airtimes from [UFD stats](https://ultimateframedata.com/stats) and jump counts from [SmashWiki: Double jump](https://www.ssbwiki.com/Double_jump). The JSON also holds landing lags, friction, jump speed, shield size and the model airtime estimate; it matches UFD exactly for all seven.

| field | featherweight (Pichu) | lightweight (Pikachu) | middleweight (Mario) | heavyweight (Donkey Kong) | superheavy (Bowser) | fast_faller (Fox) | floaty (Jigglypuff) |
|---|---|---|---|---|---|---|---|
| weight | 62.0 | 79.0 | 98.0 | 127.0 | 135.0 | 77.0 | 68.0 |
| gravity | 0.14 | 0.095 | 0.087 | 0.085 | 0.125 | 0.23 | 0.053 |
| fall | 1.9 | 1.55 | 1.5 | 1.63 | 1.77 | 2.1 | 0.98 |
| fast fall | 2.5 | 2.48 | 2.4 | 2.608 | 2.832 | 3.36 | 1.568 |
| walk | 1.302 | 1.302 | 1.155 | 1.365 | 0.901 | 1.523 | 0.735 |
| dash | 1.98 | 1.98 | 1.936 | 2.09 | 2.255 | 2.09 | 1.65 |
| run | 1.892 | 2.039 | 1.76 | 1.873 | 1.971 | 2.402 | 1.271 |
| air speed | 1.029 | 0.957 | 1.208 | 1.208 | 1.155 | 1.11 | 1.332 |
| air acc base | 0.01 | 0.01 | 0.01 | 0.01 | 0.01 | 0.01 | 0.05 |
| air acc add | 0.09 | 0.09 | 0.07 | 0.05 | 0.04 | 0.08 | 0.08 |
| full hop h | 36.75 | 35.5 | 36.33 | 34.0 | 33.0 | 35.0 | 19.79 |
| short hop h | 17.43 | 17.12 | 17.54 | 17.3 | 15.7 | 16.4 | 11.26 |
| air jump h | 36.02 | 35.5 | 36.33 | 35.5 | 32.61 | 37.0 | 19.79 |
| jumps | 2 | 2 | 2 | 2 | 2 | 2 | 6 |
| airtime SH/FH/SHFF/FHFF (UFD) | 31/45/23/34 | 38/53/26/37 | 40/56/28/39 | 40/53/27/37 | 31/45/22/31 | 24/36/17/27 | 41/51/29/35 |

Cast ranges over all 89 fighters in the calculator data:

| attribute | min | median | max |
|---|---|---|---|
| weight | 62.0 | 95.0 | 135.0 |
| walk_speed | 0.62 | 1.115 | 1.575 |
| dash_initial_speed | 1.45 | 1.914 | 2.45 |
| run_speed | 1.18 | 1.72 | 3.85 |
| ground_friction | 0.076 | 0.11 | 0.138 |
| jumpsquat | 3 | 3 | 6 |
| jump_initial_speed | 9.075 | 17.875 | 27.7805 |
| full_hop_height | 16.5 | 32.5 | 50.51 |
| short_hop_height | 10.0 | 16.02 | 22.11 |
| air_jump_height | 19.79 | 33.5 | 57.35 |
| air_speed | 0.735 | 1.05 | 1.344 |
| air_accel_base | 0.0 | 0.01 | 0.07 |
| air_accel_add | 0.02 | 0.06 | 0.105 |
| air_friction | 0.00375 | 0.01 | 0.05 |
| gravity | 0.053 | 0.09 | 0.23 |
| fall_speed | 0.98 | 1.6 | 2.1 |
| fast_fall_speed | 1.568 | 2.528 | 3.36 |
| shield_size | 8.0 | 11.6 | 18.5 |

Other cast extremes ([SmashWiki: Gravity](https://www.ssbwiki.com/Gravity)): Fox has the highest gravity, 0.23, which drops to 0.067872 during vertical knockback. Jigglypuff has the lowest, 0.053.

## 18. Brawlhalla and MultiVersus, compared

**Brawlhalla** ([Movement](https://brawlhalla.wiki.gg/wiki/Movement), [Attacks](https://brawlhalla.wiki.gg/wiki/Attacks), [Controls](https://brawlhalla.wiki.gg/wiki/Controls)):

- **Jumps:** 2 air jumps, and jumps also work off walls. A fighter gets at most 3 air actions (jumps plus recoveries) before touching ground or a wall. Jumps have 2 frames of startup, and there are 4 frames of landing recovery after a jump.
- **No shield.** Defense is dodging. Dodges have 2 frames of startup and grant invulnerability for:
  - 12 frames (directional air)
  - 20 frames (aerial spot)
  - 16 frames (grounded spot)
  - 17 frames (chase dodge)
- **Dodge cooldowns:** 60 frames on the ground and 163 in the air. Landing 75 frames after an air dodge clears the cooldown.
- **Chase dodge:** after a hit you get 2 chase dodges (if grounded at the end of the attack) or 1 (if airborne), within 12 frames of recovery ending. You can cancel into an attack within 20 frames, which usually gives about 9 frames of invincibility.
- **Gravity cancel:** attacking within 18 frames of an aerial spot dodge performs a grounded attack in the air.
- **Damage:** a color meter rather than numbers: white 0, yellow 50, orange 100, red 150, darker red 200, darker still 250, black 300+. Most KOs happen around 150–200.
- **Force:** variable force is multiplied by d/100 + d²/20000.
- **Stun** is fixed per attack. Stunned fighters bounce off surfaces at ×0.8 velocity when moving faster than 9.6 u/frame.
- **Signatures** share a 10-frame global cooldown.

**MultiVersus** ([Glossary](https://multiversus.wiki.gg/wiki/Glossary), [Open Beta V0 notes](https://multiversus.wiki.gg/wiki/Patch_Notes/Open_Beta_V0), [Season 5 notes via EventHubs](https://www.eventhubs.com/news/2025/feb/04/patch-notes-final-season-multiversus/), [MassivelyOP hands-on](https://massivelyop.com/2022/07/29/hands-on-with-multiversus-how-wbs-new-brawler-stacks-up-against-super-smash-bros/), [GamesFuze guide](https://gamesfuze.com/guides/multiversus-movement-and-recovery-guide/)):

- **Status:** online services shut down on 30 May 2025; offline play remains.
- **No ledges.** Every fighter can wall-cling, and clinging refreshes jumps, so recovery is mostly horizontal.
- **Wall fatigue:** after 5 s or 6 wall slides, sliding speeds up. After 10 s or 11 slides, the fighter is fatigued: no air refresh, no double jump after a wall jump, and dodge-meter loss every 0.5 s.
- **Dodging:** 2 air dodges per airtime (per a 2022 beta-era guide; not re-checked for the 2024 relaunch), plus a dodge meter that dodges spend and armor drains. In Season 5 an emptied meter stops refilling over time, and a dodge jump costs an extra bar.
- **Season 5 shield:** minimum 5 frames, drop 16 frames. The in-place auto-tech is invulnerable for 26 frames.
- **2v2-first design:** support fighters buff, pull or shield allies, and team perks stack.

**What to borrow for a keyboard browser game:**

- Keep Smash's shield, parry and ledge systems; they are the reference.
- Copy Brawlhalla's proven keyboard layout.
- Consider Brawlhalla-style generous dodge invulnerability (12–20 frames) and its 2-frame jump startup if keyboard play feels stiff. Ultimate's 3-frame jumpsquat is already close.
- Avoid MultiVersus wall fatigue and the dodge meter; they add UI and rules a class project doesn't need.

**Keyboard controls, PROPOSAL** (based on Brawlhalla preset B: W/A/S/D move and jump, J light, K heavy, H grab, L dodge; preset A uses arrows with C/X/V/Z):

| action | Player 1 | Player 2 |
|---|---|---|
| move | A / D | ← / → |
| jump | W (tap-jump) or Space | ↑ or Numpad 0 |
| crouch, fast fall, platform drop | S | ↓ |
| attack (jab, tilts, aerials) | J | Numpad 1 |
| special | K | Numpad 2 |
| shield (hold), dodge (+ direction) | L | Numpad 3 |
| grab | H | Numpad 5 |
| smash-attack modifier (attack + direction while held) | I | Numpad 4 |
| walk modifier (digital keys have no half tilt) | Shift | — |

## 19. Per-frame update order (PROPOSAL, built on the cited rules)

1. Read input and push it into the 7-frame buffer.
2. If the fighter is in hitlag, freeze it, accept SDI flicks, and skip the remaining steps.
3. Run state transitions: jumpsquat (3), shield drop (11), landing lag, and so on.
4. Update the fighter's own velocity:
   - On the ground: walk/run acceleration, or traction braking.
   - In the air: x += base + add·|stick|, clamped to air speed, with air friction when there is no input; then vy −= gravity, clamped to −fall speed, or set to −fast-fall speed.
   - During tumble at 70–110°: use DamageFlyTopGravity and fall speed 1.8.
5. Update the knockback velocity: on the first frame set it to kb·0.03 along the launch angle, plus the gravity bonus. Each frame, reduce its magnitude by 0.051 along its direction. During tumble, step it by the speed-up multiplier.
6. Move: position += own velocity + knockback velocity.
7. Collide with the main stage, soft platforms (one-way) and ledges. Then apply tech checks, landing lag and the ledge snap rules.
8. Resolve hitboxes: damage (×1.2 in 1v1 for the meter only), then hitlag, then knockback and hitstun.

## 20. Acceptance checks for build threads and judges

- **Knockback suite:** all 15 knockback vectors, 12 hitlag vectors, 5 shieldstun, 6 Sakurai, 7 speed-up, 5 rage, 5 ledge intangibility, 3 grab and 3 shield-break vectors pass.
- **Mario-like middleweight airtimes:** short hop 40, full hop 56, short hop + fast fall 28, full hop + fast fall 39. Fox-like fast faller: 24, 36, 17 and 27.
- **Shield:** a full shield lasts 50/0.15 ≈ 333 frames (5.6 s) while held from full. Shield drop takes 11 frames. The parry window is the first 5 frames of the drop.
- **Ledge:** the catch is actionable on frame 20. A 7th regrab is impossible before landing. Intangibility is 63 frames at 0% with no airtime.
- **Tumble:** reached at kb 80. Neutral air dodge FAF is 52. Directional air dodges end in helpless fall and allow one dodge per airtime.
- **Feel:** Battlefield platforms are reachable with one full hop (36.33 u for Mario versus a platform at 24.12 u). The top platform needs a double jump or a full hop from a side platform.

## 21. Disagreements and decisions

| topic | source A | source B | decision |
|---|---|---|---|
| tech window | SmashWiki 11 frames | param `passive_trigger_frame` 12 | **11** (wiki measured behaviour; the param may count the press frame) |
| tech lockout | SmashWiki 40 frames | param `no_rapid_frame_value` 28 | **40 from the press** (12 + 28 = 40) |
| ledge hang | SmashWiki 6.5 s (390 f) | param `cliff_catch_time_quick` 360 | **360 frames** after the catch animation (game data; the wiki rounds in seconds) |
| shield drop | data viewer `guard_off` CancelFrame 8 | param 11, UFD 11 | **11** (two independent sources) |
| ledge roll total | UFD 45 | data viewer `cliff_escape` CancelFrame 50 | **45** (UFD frame data is measured; other ledge options agree between the two) |
| Kazuya jumpsquat | calc data 6 | SmashWiki 7 | irrelevant for our archetypes; use 3 |
| hitlag with 3+ players | SmashWiki: factor on computed hitlag | calc: scales the damage term | 2-player vectors only; implement the wiki form if needed |
| floor tech speed limit | param 6.0 | calc 3 for floors | 6 for walls and ceilings, 3 for floors |
| landing lag numbers | params (lag frames) | UFD (frames until actionable) | not a conflict: UFD = param + 1 |

## 22. Not found or uncertain

- **Platform-drop duration** in frames. No source has it; there is a proposal in section 13.
- **Per-fighter hurtbox/ECB sizes and ledge-grab box dimensions.** Fighter height in section 1 is an estimate.
- **Smashville's moving-platform path and speed** (only one sampled position).
- **Meaning of some undocumented params:** `cliff_no_catch_frame`, `re_dash_frame`, `escape_penalty_*`. These are inferred from their names.
- **Jump arc model** is a fit (247/252), not decompiled code.
- **MultiVersus frame data** is mostly unavailable: the wiki's dodge tutorial was removed and the game is offline. Only patch-note numbers are given.
- **Brawlhalla gravity and fall speeds** in its own units were not found.
- **Roster parity** of the calculator's 89 fighter files against patch 13.0.1 was not checked one by one.

## 23. Verification script

Save this as `physics_verify.py` and run `python3 physics_verify.py` to print every vector. Run `python3 physics_verify.py --check physics-constants.json` to confirm the JSON; it prints `mismatches: 0` for this release. It uses only the standard library.

The numbers were also cross-checked against the calculator's own JavaScript. I ran 45 vectors (knockback, hitlag, shieldstun, Sakurai, speed-up) through `formulas.js`/`knockback.js` from [rubendal/SSBU-Calculator](https://github.com/rubendal/SSBU-Calculator) commit 233590e in Node. There were 0 numeric mismatches; the only difference is the kb13 angle display noted in section 2.

```python
#!/usr/bin/env python3
"""Coolmath Smash physics reference: independent re-implementation of the
Super Smash Bros. Ultimate (v13.0.1) formulas used to generate the test
vectors in physics-constants.json. Pure stdlib, no file reads.

Run:  python3 physics_verify.py            -> prints every vector as JSON
      python3 physics_verify.py --check FILE -> compares against a JSON file
"""
import json, math, sys

FPS = 60
STALE_FACTORS = [0.09, 0.08545, 0.07635, 0.0679, 0.05945, 0.05035, 0.04255, 0.03345, 0.025]
FRESHNESS_BONUS = 1.05

def stale_mult(queue_positions, staleness_enabled=True):
    """queue_positions: 1-based slots of the 9-move queue holding this move."""
    if not staleness_enabled:
        return 1.0
    if not queue_positions:
        return FRESHNESS_BONUS
    return 1.0 - sum(STALE_FACTORS[i - 1] for i in queue_positions)

def rage(attacker_percent):
    p = min(max(attacker_percent, 35.0), 150.0)
    return 1.0 + (p - 35.0) / 115.0 * 0.1

def knockback(pre_percent, damage, weight, kbg, bkb, s=1.0, crouch=False,
              attacker_percent=0.0, use_rage=False, wbkb=None):
    """Ultimate knockback units. pre_percent = displayed % before the hit.
    damage = the hitbox's base damage. The 1v1 1.2x multiplier is NOT applied
    to the current hit inside the formula (it only changes displayed %)."""
    if wbkb is not None:
        p, d, s = 10.0, wbkb, 1.0
        use_rage = False
    else:
        p = pre_percent + damage * s
        d = damage * (1.0 - (1.0 - s) * 0.3)
    kb = ((p / 10.0 + p * d / 20.0) * (200.0 / (weight + 100.0)) * 1.4 + 18.0) * (kbg / 100.0) + bkb
    r = (0.85 if crouch else 1.0) * (rage(attacker_percent) if use_rage else 1.0)
    return kb * r

def hitstun(kb):
    h = kb * 0.4
    if h < 0:
        return 0
    return math.floor(max(h, 5.0)) - 1

def tumbles(kb):
    return hitstun(kb) + 1 >= 32

def sakurai_angle(kb, aerial):
    if aerial:
        return math.degrees(0.663225)
    if kb < 60:
        return 0.0
    if kb >= 88:
        return 38.0
    return min((kb - 60.0) / (88.0 - 60.0) * 38.0 + 1.0, 38.0)

def speedup_faf(faf):
    """Balloon-knockback speed-up: real frames until actionable for a tumble
    hit whose un-sped first actionable frame is faf (= hitstun + 1)."""
    ratio = min(max((faf - 30.0) / (80.0 - 30.0), 0.0), 1.0)
    max_mag = 1.0 + (6.0 - 1.0) * ratio
    frame, frame_last, unk0, mag, i = float(faf), float(faf), 1.0 - 70.0 / 100.0, max_mag, 0
    while mag > 1:
        r = (frame_last * unk0 - frame) / (frame_last * unk0 - frame_last)
        r = min(max(r, 0.0), 1.0)
        mag = r * max_mag
        frame -= 1 if mag < 1 else mag
        i += 1
    return i + math.ceil(frame)

def launch(kb, angle, aerial, gravity, set_kb=False):
    """Initial launch velocity in units/frame (before per-frame 0.051 decay)."""
    a = sakurai_angle(kb, aerial) if angle == 361 else float(angle)
    grounded_zero = (not aerial) and a in (0.0, 180.0)
    if a in (0.0, 180.0) and kb >= 120:
        a, grounded_zero = 32.0, False
    tumble = tumbles(kb)
    vertical = math.radians(a) >= 1.22173 - 1e-9 and math.radians(a) <= 1.91986 + 1e-9
    g_add = 5.0 * (gravity - 0.075) if (tumble and not set_kb and not vertical) else 0.0
    ls = kb * 0.03
    vx = ls * math.cos(math.radians(a))
    vy = ls * math.sin(math.radians(a)) + g_add
    if grounded_zero:
        vx, vy = vx * 0.8, vy * 0.8
    return {"angle_deg": a, "launch_speed": ls, "vx": abs(vx), "vy": abs(vy),
            "gravity_bonus_vy": g_add, "tumble": tumble}

def hitlag(damage, mult=1.0, electric=False, crouch=False):
    """2-player hitlag (player factor = 1). Stale damage goes in; 1v1 1.2x does not."""
    e = 1.5 if electric else 1.0
    h = math.floor((damage * 0.65 + 6.0) * mult * e)
    h = min(h, 30)
    if crouch:
        h = math.floor(h * 0.67)
    return max(h, 0)

def shieldstun(damage, kind="other"):
    t = {"smash": 0.725, "aerial": 0.33, "projectile": 0.29}.get(kind, 1.0)
    return math.floor(damage * 0.8 * t + 3.0) - 1

def ledge_intangibility(airtime_frames, percent):
    a = min(airtime_frames, 300) / 300.0
    p = min(percent, 120) / 120.0
    return max(60 * a + (44 - 44 * p), 4) + 19

def grab_hold_frames(percent):
    return math.floor(90 + 1.7 * percent)

def shield_break_stun(percent):
    return max(400 - percent, 0)

def jump_airtime(g, fall, ffall, jump_h, hop_h, init, kind, fastfall):
    """ESTIMATE (fit, not decompiled): frames from leaving the ground to landing.
    Reproduces 247/252 UFD jump-duration values for 65 characters."""
    y, frames = 0.0, 0
    pre = [] if kind == "sh" else [init / 4.0] * 4
    v = math.sqrt(2 * g * (hop_h if kind == "sh" else jump_h - init)) + g / 2
    for dy in pre:
        y += dy; frames += 1
    apex, fast = None, False
    while frames < 2000:
        frames += 1
        v -= g
        if apex is None and v <= 0:
            apex = frames
        if fastfall and apex is not None and frames >= apex + 1:
            fast = True
        if fast:
            v = -ffall
        elif v < -fall:
            v = -fall
        y += v
        if y <= 0:
            return frames - 1
    return None

TARGETS = {
    "mario": {"weight": 98, "gravity": 0.087},
    "fox": {"weight": 77, "gravity": 0.23},
    "bowser": {"weight": 135, "gravity": 0.125},
    "jigglypuff": {"weight": 68, "gravity": 0.053},
}

KB_VECTORS = [
    dict(id="kb01_low_jab_like", target="mario", pre_percent=0, damage=10, kbg=100, bkb=40, angle=45, aerial=True, stale_queue=None, staleness=False),
    dict(id="kb02_mid_tilt", target="mario", pre_percent=50, damage=12, kbg=100, bkb=30, angle=45, aerial=True, stale_queue=None, staleness=False),
    dict(id="kb03_smash_100pct", target="mario", pre_percent=100, damage=15, kbg=100, bkb=40, angle=40, aerial=True, stale_queue=None, staleness=False),
    dict(id="kb04_fox_kill_hit", target="fox", pre_percent=120, damage=18, kbg=98, bkb=37, angle=45, aerial=True, stale_queue=None, staleness=False),
    dict(id="kb05_bowser_same_hit", target="bowser", pre_percent=120, damage=18, kbg=98, bkb=37, angle=45, aerial=True, stale_queue=None, staleness=False),
    dict(id="kb06_puff_361_aerial", target="jigglypuff", pre_percent=80, damage=14, kbg=104, bkb=34, angle=361, aerial=True, stale_queue=None, staleness=False),
    dict(id="kb07_361_grounded_low", target="mario", pre_percent=0, damage=3, kbg=50, bkb=20, angle=361, aerial=False, stale_queue=None, staleness=False),
    dict(id="kb08_vertical_upsmash", target="mario", pre_percent=90, damage=17, kbg=92, bkb=30, angle=90, aerial=False, stale_queue=None, staleness=False),
    dict(id="kb09_stale_slots_1_2", target="mario", pre_percent=60, damage=12, kbg=100, bkb=30, angle=45, aerial=True, stale_queue=[1, 2], staleness=True),
    dict(id="kb10_fresh_bonus", target="mario", pre_percent=60, damage=12, kbg=100, bkb=30, angle=45, aerial=True, stale_queue=[], staleness=True),
    dict(id="kb11_crouch_cancel", target="mario", pre_percent=20, damage=8, kbg=50, bkb=20, angle=45, aerial=False, stale_queue=None, staleness=False, crouch=True),
    dict(id="kb12_rage_150_fresh", target="mario", pre_percent=100, damage=15, kbg=100, bkb=40, angle=45, aerial=True, stale_queue=[], staleness=True, attacker_percent=150),
    dict(id="kb13_zero_angle_over_120", target="mario", pre_percent=150, damage=20, kbg=100, bkb=50, angle=0, aerial=False, stale_queue=None, staleness=False),
    dict(id="kb14_set_knockback", target="mario", pre_percent=0, damage=5, kbg=100, bkb=0, wbkb=80, angle=45, aerial=True, stale_queue=None, staleness=False),
    dict(id="kb15_heavy_finisher", target="mario", pre_percent=140, damage=22, kbg=106, bkb=30, angle=40, aerial=True, stale_queue=None, staleness=False),
]

HITLAG_VECTORS = [
    dict(id="hl01", damage=2), dict(id="hl02", damage=5), dict(id="hl03", damage=10),
    dict(id="hl04", damage=15), dict(id="hl05", damage=20), dict(id="hl06", damage=30),
    dict(id="hl07_cap", damage=40), dict(id="hl08_electric", damage=10, electric=True),
    dict(id="hl09_crouch", damage=15, crouch=True), dict(id="hl10_crouch", damage=20, crouch=True),
    dict(id="hl11_mult_1.5", damage=12, mult=1.5), dict(id="hl12_mult_0.5", damage=10, mult=0.5),
]

SHIELDSTUN_VECTORS = [
    dict(id="ss01_tilt", damage=10, kind="other"), dict(id="ss02_smash", damage=17.7, kind="smash"),
    dict(id="ss03_aerial", damage=10, kind="aerial"), dict(id="ss04_projectile", damage=10, kind="projectile"),
    dict(id="ss05_jab", damage=4, kind="other"),
]

def run_kb(v):
    t = TARGETS[v["target"]]
    s = stale_mult(v["stale_queue"] or [], v["staleness"]) if v["staleness"] else 1.0
    set_kb = "wbkb" in v
    kb = knockback(v["pre_percent"], v["damage"], t["weight"], v["kbg"], v["bkb"], s=s,
                   crouch=v.get("crouch", False), attacker_percent=v.get("attacker_percent", 0),
                   use_rage=v["staleness"], wbkb=v.get("wbkb"))
    hs = hitstun(kb)
    ln = launch(kb, v["angle"], v["aerial"], t["gravity"], set_kb=set_kb)
    out = dict(v)
    out.update({
        "weight": t["weight"], "gravity": t["gravity"], "stale_multiplier": round(s, 6),
        "one_v_one_multiplier_applied": False,
        "expected_kb": round(kb, 6), "expected_hitstun_frames": hs,
        "expected_tumble": ln["tumble"], "expected_launch_speed": round(ln["launch_speed"], 6),
        "expected_angle_deg": round(ln["angle_deg"], 4),
        "expected_effective_angle_deg": round(math.degrees(math.atan2(ln["vy"], ln["vx"])), 4),
        "expected_vx": round(ln["vx"], 6), "expected_vy": round(ln["vy"], 6),
        "expected_gravity_bonus_vy": round(ln["gravity_bonus_vy"], 6),
        "expected_first_actionable_frame_unsped": hs + 1,
        "expected_first_actionable_frame_with_speedup": (speedup_faf(hs + 1) if (ln["tumble"] and not set_kb) else hs + 1),
    })
    return out

def main():
    res = {
        "knockback": [run_kb(v) for v in KB_VECTORS],
        "hitlag": [dict(v, expected_hitlag_frames=hitlag(v["damage"], v.get("mult", 1.0), v.get("electric", False), v.get("crouch", False))) for v in HITLAG_VECTORS],
        "shieldstun": [dict(v, expected_shieldstun_frames=shieldstun(v["damage"], v["kind"])) for v in SHIELDSTUN_VECTORS],
        "sakurai": [{"kb": k, "aerial": a, "expected_angle_deg": round(sakurai_angle(k, a), 4)} for k, a in [(50, False), (60, False), (74, False), (88, False), (120, False), (50, True)]],
        "speedup": [{"faf": f, "expected_actionable_frame": speedup_faf(f)} for f in [30, 36, 40, 50, 58, 80, 100]],
        "rage": [{"attacker_percent": p, "expected_multiplier": round(rage(p), 6)} for p in [0, 35, 92.5, 150, 200]],
        "ledge_intangibility": [{"airtime_frames": a, "percent": p, "expected_frames_incl_19f_catch": round(ledge_intangibility(a, p), 4)} for a, p in [(0, 0), (0, 120), (300, 0), (300, 120), (150, 60)]],
        "grab_hold": [{"percent": p, "expected_frames": grab_hold_frames(p)} for p in [0, 50, 100]],
        "shield_break_stun": [{"percent": p, "expected_frames": shield_break_stun(p)} for p in [0, 100, 250]],
    }
    if len(sys.argv) > 2 and sys.argv[1] == "--check":
        doc = json.load(open(sys.argv[2]))
        paths = {"knockback": ("knockback", "test_vectors"), "hitlag": ("hitlag", "test_vectors"),
                 "shieldstun": ("shield", "shieldstun", "test_vectors"), "sakurai": ("launch", "sakurai_angle", "test_vectors"),
                 "speedup": ("hitstun", "speedup_balloon_knockback", "test_vectors"), "rage": ("rage", "test_vectors"),
                 "ledge_intangibility": ("ledge", "intangibility_test_vectors"), "grab_hold": ("grab", "test_vectors"),
                 "shield_break_stun": ("shield_break", "stun_test_vectors")}
        bad = 0
        for sec, rows in res.items():
            ref = doc
            for key in paths[sec]:
                ref = ref[key]
            if len(ref) != len(rows):
                bad += 1; print("COUNT MISMATCH", sec, len(rows), len(ref))
            for a, b in zip(rows, ref):
                for k, val in a.items():
                    if k.startswith("expected_") and b.get(k) != val:
                        bad += 1; print("MISMATCH", sec, a.get("id"), k, val, b.get(k))
        print("mismatches:", bad); sys.exit(1 if bad else 0)
    print(json.dumps(res, indent=1))

if __name__ == "__main__":
    main()
```

## 24. Sources

- ssbw_knockback: https://www.ssbwiki.com/Knockback
- ssbw_hitstun: https://www.ssbwiki.com/Hitstun
- ssbw_tumbling: https://www.ssbwiki.com/Tumbling
- ssbw_hitlag: https://www.ssbwiki.com/Hitlag
- ssbw_shield: https://www.ssbwiki.com/Shield
- ssbw_shieldstun: https://www.ssbwiki.com/Shieldstun
- ssbw_perfect_shield: https://www.ssbwiki.com/Perfect_shield
- ssbw_stun: https://www.ssbwiki.com/Stun
- ssbw_edge: https://www.ssbwiki.com/Edge
- ssbw_tech: https://www.ssbwiki.com/Tech
- ssbw_lock: https://www.ssbwiki.com/Lock
- ssbw_air_dodge: https://www.ssbwiki.com/Air_dodge
- ssbw_roll: https://www.ssbwiki.com/Roll
- ssbw_gravity: https://www.ssbwiki.com/Gravity
- ssbw_air_acceleration: https://www.ssbwiki.com/Air_acceleration
- ssbw_fast_fall: https://www.ssbwiki.com/Fast-fall
- ssbw_short_hop: https://www.ssbwiki.com/Short_hop
- ssbw_double_jump: https://www.ssbwiki.com/Double_jump
- ssbw_wall_jump: https://www.ssbwiki.com/Wall_jump
- ssbw_distance_unit: https://www.ssbwiki.com/Distance_unit
- ssbw_1v1: https://www.ssbwiki.com/1v1_multiplier
- ssbw_rage: https://www.ssbwiki.com/Rage
- ssbw_stale: https://www.ssbwiki.com/Stale-move_negation
- ssbw_sakurai: https://www.ssbwiki.com/Sakurai_angle
- ssbw_di: https://www.ssbwiki.com/Directional_influence
- ssbw_sdi: https://www.ssbwiki.com/Smash_directional_influence
- ssbw_grab: https://www.ssbwiki.com/Grab
- ssbw_mash: https://www.ssbwiki.com/Button_mashing
- ssbw_b_reversing: https://www.ssbwiki.com/B-reversing
- ssbw_side_special: https://www.ssbwiki.com/Side_special_move
- calc: https://github.com/rubendal/SSBU-Calculator (commit 233590e94bc4bd8813f2d1a2af45c8c46648f351; js/formulas.js, js/knockback.js)
- calc_chars: https://github.com/rubendal/SSBU-Calculator (commit 233590e; Data/<fighter>/data.json, 89 fighters)
- calc_stages: https://github.com/rubendal/SSBU-Calculator (commit 233590e; Data/Stages/ssbustagedata.json, LVD-derived collision data)
- dataviewer: https://github.com/rubendal/ssbu (commit 2e8f0d245481cb0c936524b6ffe1cdea867c4f68; public/data/patch/13.0.1/character/<fighter>/data.json motion list: XluStart/XluEnd/CancelFrame)
- params_sheet: https://docs.google.com/spreadsheets/d/1UdH2L0xi8dO6jyPCcO5e5-8j7SGzezxkeZuF1uP8uOw (community dump of v13.0.1 common/battle_object params; names + descriptions are the sheet's)
- mmsp: https://gamebanana.com/mods/38616 (states vanilla values it overrides)
- ufd_stats: https://ultimateframedata.com/stats
- ufd_smash: https://ultimateframedata.com/smash
- ufd_mario: https://ultimateframedata.com/mario
- benarthur_shieldstun: https://twitter.com/BenArthur_7/status/1073252767496617986 ; https://twitter.com/BenArthur_7/status/1079237233192910849
- dragdown_grounded: https://dragdown.wiki/wiki/SSBU/System_Mechanics/Grounded_Movement
- bh_movement: https://brawlhalla.wiki.gg/wiki/Movement
- bh_attacks: https://brawlhalla.wiki.gg/wiki/Attacks
- bh_controls: https://brawlhalla.wiki.gg/wiki/Controls
- mvs_glossary: https://multiversus.wiki.gg/wiki/Glossary
- mvs_open_beta_v0: https://multiversus.wiki.gg/wiki/Patch_Notes/Open_Beta_V0
- mvs_season5_notes: https://www.eventhubs.com/news/2025/feb/04/patch-notes-final-season-multiversus/
- mvs_massivelyop: https://massivelyop.com/2022/07/29/hands-on-with-multiversus-how-wbs-new-brawler-stacks-up-against-super-smash-bros/
- mvs_gamesfuze: https://gamesfuze.com/guides/multiversus-movement-and-recovery-guide/
- verify_script: physics_verify.py, printed in full in physics-reference.md section 'Verification script'; cross-checked against the calc JS (45 vectors, 0 numeric mismatches)
- estimate: ESTIMATE by the researcher; reasoning given in physics-reference.md
- proposal: DESIGN PROPOSAL for Coolmath Smash, not a measured Ultimate value
