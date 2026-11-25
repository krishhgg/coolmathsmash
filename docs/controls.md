# Controls

Two players share one keyboard; gamepads (standard mapping) add to the matching port (pad 1 → P1, pad 2 → P2,
and so on). Bindings live in `src/input/bindings.ts`.

| Action                      | P1 keyboard                          | P2 keyboard                 | Gamepad                |
| --------------------------- | ------------------------------------ | --------------------------- | ---------------------- |
| Move                        | W A S D                              | Arrow keys                  | Left stick             |
| Walk / tilt modifier (hold) | Left Shift                           | Right Shift or Numpad 0     | Tilt the stick partway |
| Attack                      | F                                    | J or Numpad 1               | A (bottom)             |
| Special                     | G                                    | K or Numpad 2               | B (right)              |
| Jump                        | H (or flick up, tap jump)            | L or Numpad 3 (or flick up) | X / Y                  |
| Shield                      | R                                    | U or Numpad 4               | LT / RT                |
| Grab                        | T                                    | I or Numpad 5               | LB / RB                |
| Smash attacks / aerials     | Tap a direction together with Attack | same                        | Right stick            |
| Taunt                       | E                                    | O or Numpad 6               | D-pad                  |

How Smash inputs map to a keyboard:

- **Dash vs walk**: tapping a direction dashes; holding the walk modifier walks.
- **Smash vs tilt**: pressing Attack within 4 frames of tapping a direction is a smash attack; holding the
  direction first (or holding the walk modifier) gives a tilt.
- **Tap jump** (flick up to jump) is on by default per port.
- When opposite directions are held, the most recently pressed one wins.

Rebinding (Controls screen) refuses layouts that would break a menu:

- **Keyboard**: Enter, Num Enter, Esc and Backspace can only be Pause; Space can only be Attack (`menuKeyConflict`).
  In a match Esc pauses whatever it is bound to, so Esc on Attack would pause on every attack. Esc also cancels a
  capture, so the screen never binds it; a saved layout that breaks the rule loads that keyboard half as its defaults.
- **Gamepad**: A cannot be Pause, because during a match the Pause buttons replace their menu jobs and A is the only
  pad button that selects Restart or Quit. Pause also keeps at least one button (`padMenuConflict`). Ultimate avoids
  both by never letting + be remapped. A saved mapping that breaks either rule loads as the defaults.

Debug: **F2** toggles the input display.
