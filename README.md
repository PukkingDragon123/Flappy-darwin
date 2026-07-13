# 🐦 Flappy Darwin

A pixel-art **roguelike flappy game** about flying through a living forest,
eating, digesting and evolving. Flap between the great trees, manage your wing
energy, catch food on your beak, graze safely along the treetops, dodge snakes,
hawks, carnivorous pitchers and falling durians, chase glowing bugs — then rest
at **the nest**, where each new **generation** of finches hatches with a fresh
mutation. Or go extinct trying.

![Title screen](docs/title.png)

## How to play

Open `index.html` in any modern browser. No build step, no dependencies.

| Input | Action |
|---|---|
| `Space` / `↑` / `W` / tap / click | Flap (costs wing energy; hold to glide, once evolved) |
| `←` `→` / `A` `D` / tap a card | Choose a hatchling trait or migration path |
| `Enter` / `Space` / tap selected card | Confirm choice |
| tap during arrival | Skip the nest cutscene |
| `P` | Pause · `M` Mute · `R` Restart |

## The forest

You're not over the ocean — you're deep in a **living forest**: layered trees
receding into misty depth, shafts of light through the canopy, drifting pollen,
and an undergrowth floor of ferns, bushes, mushrooms and fallen logs. Fall into
the undergrowth and you'll get hurt.

![Flying through the forest](docs/flight.png)

## The loop

1. **Manage your wings.** Every flap spends **wing energy** (the green bar).
   It refills over time, faster while **gliding**, and topping it up by
   **eating** and **grazing treetops** — so when you run low, slide and feast
   instead of hammering the flap key.
2. **Graze, don't crash.** The leafy **tops of trees are soft** — skim and slide
   along a canopy safely (it even restores energy). Only the woody **trunk
   core** deals damage.
3. **Eat.** Food floats in your path — seeds, berries, nectar, nuts, grubs,
   frogs, mangoes and rare golden fruit. Catch it **on your beak** and it sits
   there while you **digest**. You can't grab more until it goes down — and
   over-gulping leaves you **STUFFED**: heavy and weak-winged.
4. **Chase the bug.** Now and then a glowing beetle darts ahead — pursue it and
   snatch it for a big burst of score, evolution and full energy.
5. **Dodge the dangers.** Every threat is **telegraphed and fair**:
   - 🐍 **Canopy snakes** rear up in the trees (watch the aim-dots) then strike.
   - 🌿 **Pitcher plants** bubble in the undergrowth, then lunge — stay high.
   - 🦅 **Hawks** cast a warning shadow, then dive — drop low.
   - 🥭 **Durians** hang from branches and *drop* when you near them — move!
6. **Rest at the nest.** Arriving at a grove triggers a landing cutscene with a
   sweeping **overview pan** across the clearing. When enough food is banked, an
   egg in the nest **hatches a new generation** — you pick the trait it
   inherits — then you choose your next migration path.

![The nest — hatch a new generation](docs/nest.png)

## Biomes

Seven biomes, each with its own trees, light, food and dangers. Paths branch and
difficulty ramps the deeper you migrate.

| Biome | Look | Food | Hazards |
|---|---|---|---|
| 🌼 **Meadow Isles** | bright leafy oaks | berries, seeds | — |
| 🌲 **Pinewood Reach** | misty conifers | seeds, nuts | durians |
| 🌰 **Oaknut Grove** | golden oaks | nuts | pitchers, durians |
| 🐛 **Buzzing Marsh** | mangroves + reeds | bugs | — |
| 🐍 **Mire Swamp** | mossy cypress | grubs, frogs | snakes, pitchers |
| ⛰️ **Storm Crags** | rock spires | golden fruit | hawks, wind |
| 🌴 **Lush Jungle** | broadleaf + vines | mango, gold | everything |

![A golden jungle, evolved](docs/jungle.png)

## Generations & traits

Digested food fills your **hatch meter**. At the nest a new generation hatches
and inherits one of three traits, weighted by what your flock ate. Traits stack
across generations and **visibly change the bird** — bigger wings, wider beak,
a fanned tail, a growing crest.

![Choosing a hatchling's trait](docs/hatch.png)

Mighty Wings · Hollow Bones · Tail Rudder · Glider Wing · Wide Beak · Rapid Gut ·
Crop Pouch · Iron Gizzard · Downy Plume · Sweet Tooth · Bug Snatcher ·
Feather Shield · Second Stomach · **Big Lungs** · **Light Frame** · **Sun Feathers**
(the last three tune your wing energy).

Every run is procedural — layouts, food, paths and dangers differ, death is
permanent, and only your best score survives (stored locally).

![Grove in golden light, with a falling durian](docs/forest.png)

## Tech

- Pure vanilla JavaScript + HTML5 canvas, **zero dependencies**
- 320×180 internal resolution, integer-scaled with crisp pixels
- Every sprite authored in-code as pixel character maps (`js/sprites.js`)
- Procedural forest, trees, grove, parallax depth and light drawn per-pixel
  (`js/game.js`)
- All sound effects synthesized live with WebAudio (`js/audio.js`)
- 3×5 bitmap font (`js/font.js`)

`tools/preview.html` renders the whole sprite sheet for art iteration.
