---
name: zen-sand-ui
description: Build, change or wire in a UI control made of simulated sand (a height field that slumps to its angle of rest, lit on the GPU), using the Zen Sand UI core. Use when asked to add one of the sand-* controls to an app, to change how one behaves, or to make a new control in the same style. Covers the core's API, the rules the set follows (keep the sand's volume, one surprising idea per control, test on a slowed CPU), and wiring a control into a page.
---

# Zen Sand UI

A Zen Sand control is an ordinary control (a slider, a switch, a button) made of a tray of sand that moves like sand. The slider is a rake that cuts grooves; the toggle is a stone that glides and leaves a wake; the thinking state's sand rakes itself into a different line for each thing an AI agent does. The sand is a real simulation, not a picture: a height field, one cell per CSS pixel, that you carve in JavaScript and that slumps to its angle of rest, lit by a WebGL2 shader.

This skill comes with three things:

- `core.js`: the engine. Load it and everything is on `window.ZenSand`.
- `starter.html`: the smallest whole control, a tray you draw in with a finger. Copy it to start a new one.
- `look.mjs`: opens a page with the CPU slowed four times, photographs an element at chosen moments side by side, and prints frame times.

If the job is only to put an existing control into an app, skip to **Wire it in**.

## 1. Decide two things first

1. **The control.** It must still be that control without the sand: a role (`slider`, `switch`, `img`, `status`), focus, keys, the events a native one fires, and a form value if it has one (`static formAssociated = true`, then `this.formValue(v)`).
2. **One surprising idea.** A believable motion is not enough. Every control that worked in this set has one thing sand does that nobody expects from a control: the toggle's stone hides a symbol it has pressed into the sand, and moving it uncovers it; the thinking state rakes a different line for each thing the agent does. A stone that just sinks when pressed was called "kind of lame", and it was. Find the idea before writing code.

## 2. The core

```js
const { Sound, SandTray } = window.ZenSand;
class SandThing extends SandTray {
  get aspect() { return 0.3; }   // height / width
  init() {}                      // once: roles, keys, listeners
  layout() {}                    // after each resize: lay the sand down in this.h
  step(dt) {}                    // each frame: move, carve, relax
  sprites() {}                   // each frame: draw what is not sand on this.ox
}
```

- **The sand.** `this.h` is a `Float32Array` of heights, `this.W` by `this.H`, one cell per CSS pixel. `this.inside[i]` is 1 inside the tray. `this.inner` is the tray's inside box (`x0, x1, y0, y1`). Set `this.dirty = true` after you change `this.h`, or nothing is redrawn.
- **Slumping.** `this.relax(xa, xb, iters)` lets sand slide downhill between columns `xa` and `xb` until no step is steeper than `this.talus`. Call it where sand moved, every frame something moves. A `hold` mask (`this.hold = new Uint8Array(W * H)`) marks cells that do not move, such as under a rock.
- **Patterns.** `this.lines(x, y, n, seed)` is n hand-wobbled raked lines across the tray; `this.groove(t)` is one groove's cross-section.
- **Pushing.** `this.push(i, extra, dir, k0, reach, spread)` puts `extra` sand ahead of cell `i` in direction `dir` along x: the bow wave in front of a rake or a stone. Sand pushed into the rim piles up against it.
- **Stones.** `this.stone = [x, y, rx, ry]` draws one stone in the shader, lit like the sand, with `this.lift` for its height (its shadow grows) and `this.stoneA` for its opacity. `this.stones = [[x, y, rx, ry, lift, alpha, shadow], ...]` draws up to four more.
- **The overlay.** `this.o` / `this.ox` is a 2D canvas over the tray for sprites (a rake, a stick, a rock image). It is `this.k` device pixels per CSS pixel. To let a sprite hang past the tray, enlarge it and offset its transform (see `signature.js` and `thinking.js`, `this.om`).
- **Frame thickness:** `get padRatio() { return 0.065; }` (default 0.12 of the height).
- **Sound.** `Sound.add({ name: 'data:audio/...' })`, `Sound.play(name, gain, rate)` (a name with a `-b` take alternates between the two), `Sound.loop(name)` returns `{ s, g }` (source and gain) to drive every frame. Call `Sound.wake()` on the first gesture.
- **Names the core uses on `this`:** `c o ox gl prog tex u h inside hold W H k pad talus moved dirty stone stones moss lift stoneA stoneShape last running tick internals`. Do not use them for your own state. (`this.u` holds the shader's uniforms; `this.last` is the frame clock.)

## 3. Rules the set learned the hard way

- **Keep the volume.** When something digs a groove, the sand it takes out must land somewhere: beside the groove, ahead of the rake. Sand that just disappears looks painted, not pushed. Never put it behind a moving tool, or a ridge forms down the middle of its path.
- **Carve in small steps.** A tool that moves 20 pixels in a frame must cut every pixel along the way (sub-steps of about half a tine's radius), or it leaves a row of dents.
- **Relax every frame, near where things moved.** Sand that never slumps looks like plastic; relaxing the whole tray every frame is too slow.
- **Test on a slowed CPU.** Your machine is much faster than a phone. `node look.mjs URL out.png 1,3,5 your-element` reports frame times with the CPU slowed four times; aim for a median of 16.7 ms. The sand only needs one cell per CSS pixel; the light is what needs the screen's resolution, and that is the shader's job.
- **Gentle, not quick.** A stone that glides over a second reads as heavy and calm. Snappy UI timing looks wrong in sand.
- **Let a finger scroll the page.** Set `touch-action: pan-y` on anything that is not a drawing surface, take the pointer only after it moves sideways, and make taps `click`s, so a scroll that starts on a tray changes nothing.
- **Things nobody can see should not make sounds.** When the thinking state lost its rake, its wooden tap went too.

## Wire it in

1. Save the control's file into the project (`npx shadcn add finktheartist/zen-sand-ui/NAME` puts it in `public/zen-sand-ui/`). Do not rewrite or split it: the engine and the sounds are inside.
2. Load it with a plain `<script src>`, not as a module. Use the element; each control's README has its attributes and events.
3. Give it a CSS `width`; its height follows. It needs WebGL2, and it is made for a light page.
4. Sound plays after the first touch or key on the page. If the app has a mute setting, set `ZenSand.Sound.on` from it.
5. Labels: the slider and toggle do not draw their own label. Put the setting's name and value beside them, as the gallery does.

## Check it

- Open its demo page, use it with a mouse, a finger (device emulation) and the keys.
- Run `node look.mjs URL out.png 0.5,1.5,3 your-element` and read the frames: are the grooves where you meant, is any sand vanishing, are the frame times near 16.7 ms?
- In the repo, `node tools/test.mjs URL` drives every control in the gallery with touch and keys and checks the form values.
