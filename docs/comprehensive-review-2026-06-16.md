# Comprehensive Review - 2026-06-16

## Scope

Reviewed the current browser game build across:

- Menu and fight CSS cascade
- Mobile portrait and landscape layout risks
- Spritesheet asset references and runtime frame cells
- Combat timing, guard, parry, stale-combo, hitbox, and hurtbox flow
- Online lobby and rollback netplay launch path

## Findings And Fixes

### Fixed: Dynamic touch controls were styled by old fixed IDs

The fight CSS still colored attack buttons by fixed diamond position IDs. The touch controls are now dynamic per fighter, so an action like Moranatee's right-side "Splash Slam" could inherit the old right-button color instead of the actual heavy-attack color.

Fix:

- Removed stale fixed-ID color selectors.
- Attack button color now follows `data-touch-action` only.

Files:

- `src/styles.css`

### Fixed: Unsupported 2v2 option could create invalid online lobbies

The UI exposed "2v2 Future" while rollback input storage currently supports one remote input stream for 1v1. Starting a 4-player lobby would not have a valid simulation model.

Fix:

- Disabled the 2v2 option in the menu.
- Clamped launch settings to the supported 1v1 mode.
- Blocked unsupported existing 4-player lobbies from starting synced combat.
- Updated lobby action text to show "1v1 Only" for unsupported lobbies.

Files:

- `index.html`
- `src/main.ts`

### Improved: Mobile menu scroll behavior

The app shell intentionally locks document scrolling outside fight mode. The menu form is the real scroll container, so mobile scrolling needs to stay smooth and contained.

Fix:

- Added contained overscroll and touch momentum scrolling to the active menu scroll container.

Files:

- `src/styles.css`

## Sprite Audit

Ran a pixel-level audit of every configured runtime spritesheet frame used by the character sheet configs.

Results:

- No missing configured runtime spritesheet assets found.
- No frame indexes out of range.
- No referenced empty or near-empty frames.
- No referenced frames touching cell edges.
- No tiny referenced frames below configured usability thresholds.

Notes:

- Some sheets have high dark-pixel ratios, but those are consistent with black outlines and darker character palettes rather than isolated artifact frames.
- Current evidence points away from sheet-cell wraparound as the active cause of sprite defects in the configured frames.

## Combat Review

Reviewed the main combat paths:

- Attack box and target hurtbox intersection
- Perfect block/parry counter windows
- Guard crush and block stamina damage
- Stale combo penalties
- Received-hit pressure and breakaway knockback
- Training guard cooldown and hit suppression

Result:

- No combat math defect justified a code change in this pass.
- The parry condition is tied to the short guard-lock timer opened when blocking an incoming attack, so it functions as a timed block window rather than indefinite blocking.

## Netcode Review

Reviewed lobby start, realtime room state, input-frame broadcast, rollback prediction, input delay adaptation, and remote input trimming.

Result:

- The current rollback bridge is coherent for 1v1.
- The unsupported 4-player UI path was the primary netcode risk and is now blocked.

## Follow-Up Risks

- CSS still has historical cascade debt. The authoritative mobile/fight rules are now at the end of the file, but a full stylesheet split would be a separate refactor.
- True multi-player online combat needs a map of remote inputs by frame and participant, plus team/slot simulation rules, before 2v2 can be enabled.
- A full visual frame gallery should be generated as a CI artifact before large future sprite imports.
