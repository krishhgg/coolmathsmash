# Coolmath Smash

A browser platform fighter in the spirit of Super Smash Bros. Ultimate, starring the OG (2015-and-earlier) Coolmath Games cast: Papa Louie, Fireboy & Watergirl, the Runner from Run, Bob the Robber, Snail Bob, Red Ball, the Duck Life duck, and more.

Built for a video game class project. Work in progress.

## Slipstream

Run `npm ci` and `npm run dev`, then open `/flight.html` for the Harbor Run time trial. The 3D scene uses WebGL 2.

Use W to thrust, A/D to turn, Space/C to climb or dive, Shift to boost, S to brake, and R to reset. Touch devices show the same flight controls on screen. Pass through all seven gates in order to record a time.

Run `node scripts/flight-tune.ts --check` to replay the tuning passes and verify the settings used by the game. The benchmark measures response time, braking distance, bank angle, and how quickly the arms settle after a turn.
