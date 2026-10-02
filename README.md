# Custom MIDI controller for Schwung

Customisable MIDI controller for use on Ableton Move with Schwung installed.

## Prerequisites

- [Schwung](https://github.com/charlesvestal/schwung) installed on your Ableton Move

## Features

- 16 Banks of custom pads/knobs/buttons
- Configurable MIDI channel per bank, and per pad/knob/button
- Configurable output destination per bank, and per pad
- Adjust Pad (level) velocity for bank and individual pads
- Change MIDI note for pads or cc for pads/knobs/buttons
- Change colour of banks, pads, knobs and buttons
- Assign a name to banks, pads, knobs and buttons
- Change knobs between relative or absolute values
- Optional Knob Pages per bank: top pad row (25-32) becomes page selectors for 8 pages of knob mappings
- Optional Pad Pages per bank: a second page of 32 pads (64 total, Push-style) switched via Up button or jog click
- Optional Pad Layout per bank: chromatic keyboard across all 32 pads with +/- octave shift
- Optional MIDI In per bank: incoming external CCs update knob/button/pad state so LEDs and values stay in sync
- Optional Scenes per bank: Row1-4 buttons switch between 4 full control layers (pads + knobs + buttons)
- Adjust pad mode per bank and per pad (Note/CC)
- Adjust pad release behaviour per bank and per pad (Pad Offs, including Toggle)
- Adjust button release behaviour per bank and per button (Button Offs, including Toggle)
- Open from Tools Menu (Shift + Step13)
- Three output options: external, move, schwung

> **Note:** When you change a bank-level setting for MIDI Channel, Pad Offs, Pad Mode, Button Offs, or Output, any matching individual pad/knob/button overrides for that bank are reset to follow the bank setting again.

## Building

```bash
./scripts/build.sh
```

## Installation

Through the Schwung module store (move.local:7700/modules). Or manually:

```bash
./scripts/install.sh
```


## Quick Start Guide

### 1. Launch the Controller from the Tools Menu
- Open the Tools Menu (Shift + Step13)
- Navigate to **Custom MIDI Control**

### 2. First Test
- Press **Bank 1** (step button 1)
- Hit any **pad** - you should hear a note
- Turn any **knob** - you should see the overlay

### 3. Your First Customization
- Press **Menu** button
- Press a **pad** to select it
- Use **jog wheel** to scroll to "Note"
- **Click jog** to edit
- **Turn jog** to change the note
- **Click jog** again to save
- Press **Back** to exit settings
- Test your pad!

## Settings Menu

### Entering Settings

**Press the Menu button** to enter settings mode.

### Navigation
- **Menu** = Enter/exit settings
- **Back** = Exit settings / Exit Control (when not in settings)
- **Jog wheel** = Scroll
- **Click jog** = Edit/Save
- **Step 1-16** = Change banks

### Pad Settings

Select a pad (press it):

| Setting | Range | Description |
|---------|-------|-------------|
| **Note** | 0-127 | MIDI note number to send (Note mode) |
| **CC** | 0-127 | MIDI CC number to send (CC mode) |
| **MIDI Channel** | Bank, 1-16 | MIDI channel (Bank = use bank channel) |
| **Name** | Text | Custom name for the pad |
| **Colour** | 0-127 | LED colour |
| **Pad Level** | 0-200% | Velocity multiplier |
| **Choke Grp** | 0-8 | Choke group (0 = none) |
| **Pad Offs** | Bank / On/Off / On Only / Toggle | Pad-off behaviour (Bank = use bank setting) |
| **Pad Mode** | Bank / Note / CC | What the pad sends (Bank = use bank setting) |
| **Output** | Bank / external / move / schwung | MIDI output destination (Bank = use bank setting) |

**Editing Name:**
1. Select "Name"
2. Click jog wheel
3. Use the on-screen keyboard to type
4. Click jog wheel when done

### Knob Settings

Touch a knob:

| Setting | Range | Description |
|---------|-------|-------------|
| **CC** | 0-127 | MIDI CC number to send |
| **MIDI Channel** | Bank, 1-16 | MIDI channel (Bank = use bank channel) |
| **Name** | Text | Custom name for the knob |
| **Colour** | 0-3 | LED colour scheme |
| **Min Value** | 0-127 | Minimum output value |
| **Max Value** | 0-127 | Maximum output value |
| **Multiplier** | 0.25x/0.5x/0.75x/1x/2x/3x/4x/6x/8x | Step size for absolute knob changes |
| **CC Relative** | On/Off | Relative mode (for endless encoders) |

### Button Settings

Press a button (except Menu, Back or Shift):

| Setting | Range | Description |
|---------|-------|-------------|
| **CC** | 0-127 | MIDI CC number to send |
| **MIDI Channel** | Bank, 1-16 | MIDI channel (Bank = use bank channel) |
| **Name** | Text | Custom name for the button |
| **Colour** | 0-127 | LED colour |
| **Button Offs** | Bank / On/Off / On Only / Toggle | Button-off behaviour (Bank = use bank setting) |

### Bank Settings

Press a step button:

| Setting | Options | Description |
|---------|---------|-------------|
| **MIDI Channel** | 1-16 | MIDI channel for this bank |
| **Name** | Text | Custom name for the bank |
| **Bank LED** | 0-127 | LED colour |
| **Master Pad Level** | 25-250% | Velocity multiplier for all pads |
| **Min Pad Level** | 0-127 | Velocity minimum for all pads |
| **Pad Offs** | On/On Only/Toggle | Pad-off behaviour for all pads |
| **Pad Mode** | Note/CC | Pads send MIDI notes or CC values |
| **Knob Pages** | On/Off | Top pad row (25-32) selects between 8 knob pages |
| **Pad Pages** | Off / Up Toggle / Up Hold / Jog Toggle | Second page of 32 pads; page control style (mutually exclusive with Knob Pages) |
| **Pad Layout** | Off / Chromatic / Rows +4 / Rows +5 | Pads become a keyboard; Up/Down shift octaves |
| **KB Root** | 0-96 | Keyboard root note (only shown when Pad Layout is on) |
| **MIDI In** | On/Off | Incoming external CCs update this bank's control state |
| **Scenes** | On/Off | Row1-4 buttons select between 4 sub-banks, each with the full option set |
| **Button Offs** | On/On Only/Toggle | Button-off behaviour for all buttons |
| **Output** | external/move/schwung | MIDI output destination |
| **Show Overlay** | On/Off | Display info when pressing pads/knobs |
| **H/light Colour** | Slight Dim / Full Dim / Black / White / Light Grey / Dark Grey / Blue / Green / Red / None | Pad press highlight colour. Slight/Full Dim use a dimmed version of the pad colour when pad colour is 1–26; otherwise White. None turns highlight off. |

### Visual Feedback
- **White pulse** = Item is selected (in settings)
- **White flash** = Pad is pressed (white is the default highlight colour, this can be changed in Bank settings)
- **Knob LEDs** = Show current value
- **Step LEDs** = Show active bank (selected colour or white) vs inactive (gray)

## Advanced Features

### Choke Groups

Choke groups allow pads to **cut each other off** when triggered - perfect for hi-hats!

**How it works:**
1. Set multiple pads to the same choke group (1-8)
2. When you press pad A (choke group 1)
3. Any other pad in choke group 1 that's playing will be stopped
4. This creates realistic hi-hat open/close behavior

**Example Setup:**
```
Pad 1: Hi-Hat Closed  - Choke Group 1
Pad 2: Hi-Hat Open    - Choke Group 1
Pad 3: Hi-Hat Pedal   - Choke Group 1
```

Now playing "closed" automatically stops "open" and vice versa!

**Tip:** Use choke group 0 (default setting) to disable choking for a pad.

### Velocity Scaling

Control how sensitive pads are to your playing dynamics:

**Pad Level (per pad):**
- 50% = Half velocity
- 100% = Normal (default)
- 200% = Double velocity

**Master Pad Level (per bank):**
- Multiplies ALL pad velocities in the bank

**Min Pad Level (per bank):**
- Minimum velocity of ALL pads in the bank

**Formula:**
```
Output Velocity = Input × (Pad Level / 100) × (Master Level / 100) > Minimum Pad Level || Minimum Pad Level
```

**Example:**
```
Input: 100
Pad Level: 90%
Master Level: 150%
Output: 100 × 0.9 × 1.5 = 135 (max capped at 127, min at Bank's Min Pad Level)
```

### Output Options

**Output (external):** MIDI goes to external devices via USB
- Use with external synths, DAWs, or hardware
- Requires MIDI device connected
- Default setting

**Output (move):** MIDI goes to Move's internal instruments
- Use when you want to play Move's built-in drums and/or synths
- No external MIDI device needed

**Output (schwung):** MIDI goes to Schwung's sound generators
- Use when you want to play Schwung's built-in sounds
- No external MIDI device needed

**Tip:** You can have different banks in different output modes - Bank 1 for external gear, Bank 2 for Move's synths, Bank 3 for Schwung!

### Pad-Offs and Button-Offs

**On/Off:** Send note-off when pad or button is released
- Default behaviour for pads
- Use for melodic instruments
- Allows notes to sustain until you release

**On Only:** Don't send note-off or CC Off value messages
- Default behaviour for buttons
- Use for drum machines
- Each hit is independent

**Toggle:** Toggle between note-on/note-off or CC On/Off (127/0) messages
- Use as a control surface


### Relative Knob Mode

**Absolute Mode (default):**
- Knob position = MIDI value
- Jumping when you touch a knob is normal
- Good for parameters with clear ranges

**Relative Mode:**
- Knob sends +/- changes
- No jumping
- Perfect for controlling plugins with existing values
- Good for volume/filter controls

### Knob Pages

Enable **Knob Pages** in a bank's settings to turn the top pad row (pads 25-32) into knob page selectors:

- **Pad 25** selects page 1 - the bank's existing knob mappings
- **Pads 26-32** select pages 2-8 - 7 additional pages of 8 knob mappings each (56 extra mappings per bank)
- The lit pad shows the active page; the overlay shows the bank name and page number (or page name)
- Each page can be named: in a knob's settings on that page, use **Page Name**
- The master knob is shared across all pages
- Each page's knobs have their own CC, name, colour, range, multiplier and relative/absolute settings - configure them in Settings just like normal knobs

When Knob Pages is off (default), pads 25-32 behave as normal pads. Existing pad configurations are preserved when you toggle the feature, so you can switch it on and off without losing mappings.

### Pad Pages

Enable **Pad Pages** in a bank's settings to double the pad grid to 64 pads (Push-style 8 per column):

- **Page 1** is the bank's existing pads; **page 2** is a full second set with their own note/CC, name, colour, level, choke group, pad-offs and pad-mode settings - defaults are offset by one grid (CC 33-64, notes 68-99)
- Toggle state and MIDI In sync are tracked per page - switch back and everything is where you left it
- Pads held across a page flip still send their note-off/CC-off correctly

**Page controls** (choose per bank):

| Mode | Behaviour |
|------|-----------|
| **Up Toggle** | Press the +/Up pad button to flip pages; its LED shows the page (bright = page 2, dim = page 1) |
| **Up Hold** | Hold +/Up for page 2, release to return to page 1 |
| **Jog Toggle** | Click the main jog wheel to flip pages (main view only) |

When a page control uses the Up button, that button's own mapping is unavailable for the bank. **Pad Pages, Knob Pages and Keyboard Layout are mutually exclusive** - enabling one turns the others off.

### Keyboard Layout

Set **Pad Layout** in a bank's settings to turn the whole 32-pad grid into a chromatic keyboard. Two layouts:

- **Chromatic**: pads ascend left-to-right, bottom row lowest - 32 consecutive semitones (over 2.5 octaves) from the **KB Root** note (default C2)
- **Rows +4**: overlapping rows - each row ascends chromatically but starts only +4 semitones above the row below (major-thirds tuning), so shapes repeat every third row and the grid covers ~1.6 octaves
- **Rows +5**: guitar/Push-style fourths - each row starts +5 semitones up, so scales and chord shapes finger identically across rows like strings on a guitar

Both layouts:

- **Up (+) / Down (-)** shift the entire grid by octaves; the range is clamped so no pad can exceed MIDI 0-127
- LEDs show the keyboard: **C** is lit white as the octave marker, naturals are dim, sharps/flats are dark; toggled-on pads light fully
- Pressing a pad lights **every pad that plays the same note** - on overlapping layouts (+4/+5) duplicates across rows flash together, making the intervals between positions visible
- Velocity, Pad Level, toggle pad-offs and per-pad MIDI channel/output still apply; CC-mode pads pass through unchanged
- Pads held across an octave shift still send the correct note-off

**Pad Layout is mutually exclusive with Knob Pages and Pad Pages** - enabling any one turns the others off. While active, Up/Down are consumed for octave shift and can't be mapped as buttons.

### MIDI In (External Sync)

Enable **MIDI In** in a bank's settings so incoming external CC messages update the module's internal state:

- **Knobs**: matching CC + channel updates the stored value and LED ring - touching the knob afterwards picks up from the synced position instead of jumping
- **Toggle buttons and CC-mode pads**: incoming values sync the on/off state and LED
- Matching is done across **all banks** (and all configured knob pages), so state is current whichever bank you switch to
- Matching uses each control's CC and effective MIDI channel (per-control override, falling back to the bank channel), exactly as used for output
- Received values are never re-transmitted - state only - so devices that echo CCs can't create a feedback loop

**Note:** Knob pages 2-8 only respond to MIDI In once they have been configured (to avoid default CCs matching on untouched pages).

### Scenes

Enable **Scenes** in a bank's settings to turn the bank into a set of 4 sub-banks. **Row1-4** buttons select scenes 1-4 - the active scene's button stays lit and the overlay shows `Bank / Scene N`.

Each scene is a complete sub-bank with the **full set of bank options**, configured through Settings exactly like a bank:

- Its own 32 pads, 9 knobs and 13 buttons, each with their own CC/note, name, colour, channel and mode settings
- Its own bank-level settings: name, MIDI channel, output, pad level, pad-offs/pad-mode, button-offs, highlight colour, overlay toggle
- Its own **Knob Pages**, **Pad Pages** and **Pad Layout** - e.g. scene 1 can have knob pages while scene 2 is a chromatic keyboard and scene 3 uses pad pages
- Its own **MIDI In** toggle - incoming CCs sync the state of whichever scenes have it enabled

Scene 1 is the bank's existing configuration. Scenes 2-4 start with default mappings stored under the bank's `scenedata` config. Scenes are nameable via the bank **Name** setting while that scene is active - the scene-select overlay shows `Bank name / Scene name`.

Toggle state and MIDI In sync are tracked per scene, and pads held across a scene switch still send their note-off/CC-off. While Scenes is on, **Row1-4 are no longer MIDI-mappable** (they're the selectors). Knob Pages, Pad Pages and Pad Layout remain mutually exclusive *within* a scene (they all claim the pad grid), but are independent per scene.

**Pads & Buttons:** 0-127 individual colours

**Knobs:** 4 colour schemes (0-3)
- **Scheme 0:** Neutral grays
- **Scheme 1:** Rainbow
- **Scheme 2:** Synthwave (purple/pink/blue)
- **Scheme 3:** Rose (pink gradient)

Knob LEDs change brightness based on value!

---

### Performance Mode

**Hide overlays for distraction-free playing:**
1. Go to Bank Settings
2. Set "Show Overlay" to Off
3. Now pads/knobs don't show info when pressed
4. Cleaner visual experience during performance

---

### Backup Your Config

Your configuration is stored in:
```
/data/UserData/schwung/modules/overtake/control/config.json
```

**To backup:**
1. Connect to Move (move.local) from computer using SCP/SFTP client (CyberDuck, WinSCP, Filezilla, etc.)
2. Copy off the config.json file
3. Store it safely

**To restore:**
1. Copy your backup back to the same location
2. Reload the module

---

### Default Settings

**New Pad Defaults:**
- Note: 35 + pad number (C1 to C3)
- Colour: Black (0)
- Level: 100%
- Choke Group: 0 (disabled)

**New Knob Defaults:**
- CC: 70 + knob number (CC71-CC79)
- Range: 0-127
- Multiplier: 1x
- Mode: Absolute
- Colour: Neutral (0)

**New Button Defaults:**
- CC: Original Move function CC
- Colour: Black (0)
- Name: Original Move function name

**New Bank Defaults:**
- MIDI Channel: 1
- Master Pad Level: 100%
- Min Pad Level: 1
- Pad-Offs: On/Off
- Pad Mode: Note
- Button Offs: On Only
- Output: external
- Show Overlay: On
- H/light Colour: White
- Knob Pages: Off
- Pad Pages: Off
- Pad Layout: Off
- MIDI In: Off
- Scenes: Off

---

### Bank vs Individual Settings

Most bank settings can also be overridden per pad, knob, or button:
- **MIDI Channel** — set per pad/knob/button (`0` = use bank channel)
- **Pad Offs / Pad Mode** — set per pad (`Bank` = use bank setting)
- **Button Offs** — set per button (`Bank` = use bank setting)
- **Output** — set per pad (`Bank` = use bank output)

> **Important:** When you change a bank-level setting for MIDI Channel, Pad Offs, Pad Mode, Button Offs, or Output, any matching individual overrides for that bank are cleared and will follow the bank setting again.
