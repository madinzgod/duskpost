# duskpost

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/madinzgod/duskpost/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/madinzgod/duskpost/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**DUSKPOST** — a seaplane mail run at last light. You fly a twin-float mail plane in chase
view up a dusk archipelago of eight named islands: take off from the harbour water, thread
the glowing rings, land on island strips to deliver the post and refuel, and set down
beside a flaring boat when the rescue call comes — all before the light meter drains and
the run ends with the sun. Throttle and turn discipline matter: fuel burns, a hard arrival
costs hull, and smoke trails a hurt aeroplane home. The evening has weather to fly against:
a seeded wind that drifts her aloft and streams every strip's windsock, a 240 kg mail bag
that costs climb until it is delivered — and a storm cell standing off the course's west
side, its lightning and rain shaft visible from two islands away, its rough air announced
on the warning line. The route east of it is clear. Through it is shorter.

The whole game is hand-rolled canvas 2D pseudo-3D (layered sea and islands, scaling
sprites, one projection) with synthesized WebAudio sound — no engine, no assets, no
network. Source is split one job per file under `game/src/`: `flight-physics.js` flies
her, `archipelago.js` builds the islands, `seaplane.js` draws the aircraft,
`instruments.js` draws the lit HUD and panel, `missions.js` rotates the work,
`render.js` draws the world, `sound.js` makes every noise, `input.js` reads the
controls, `shots.js` stages the deterministic screenshot scenes.

Controls: **W/S** throttle · **↑/↓** pitch · **←/→** bank · **Space** brake · mouse
steers too.

## Run it

```sh
node serve.ts   # then open http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=nnk13219&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
