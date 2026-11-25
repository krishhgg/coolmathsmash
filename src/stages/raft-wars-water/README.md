# Raft War Lagoon

Hazards off keeps the symmetric legal layout: still water, a centered fixed boat, and both 60-unit shores.
With hazards on, the boat and cabin roof move together by ±3 units every four seconds. Starting at 40 seconds,
the tide repeats every 40 seconds: it rises 14 units over three seconds, holds for eight, and eases back over
three. The water is visual only; falling through it still uses the normal lower blast zone.

Deferred until the simulation supports them:

- Swimming and jumping out, plus a KO threshold measured from the active water surface.
- A wave that pushes fighters without dealing damage or causing hitstun.
- Tide-dependent sandbar widths and ledges. The shores stay fixed and solid at every tide height for now.
