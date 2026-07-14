# 🐦 Flappy Darwin

A pixel-art **roguelike flappy game** about flying through a living forest,
eating, digesting and evolving. Flap between the great branching trees, manage
your wing energy, catch food on your beak, graze safely along the treetops,
dodge snakes, hawks, carnivorous pitchers and falling durians, chase glowing
bugs — then rest at **the nest**, where each new **generation** of finches
hatches with a fresh mutation. Bank **DNA** across runs and, when you fall,
hatch again from your last checkpoint. Charles Darwin himself guides you in.

![Main menu](docs/menu.png)

## Meet your guide

On your first flight (or any time via the **TUTORIAL** menu), **Charles Darwin**
walks you through the basics with an interactive, step-by-step tutorial that
waits for you to actually flap, eat, digest and graze before moving on.

![Darwin's interactive tutorial](docs/tutorial.png)

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
4. **Bonus mini-games.** Between obstacles a surprise event may appear:
   - 🐛 **Bug chase** — a glowing beetle darts ahead; pursue and snatch it.
   - 💨 **Thermal ring** — fly cleanly through the glowing hoop for a PERFECT
     boost, full energy and bonus.
   - 🍓 **Fruit rush** — a wave of fruit floods in; feast for a combo bonus.
5. **Boost to escape.** Double-tap (double-click / double-press) to **dash** — a
   burst of speed that costs wing energy. Use it to outrun what's chasing you.
6. **Dodge the dangers.** Every threat is **telegraphed and fair**:
   - 🐍 **Canopy snakes** rear up and strike — and if one hits, it **latches on**;
     **tap fast (swipe 5×) to shake it off** before it drains you.
   - 🦅 **Falcons** chase you down from behind — **boost away** or juke them.
   - 🕷️ **Spiders** drop on a silk thread into the gap — weave above or below.
   - 🐝 **Wasp swarms** buzz in and home on you — keep moving to lose them.
   - 🌿 **Pitcher plants** bubble in the undergrowth, then lunge — stay high.
   - 🦅 **Hawks** cast a warning shadow, then dive — drop low.
   - 🥭 **Durians** hang from branches and *drop* when you near them — move!

## Boss: The Great Eagle

Every few migrations the path leads to **THE AERIE**, where a giant raptor
boss attacks in telegraphed patterns — dive-bombs, talon sweeps and
feather-storms. Outlast its stamina by dodging, and it's driven off for a big
reward (and an extra heart).

![The Great Eagle boss stage](docs/boss.png)

![A canopy snake latches on — swipe to shake it off](docs/snake-latch.png)
6. **Rest at the nest.** Arriving at a grove triggers a landing cutscene with a
   sweeping **overview pan** across the clearing. When enough food is banked, an
   egg in the nest **hatches a new generation** — you pick the trait it
   inherits — then you choose your next migration path.

![The nest — hatch a new generation](docs/nest.png)

## Generations, traits & DNA

Digested food fills your **hatch meter**. At the nest a new generation hatches
and inherits one of three traits, drawn by **rarity** — <span>COMMON</span>,
**RARE** or **EPIC** — and weighted by what your flock has been eating. Spend
banked **DNA** to **reroll** the offered traits.

![Hatching a new generation — rarity traits + DNA reroll](docs/hatch.png)

**DNA is permanent.** You earn it every run and it is saved between runs. Each
leg you reach becomes a **checkpoint**, so when a finch dies you can **hatch
again from your last nest** — for a cost in DNA — keeping your build and depth,
or start a fresh **new lineage**.

![Extinction — hatch from your checkpoint or begin anew](docs/checkpoint.png)

Traits: Mighty Wings · Hollow Bones · Tail Rudder · Glider Wing · Wide Beak ·
Rapid Gut · Crop Pouch · Iron Gizzard · Downy Plume · Sweet Tooth · Bug Snatcher ·
Feather Shield · Second Stomach · Big Lungs · Light Frame · Sun Feathers ·
Keen Forager · Nimble Frame · Iron Beak · **Aerial Master** · **Apex Instinct**.

## Biomes & environments

Ten biomes across four environments — forest, ocean, tundra and desert — each
with its own trees/obstacles, light, food and dangers. Paths branch and
difficulty ramps the deeper you migrate.

| Biome | Env | Obstacles | Hazards |
|---|---|---|---|
| 🌼 **Meadow Isles** | forest | leafy oaks | — |
| 🌲 **Pinewood Reach** | forest | conifers | durians |
| 🌰 **Oaknut Grove** | forest | golden oaks | pitchers, durians |
| 🐛 **Buzzing Marsh** | forest | mangroves | — |
| 🐍 **Mire Swamp** | forest | cypress | snakes, pitchers |
| ⛰️ **Storm Crags** | forest | rock spires | hawks, falcons |
| 🌴 **Lush Jungle** | forest | broadleaf + vines | everything |
| 🌊 **Coral Coast** | ocean | swaying palms | falcons |
| ❄️ **Frost Reach** | tundra | snow-laden pines | falcons, hawks, gusts |
| 🏜️ **Dune Sea** | desert | saguaro cacti | snakes, falcons |

![Dune Sea — desert environment with cacti](docs/desert.png)

![Frost Reach — tundra with snowfall](docs/tundra.png)

![A golden jungle, evolved](docs/jungle.png)

Traits stack across generations and **visibly change the bird** — bigger wings,
wider beak, a fanned tail, a growing crest. Every run is procedural: layouts,
food, paths and dangers differ each time.

![Branchy trees in golden light](docs/forest.png)

## Look & feel

- A **Slay-the-Spire-style** interactive main menu — a framed wooden title
  banner, glowing wooden card buttons, Darwin's sign, and DNA/best plaques.
- A cohesive **wooden, Stardew-Valley-style UI** across every panel, card and
  sign — carved frames, dark boards and corner nails.
- Layered, branchy **background forests** with lit organic canopies and depth,
  god-rays, drifting pollen and per-biome light.

## Tech

- Pure vanilla JavaScript + HTML5 canvas, **zero dependencies**
- 320×180 internal resolution, integer-scaled with crisp pixels
- Every sprite authored in-code as pixel character maps (`js/sprites.js`)
- Procedural forest, trees, grove, parallax depth and light drawn per-pixel
  (`js/game.js`)
- All sound effects synthesized live with WebAudio (`js/audio.js`)
- 3×5 bitmap font (`js/font.js`)

`tools/preview.html` renders the whole sprite sheet for art iteration.
