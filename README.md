# Crown of Static

An original browser bullet-heaven roguelite about a forgotten civilization where occult relics and broken machines became the same thing.

![Crown of Static key art](assets/ruin-keyart.webp)

## Play

Open `index.html` through a local web server:

```bash
npm run serve
```

Then visit `http://localhost:4173`.

## Controls

| Action | Keyboard |
| --- | --- |
| Move | `WASD` or arrow keys |
| Dash | `Space` |
| Relic pulse | `Q` |
| Pause | `Esc` |
| Pick an upgrade | `1`, `2`, `3` or mouse |

Touch controls appear automatically on touchscreen devices.

## Current build

- automatic targeting with a manual dash and defensive pulse;
- eight upgrade paths and a weapon fusion;
- three enemy bosses with absorbable abilities;
- four visual phases that change during a run;
- permanent Archive upgrades stored locally;
- procedural sound, particles, camera feedback and responsive controls;
- no runtime dependencies or build step.

The browser version is intentionally engine-free. Its systems are separated from rendering so a later desktop build can reuse the same balance and game data.

## Test

```bash
npm test
```

## Credits

Design, code and original art direction created for this project. Key art was produced specifically for Crown of Static and is not sourced from another game.

## License

Code is available under the MIT License. The artwork in `assets/` is included for this project and may not be redistributed separately.
