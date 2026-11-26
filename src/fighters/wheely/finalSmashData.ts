/**
 * Wheely's Final Smash, Full Throttle, on Captain Falcon's Blue Falcon in Ultimate 13.0.1 (SmashWiki, "Captain Falcon
 * (SSBU)/Final Smash" and "Blue Falcon"). Blue Falcon is Ultimate's car-hit Final Smash: the Blue Falcon "crashes
 * through the area directly in front of Captain Falcon", and whoever it hits is carried into a cutscene where Falcon
 * runs them over at full speed. Wheely is the car, so he crashes through himself, then backs up, revs and rams.
 *
 * - Timing: "Hitboxes 28-30" and "Animation length 97": FAF 98 when it catches nobody, since on a miss "the attack
 *   fails" and Falcon stays invincible until the animation ends.
 * - Hit area: three boxes on the top bone, radius 16.0, 18.0 and 16.0, at Y 12 and Z 13, 30 and 45 (Z is forward),
 *   all three out on frames 28-30. Wheely crosses them one a frame: his box rides 13 ahead of his feet, and he moves 0,
 *   17 and 15 units on frames 28, 29 and 30, so it lands on each in turn where the Blue Falcon puts it. The trap pulls
 *   the fighter it catches to his front bumper, so this keeps that pull within a box radius. All three boxes at once
 *   would catch a fighter 61 units ahead and pull it 48 units in one frame.
 * - Damage: the boxes deal 10.0%, the "Blue Falcon hit" 20.0% and the "Final launch" 10.0% at the Sakurai angle with
 *   BK 100 and KS 135, every one with hitlag x0.0: "Deals 40% if all hits connect." The catch's 10% and the
 *   run-over's 20% are hold hits; the final launch is the release.
 * - Not carried over: the boxes' own launch (angle 80, KS 100, FKV 200), which pops the victims up into the slow
 *   motion before the cutscene. The trap holds its catch instead. Ultimate's catches every fighter the boxes touch;
 *   the engine's trap holds the first (docs/fighters.md, "Final Smash").
 * - SmashWiki gives no activation freeze, cutscene length or KO percent, and ultimateframedata.com lists no Final
 *   Smashes. The default freeze (FINAL_SMASH.freeze, 40) would hold the others past frame 28, so the freeze is 26,
 *   the longest that lets the boxes come out on Blue Falcon's frames. The cinematic's timing is Wheely's own (an
 *   estimate), and the KO percent is the final launch's, through koPercent (finalSmash.test.ts).
 */
export const FULL_THROTTLE = {
  freeze: 26,
  /** Blue Falcon's hitbox frames. */
  hit: [28, 30] as [number, number],
  /** Blue Falcon's animation length is 97. */
  faf: 98,
  /** Blue Falcon's boxes: Z offset (forward) and radius, at height `y`. */
  boxes: [
    [13, 16],
    [30, 18],
    [45, 16],
  ] as const,
  y: 12,
  /** The share of his speed he keeps each frame once past the boxes, stamping on the brakes. */
  brake: 0.55,
  /** The catch: the Blue Falcon's body hit, landed on the cinematic's first frame. */
  crash: { frame: 1, damage: 10 },
  /** The run-over: the "Blue Falcon hit". */
  ram: { frame: 70, damage: 20 },
  /** The final launch: the release. */
  launch: { frame: 106, damage: 10, angle: 361, bkb: 100, kbg: 135 },
  /** The cinematic's FAF, from the catch (Wheely's own timing). */
  cinematicFaf: 140,
};

/** The Blue Falcon's far reach: its third box's front edge. */
export const FULL_THROTTLE_RANGE = FULL_THROTTLE.boxes[2][0] + FULL_THROTTLE.boxes[2][1];

/** Units Wheely moves on the window's frame `k` (0, 1, 2) so his box lands on the Blue Falcon's box `k`. */
export const dashStep = (k: number): number =>
  k === 0 ? 0 : FULL_THROTTLE.boxes[k]![0] - FULL_THROTTLE.boxes[k - 1]![0];

/**
 * The box Wheely carries through the window, one a frame: the move frame it is out on, then its place from his feet
 * (x forward, y up), 13 ahead of him at the radius of the Blue Falcon box it lands on. The move's hits and the bow
 * wave the art draws out to the box's front edge (art/finalSmash.ts) both read it.
 */
export const THROTTLE_BOXES: { frame: number; x: number; y: number; radius: number }[] =
  FULL_THROTTLE.boxes.map(([, radius], k) => ({
    frame: FULL_THROTTLE.hit[0] + k,
    x: FULL_THROTTLE.boxes[0][0],
    y: FULL_THROTTLE.y,
    radius,
  }));
