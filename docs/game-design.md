# Stick Figure Fighter Game Design

## Creative Pillar

The game is a stick figure fighter based on courage, covenant loyalty,
discipline, and leadership. It draws inspiration from David, Jonathan, and the
mighty men without turning faith into a shallow power fantasy. Combat should
feel energetic and skillful, but the story rewards restraint, wisdom, loyalty,
and protecting others.

## Biblical Source Areas

- David as shepherd, musician, warrior, fugitive, and king
- David and Goliath as a courage-under-pressure story
- David and Jonathan as a covenant friendship and loyalty arc
- David's wilderness years as survival, discipline, and trust
- The mighty men as elite companions with distinct feats and personalities

Useful study areas include 1 Samuel 16-31, 2 Samuel 1, 2 Samuel 23, and
1 Chronicles 11.

## Player Fantasy

The player starts as a simple stick fighter and grows through training,
encounters, and choices. Instead of only becoming stronger, the player learns
when to strike, when to defend, when to spare, and when to stand with allies.

## Core Verbs

- Move
- Jump
- Dodge
- Block
- Parry
- Strike
- Grapple
- Throw
- Rally an ally
- Spare or finish an encounter

## Main Characters

### David

Fast, adaptive, and timing-focused. His fighting style emphasizes movement,
counterattacks, sling-based ranged pressure, and courage under pressure.

### Jonathan

Balanced and defensive. His style emphasizes protection, precise swordplay,
shield work, and ally support.

### Mighty Men

Each mighty man can become a playable fighter, rival, mentor, or challenge
encounter. They should have simple but memorable combat identities:

- Spear specialist
- Shield breaker
- Duelist
- Defensive wall
- Agile scout
- Heavy striker

## Story Structure

### Chapter 1: Shepherd Training

Learn movement, timing, guarding, and simple attacks through field training.

Programming concepts:
- Variables
- Input handling
- Game loop
- Player state

### Chapter 2: The Giant

A boss encounter focused on spacing, courage, and ranged timing.

Programming concepts:
- Collision boxes
- Attack cooldowns
- Boss states
- Win and loss conditions

### Chapter 3: Covenant Friendship

Introduce Jonathan, ally mechanics, sparring, and trust-based choices.

Programming concepts:
- Character classes
- Dialogue state
- Shared data structures
- Scene transitions

### Chapter 4: Wilderness

Survival encounters, ambushes, and restraint choices.

Programming concepts:
- Enemy AI
- Patrol behavior
- Simple decision trees
- Saving progress

### Chapter 5: The Mighty Men

Unlock arena challenges against elite fighters with distinct move sets.

Programming concepts:
- Move configuration
- Fighter archetypes
- Reusable components
- Balancing values

### Chapter 6: Online Arena

Bring unlocked fighters into friendly online matches.

Programming concepts:
- Authentication
- Realtime messages
- Matchmaking lobbies
- Networked state

## Combat Design

The first playable combat model should stay simple:

- Light attack
- Heavy attack
- Kick
- Spinning power kick
- Low strike
- High strike
- Block
- Dodge
- Jump
- Target zones for body, arms, legs, and head
- Stylized stick-part pop-off and reattach
- Attachable bonus limbs and weapon limbs
- Special move
- Health
- Stamina
- Round timer

Before a fight begins, the local build should open on a setup menu rather than
dropping immediately into combat. That menu should let the player choose mode,
difficulty, starting body-part loadout, random-drop rules, local test tools,
motion intensity, guard health, and hitbox visibility.

Every fighter should use the same underlying combat engine. Character identity
should come from configured movement speed, attack timing, range, recovery, and
special moves.

The detachable-part system should stay toy-like and non-gory. It exists to make
hit detection, movement penalties, and recovery choices visible: low strikes can
pop a leg loose and force hopping movement, arm strikes can limit offense or
guarding, and head strikes can create a scramble to recover control.

Loose parts are shared pickups, with only a small number allowed in the arena at
once so the screen stays readable. Any fighter can attach any loose part,
including parts knocked from an opponent. Extra arms improve attack options and
damage; reaching three or more arms adds extra strike hits. Extra legs improve
speed and jumping, and reaching three or more legs adds extra kick hits. The
power kick should read as a spinning commitment move: slower startup, bigger
knockback, and stronger payoff when extra legs are attached. Special neutral
drops can vary in size and add focused benefits such as spear-arm offense,
shield-arm guarding, swift-leg movement, or a watchful head that improves
blocking and dodging.

Parts-builder expansion:

- If a fighter loses their only head, movement controls reverse until they attach
  a replacement head.
- Animal parts can appear as neutral drops.
- Crocodile head restores head control and adds bite-style attack power.
- Strong tail improves balance, dodge feel, and heavy strike power.
- Claws add close-range strike pressure.
- Wings allow midair flaps and slower falls, turning jump into light flight.
- Animal parts unlock explicit context controls: crocodile head enables C chomp,
  tail enables T tail strike, claws enable V claw swipe, and wings change
  W/Space from a normal jump into flap-based flight.
- The control strip should only show animal ability buttons for parts the player
  currently has attached, making the fighter's body act like the move list.
- Local training builds can expose spawn buttons for animal parts so combat,
  pickup, and ability testing does not depend on waiting for random drops.

## Online Design

Supabase should handle:

- User accounts
- Player profiles
- Player avatars
- Online presence
- Lobby creation
- Lobby membership and ready state
- Matchmaking tickets
- Ready states
- Match records
- Leaderboards

Realtime combat can begin with Supabase Realtime for prototype matches. If the
game needs tighter fighting-game responsiveness, move live combat messages to a
dedicated realtime service while keeping Supabase for accounts and persistence.

## Multiplayer Architecture

The client should model online play before real networking is switched on:

- `profiles` store display names, favorite fighters, and avatar choices.
- `lobbies` store room code, level, mode, max players, and status.
- `lobby_members` store slots, chosen fighter, and ready flags.
- `matchmaking_tickets` store a player's search request for casual, ranked, or
  private play.
- `match_results` store durable history after a match completes.

Local mode should mirror those shapes in browser storage so UI and gameplay can
be built without needing a cloud project for every test.

Base fighters:

- David: agile, balanced, fast stamina recovery.
- Jonathan: stronger guard and steadier defense.
- Benaiah: heavier health and damage, slower movement.
- Asahel: fastest movement and dodge, lighter health and damage.
- Training Guard: balanced CPU baseline.
- Goliath: huge health, reach, and damage, but very slow movement, low jump,
  poor dodge, slower stamina recovery, higher stamina costs, and a larger
  hurtbox.
- Ishbi-Benob: spear-giant reach and strength with sluggish repositioning.
- Saph: durable heavy guard with a larger body and slower chase.
- Lahmi: lighter giant duelist with smaller drawbacks than Goliath.

Levels:

- Training Yard: simple local practice and hitbox learning.
- Shepherd Field: story-friendly movement space.
- Covenant Hall: defensive sparring and Jonathan-style guard play.
- Mighty Arena: wider parts-builder versus space and future 2v2 tests.

## Learning Path

The player-developer should learn by changing real game features:

- Change jump height to learn variables
- Add a punch to learn functions
- Add blocking to learn conditionals
- Add fighter states to learn state machines
- Add CPU behavior to learn AI
- Add a profile table to learn databases
- Add an online lobby to learn realtime systems
- Deploy a preview to learn web hosting
- Open a pull request to learn GitHub collaboration

## Tone

The game should feel adventurous, noble, and energetic. It should avoid mocking
or flattening the biblical material. The stick figure style can be playful, but
the story should treat courage, friendship, grief, mercy, and leadership with
respect.
