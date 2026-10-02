/*
 * Custom Midi Controller
 *
*/

import { setButtonLED, setLED, clearAllLEDs } from '/data/UserData/schwung/shared/input_filter.mjs';
import { MoveBack, MoveMenu, MovePlay, MoveRec, MoveCapture, MoveRecord, MoveLoop, MoveMute, MoveDelete,
         MoveCopy, MoveUndo, MoveShift,MoveUp, MoveDown, MoveLeft, MoveRight, MoveMainKnob, MoveMainButton,
         MoveRow1, MoveRow2, MoveRow3, MoveRow4, MoveKnob1, MoveKnob2, MoveKnob3, MoveKnob4,
         MoveKnob5, MoveKnob6, MoveKnob7, MoveKnob8, MoveMaster, MoveCCButtons,
         White, Black, Red, Green, Blue, LightGrey, DarkGrey, WhiteLedDim, WhiteLedBright,
         colourNames, MovePads, midiNotes} from '/data/UserData/schwung/shared/constants.mjs';
import { drawMenuHeader, drawMenuList, drawMenuFooter, showOverlay, tickOverlay, drawOverlay,
         dismissOverlayOnInput, menuLayoutDefaults } from '/data/UserData/schwung/shared/menu_layout.mjs';
import { createValue, createEnum, createToggle, formatItemValue } from '/data/UserData/schwung/shared/menu_items.mjs';
import { createMenuState, handleMenuInput } from '/data/UserData/schwung/shared/menu_nav.mjs';
import { createMenuStack } from '/data/UserData/schwung/shared/menu_stack.mjs';
import { openTextEntry, isTextEntryActive, handleTextEntryMidi, drawTextEntry,
         tickTextEntry } from '/data/UserData/schwung/shared/text_entry.mjs';

/* ============================================================================
 * Constants
 * ============================================================================ */

const SCREEN_WIDTH = 128;
const SCREEN_HEIGHT = 64;

const NUM_PADS = 32;
const NUM_KNOBS = 9;
const NUM_BANKS = 16;
const NUM_KNOB_PAGES = 8;
const KNOB_PAGE_PAD_START = NUM_PADS - NUM_KNOB_PAGES;  /* top row: pads 25-32 */
const NUM_PAD_PAGES = 2;
const NUM_SCENES = 4;
const SCENE_BUTTONS = [MoveRow1, MoveRow2, MoveRow3, MoveRow4];
const KB_SHARPS = new Set([1, 3, 6, 8, 10]);  /* black-key pitch classes */

/* MIDI CCs */
const CC_JOG = MoveMainKnob;
const CC_JOG_CLICK = MoveMainButton;
const CC_BACK = MoveBack;
const CC_MENU = MoveMenu;
const CC_PLAY = MovePlay;
const CC_REC = MoveRec;
const CC_CAPTURE = MoveCapture;
const CC_RECORD = MoveRecord;
const CC_SHIFT = MoveShift;
const CC_UP = MoveUp;
const CC_DOWN = MoveDown;
const CC_LEFT = MoveLeft;
const CC_RIGHT = MoveRight;
const CC_MUTE = MoveMute;
const CC_COPY = MoveCopy;

const ALL_KNOBS = [MoveKnob1, MoveKnob2, MoveKnob3, MoveKnob4, MoveKnob5, MoveKnob6, MoveKnob7, MoveKnob8, MoveMaster];
const ALL_BUTTONS = [MovePlay, MoveRec, MoveCapture, MoveRecord, MoveLoop, MoveMute, MoveDelete, MoveCopy,
                     MoveUndo, MoveUp, MoveLeft, MoveRight, MoveDown, MoveRow1, MoveRow2, MoveRow3, MoveRow4];
const WHITE_BUTTONS = [MoveCapture, MoveLoop, MoveMute, MoveDelete, MoveCopy, MoveUndo, MoveUp, MoveLeft, MoveRight, MoveDown];
const BUTTON_NAMES = ["Play", "Rec", "Capture", "Record", "Loop", "Mute", "Delete", "Copy", "Undo", "Up", "Left", "Right", "Down", "Row1", "Row2", "Row3", "Row4"];

function isWhiteButtonByIndex(index) {
    return WHITE_BUTTONS.includes(ALL_BUTTONS[index]);
}

function getButtonRestingColour(button, index) {
    if (isWhiteButtonByIndex(index)) {
        return button.ledOn ? White : Black;
    }
    return button.colour ?? Black;
}

/* Default values */
const DEFAULTS = {
    PAD: {
        NOTE_OFFSET: 36,
        CC_OFFSET: 1,
        LEVEL: 100,
        COLOUR: Black,
        CHOKEGRP: 0,
        NAME: "(empty)"
    },
    KNOB: {
        VALUE: 0,
        CC_OFFSET: 71,
        MIN: 0,
        MAX: 127,
        RELATIVE: 0,
        MULTIPLIER: 1,
        COLOUR: Black,
        NAME: "(empty)"
    },
    BUTTON: {
        COLOUR: Black
    },
    BANK: {
        CHANNEL: 1,
        LEVEL: 100,
        MIN: 0,
        OUTPUT: 'external',
        PAD_OFFS: 'pad-on-off',
        PAD_MODE: 'note',
        BUTTON_OFFS: 'button-on-only',
        OVERLAY: 1,
        NAME: "(empty)",
        HIGHLIGHTCOLOUR: 122,
        KNOBPAGES: 0,
        KNOBPAGE: 0,
        PADPAGES: 'off',
        PADPAGE: 0,
        PADLAYOUT: 'off',
        KBROOT: 36,
        KBOCT: 0,
        MIDIIN: 0,
        SCENES: 0,
        SCENE: 0
    }
};

/* Highlight colour dimming maps (pad colour 1-26 -> dim / full-dim partner) */
const SLIGHT_DIM_MAP = {
     1: 65,  2: 67,  3: 69,  4: 71,  5: 73,  6: 75,
     7: 77,  8: 79,  9: 81, 10: 83, 11: 85, 12: 87,
    13: 89, 14: 91, 15: 91, 16: 95, 17: 97, 18: 101,
    19: 99, 20: 103, 21: 105, 22: 107, 23: 109, 24: 111,
    25: 113, 26: 115
};

const FULL_DIM_MAP = {
     1: 66,  2: 68,  3: 70,  4: 72,  5: 74,  6: 76,
     7: 78,  8: 80,  9: 82, 10: 84, 11: 86, 12: 88,
    13: 90, 14: 92, 15: 92, 16: 96, 17: 98, 18: 102,
    19: 100, 20: 104, 21: 106, 22: 108, 23: 110, 24: 112,
    25: 114, 26: 116
};

const HL_COLOUR_LABELS = {
    [-1]: 'Slight Dim',
    [-2]: 'Full Dim',
    117: 'Black',
    122: 'White',
    123: 'Light Grey',
    124: 'Dark Grey',
    125: 'Blue',
    126: 'Green',
    127: 'Red',
    0: 'None'
};

function resolveHighlightColour(hlcolour, padColour) {
    if (hlcolour === -1) return SLIGHT_DIM_MAP[padColour] ?? 117;
    if (hlcolour === -2) return FULL_DIM_MAP[padColour] ?? 117;
    return hlcolour;
}

/* ============================================================================
 * State
 * ============================================================================ */

/* View modes */
const VIEW_MAIN = "main";
const VIEW_SETTINGS = "settings";
let viewMode = VIEW_MAIN;

/* Settings menu state (using shared menu components) */
let settingsMenuState = null;
let settingsMenuStack = null;

/* Main */
const CONFIG_LOCATION = "/data/UserData/schwung/modules/overtake/control/config.json";
let config = {};
let banks = new Array(NUM_BANKS);
let selected = 3;  /* 0 = pad, 1 = knob, 2 = button, 3 = bank */
let selectedPad = -1;
let selectedKnob = -1;
let selectedButton = -1;
let selectedBank = 0;
let chokes = [];
let toggledNotes = new Set();
let toggledButtons = new Set();
let cable = 2;
const LED_MSGS_PER_TICK = 8;
const ledQueue = [];

/* Debug: log every external MIDI message to the console while the MIDI In
 * feature is being verified on device. Set false once confirmed working. */
const DEBUG_MIDI_IN = false;
let midiInReceived = 0;
let midiInMatched = 0;

/* UI state */
let shiftHeld = false;
let needsRedraw = true;
let tickCount = 0;
const REDRAW_INTERVAL = 6;
const OVERLAY_DURATION = 750;

/* Colour sweeps */
const cachedKnobColour = {};
const neutralColourSweep = [0, 117, 124, 119, 123, 118, 121, 122, 120];
const rainbowColourSweep = [33, 16, 15, 14, 11, 8, 3, 2];
const synthwaveColourSweep = [104, 105, 20, 21, 23, 26, 25];
const roseColourSweep = [124, 35, 23, 26, 25];
const colourSweeps = [neutralColourSweep, rainbowColourSweep, synthwaveColourSweep, roseColourSweep];
const colourSweepNames = ['neutral', 'rainbow', 'synthwave', 'roseColour'];

/* ============================================================================
 * Helpers
 * ============================================================================ */

/* Create on-demand bank with defaults */
function getBank(index) {
    if (!config[index]) config[index] = {};

    const bank = {
        /* All per-bank settings resolve through the active scene's config -
         * a scene is effectively a sub-bank with the full option set */
        get channel() { return bankCfg(index).channel ?? DEFAULTS.BANK.CHANNEL; },
        set channel(v) { bankCfg(index).channel = v; },
        get name() { return bankCfg(index).name ?? DEFAULTS.BANK.NAME; },
        set name(v) { bankCfg(index).name = v; },
        get level() { return bankCfg(index).level ?? DEFAULTS.BANK.LEVEL; },
        set level(v) { bankCfg(index).level = v; },
        get min() { return bankCfg(index).min ?? DEFAULTS.BANK.MIN; },
        set min(v) { bankCfg(index).min = v; },
        get output() { return bankCfg(index).output ?? DEFAULTS.BANK.OUTPUT; },
        set output(v) { bankCfg(index).output = v; },
        get padoffs() { return bankCfg(index).padoffs ?? DEFAULTS.BANK.PAD_OFFS; },
        set padoffs(v) { bankCfg(index).padoffs = v; },
        get padmode() { return bankCfg(index).padmode ?? DEFAULTS.BANK.PAD_MODE; },
        set padmode(v) { bankCfg(index).padmode = v; },
        get buttonoffs() { return bankCfg(index).buttonoffs ?? DEFAULTS.BANK.BUTTON_OFFS; },
        set buttonoffs(v) { bankCfg(index).buttonoffs = v; },
        get overlay() { return bankCfg(index).overlay ?? DEFAULTS.BANK.OVERLAY; },
        set overlay(v) { bankCfg(index).overlay = v; },
        get hlcolour() { return bankCfg(index).hlcolour ?? DEFAULTS.BANK.HIGHLIGHTCOLOUR; },
        set hlcolour(v) { bankCfg(index).hlcolour = v; },
        get bankled() { return bankCfg(index).bankled ?? White; },
        set bankled(v) { bankCfg(index).bankled = v; },
        get knobpages() { return bankCfg(index).knobpages ?? DEFAULTS.BANK.KNOBPAGES; },
        set knobpages(v) { bankCfg(index).knobpages = v; },
        get knobpage() { return bankCfg(index).knobpage ?? DEFAULTS.BANK.KNOBPAGE; },
        set knobpage(v) { bankCfg(index).knobpage = v; },
        get midiin() { return bankCfg(index).midiin ?? DEFAULTS.BANK.MIDIIN; },
        set midiin(v) { bankCfg(index).midiin = v; },
        get padpages() { return bankCfg(index).padpages ?? DEFAULTS.BANK.PADPAGES; },
        set padpages(v) { bankCfg(index).padpages = v; },
        get padpage() { return bankCfg(index).padpage ?? DEFAULTS.BANK.PADPAGE; },
        set padpage(v) { bankCfg(index).padpage = v; },
        get padlayout() { return bankCfg(index).padlayout ?? DEFAULTS.BANK.PADLAYOUT; },
        set padlayout(v) { bankCfg(index).padlayout = v; },
        get kbroot() { return bankCfg(index).kbroot ?? DEFAULTS.BANK.KBROOT; },
        set kbroot(v) { bankCfg(index).kbroot = v; },
        get kboct() { return bankCfg(index).kboct ?? DEFAULTS.BANK.KBOCT; },
        set kboct(v) { bankCfg(index).kboct = v; },
        /* scenes/scene are outer-bank settings - scenes can't nest */
        get scenes() { return config[index].scenes ?? DEFAULTS.BANK.SCENES; },
        set scenes(v) { config[index].scenes = v; },
        get scene() { return config[index].scene ?? DEFAULTS.BANK.SCENE; },
        set scene(v) { config[index].scene = v; },
        get pads() { return getPads(index, activePadPage(index), activeScene(index)); },
        get knobs() { return getKnobs(index, activeKnobPage(index), activeScene(index)); },
        get buttons() { return getButtons(index, activeScene(index)); }
    };

    return bank;
}

/* Per-scene store: config[bank].scenedata[scene] is a complete sub-bank
 * config object - same keys as a bank (pads, knobs, buttons, channel,
 * padpages, knobpages, padlayout, etc.) */
function getSceneData(bankIndex, sceneIndex) {
    if (!config[bankIndex].scenedata) config[bankIndex].scenedata = {};
    if (!config[bankIndex].scenedata[sceneIndex]) config[bankIndex].scenedata[sceneIndex] = {};
    return config[bankIndex].scenedata[sceneIndex];
}

/* The effective config for a bank+scene: scene 0 is the bank's own config
 * object, scenes 1-3 resolve into scenedata */
function bankCfg(bankIndex, sceneIndex = activeScene(bankIndex)) {
    if (sceneIndex > 0) return getSceneData(bankIndex, sceneIndex);
    return config[bankIndex] ?? {};
}

function getPads(bankIndex, pageIndex = 0, sceneIndex = 0) {
    const isPaged = pageIndex > 0;

    /* Resolve the scene's config object first - page 1 (index 0) reuses the
     * scene's own pads; page 2 stores under the scene's pagepads[1] with
     * defaults offset by one grid (CC 33-64, notes 68-99) for Push-style
     * 8-per-column layouts. */
    const cfg = sceneIndex > 0 ? getSceneData(bankIndex, sceneIndex)
                               : config[bankIndex];
    let store;
    if (isPaged) {
        if (!cfg.pagepads) cfg.pagepads = {};
        if (!cfg.pagepads[pageIndex]) cfg.pagepads[pageIndex] = {};
        store = cfg.pagepads[pageIndex];
    } else {
        if (!cfg.pads) cfg.pads = {};
        store = cfg.pads;
    }

    /* Helper to ensure pad exists */
    const ensurePad = (i) => {
        if (!store[i]) store[i] = {};
        return store[i];
    };

    return new Array(NUM_PADS).fill(0).map((_, i) => ({
        get note() { return store[i]?.note ?? (i + DEFAULTS.PAD.NOTE_OFFSET + pageIndex * NUM_PADS); },
        set note(v) { ensurePad(i).note = v; },
        get cc() { return store[i]?.cc ?? (i + DEFAULTS.PAD.CC_OFFSET + pageIndex * NUM_PADS); },
        set cc(v) { ensurePad(i).cc = v; },
        get name() { return store[i]?.name ?? DEFAULTS.PAD.NAME; },
        set name(v) { ensurePad(i).name = v; },
        get colour() { return store[i]?.colour ?? DEFAULTS.PAD.COLOUR; },
        set colour(v) { ensurePad(i).colour = v; },
        get level() { return store[i]?.level ?? DEFAULTS.PAD.LEVEL; },
        set level(v) { ensurePad(i).level = v; },
        get chokegrp() { return store[i]?.chokegrp ?? DEFAULTS.PAD.CHOKEGRP; },
        set chokegrp(v) { ensurePad(i).chokegrp = v; },
        get padoffs() { return store[i]?.padoffs ?? null; },
        set padoffs(v) { ensurePad(i).padoffs = v; },
        get padmode() { return store[i]?.padmode ?? null; },
        set padmode(v) { ensurePad(i).padmode = v; },
        get channel() { return store[i]?.channel ?? null; },
        set channel(v) { ensurePad(i).channel = v; },
        get output() { return store[i]?.output ?? null; },
        set output(v) { ensurePad(i).output = v; },
        get value() { return store[i]?.value ?? 0; },
        set value(v) { ensurePad(i).value = v; }
    }));
}

/* Pad paging is active when a pad-pages mode is set on the bank's active
 * scene and knob pages (which owns the top pad row) is off */
function padPagesActive(bankIndex, sceneIndex = activeScene(bankIndex)) {
    const c = bankCfg(bankIndex, sceneIndex);
    return !!(c.padpages && c.padpages !== 'off' && !c.knobpages);
}

/* Active pad page for a bank+scene (0-1); always 0 when pad paging is off */
function activePadPage(bankIndex, sceneIndex = activeScene(bankIndex)) {
    if (!padPagesActive(bankIndex, sceneIndex)) return 0;
    return clamp(bankCfg(bankIndex, sceneIndex).padpage ?? 0, 0, NUM_PAD_PAGES - 1);
}

/* Scenes: Row1-4 select one of 4 sub-banks per bank. Each scene is a full
 * config layer, so scenes coexist with knob pages / pad pages / layouts -
 * those settings are per-scene. */
function scenesActive(bankIndex) {
    return !!((config[bankIndex] ?? {}).scenes);
}

/* Active scene for a bank (0-3); always 0 when scenes are disabled */
function activeScene(bankIndex) {
    if (!scenesActive(bankIndex)) return 0;
    return clamp((config[bankIndex] ?? {}).scene ?? 0, 0, NUM_SCENES - 1);
}

/* Toggle state is tracked per bank+scene+page+pad */
function padToggleKey(bankIndex, padIdx, pageIndex = activePadPage(bankIndex),
                      sceneIndex = activeScene(bankIndex)) {
    return `${bankIndex}:${sceneIndex}:${pageIndex}:${padIdx}`;
}

function buttonToggleKey(bankIndex, buttonIdx, sceneIndex = activeScene(bankIndex)) {
    return `${bankIndex}:${sceneIndex}:b${buttonIdx}`;
}

/* Keyboard layout: active when a layout is set and neither pad paging nor
 * knob paging owns the grid - all three are mutually exclusive */
function kbLayoutActive(bankIndex) {
    const c = bankCfg(bankIndex);
    return !!(c.padlayout && c.padlayout !== 'off' && !c.knobpages &&
              (!c.padpages || c.padpages === 'off'));
}

/* Keyboard layouts: semitone interval between rows of 8 pads.
 * New layouts are added here - chromatic is simply rows of +8. */
const KB_ROW_STEPS = {
    chromatic: 8,
    rows4: 4,   /* major-thirds tuning - shapes repeat every 3 rows */
    rows5: 5    /* fourths tuning - guitar/Push-style */
};

function keyboardNote(bankIndex, padIdx) {
    const c = bankCfg(bankIndex);
    const root = c.kbroot ?? DEFAULTS.BANK.KBROOT;
    const oct = c.kboct ?? 0;
    const rowStep = KB_ROW_STEPS[c.padlayout] ?? 8;
    const step = Math.floor(padIdx / 8) * rowStep + (padIdx % 8);
    return clamp(root + oct * 12 + step, 0, 127);
}

/* Highest semitone offset used by the layout (for octave range clamping) */
function keyboardSpan(bankIndex) {
    const rowStep = KB_ROW_STEPS[bankCfg(bankIndex).padlayout] ?? 8;
    return 3 * rowStep + 7;
}

/* Send pending note/CC offs for pads still held across a page flip or bank
 * switch, and swallow their releases so a held pad can't send a stale off
 * against the new page/bank's mapping. */
const heldPadOffs = new Map();      /* padIdx -> off message or null */
const swallowedPadReleases = new Set();

function flushHeldPads() {
    for (const [padIdx, off] of heldPadOffs) {
        if (off) sendMidi(off.output, off.status, off.channel, off.d1, 0);
        heldPadOffs.delete(padIdx);
        swallowedPadReleases.add(padIdx);
    }
}

/* Active knob page for a bank (0-7); always 0 when knob pages are disabled */
function activeKnobPage(bankIndex, sceneIndex = activeScene(bankIndex)) {
    const c = bankCfg(bankIndex, sceneIndex);
    if (!c.knobpages) return 0;
    return clamp(c.knobpage ?? 0, 0, NUM_KNOB_PAGES - 1);
}

function getKnobs(bankIndex, pageIndex = 0, sceneIndex = 0) {
    const isPaged = pageIndex > 0;

    /* Resolve the scene's config object first - page 1 reuses the scene's
     * own knobs so existing configs stay valid; pages 2-8 store under the
     * scene's pageknobs[page]. */
    const cfg = sceneIndex > 0 ? getSceneData(bankIndex, sceneIndex)
                               : config[bankIndex];
    let store;
    if (isPaged) {
        if (!cfg.pageknobs) cfg.pageknobs = {};
        if (!cfg.pageknobs[pageIndex]) cfg.pageknobs[pageIndex] = {};
        store = cfg.pageknobs[pageIndex];
    } else {
        if (!cfg.knobs) cfg.knobs = {};
        store = cfg.knobs;
    }

    /* Helper to ensure knob exists */
    const ensureKnob = (i) => {
        if (!store[i]) store[i] = {};
        return store[i];
    };

    /* Paged banks expose 8 knobs per page; the master knob is not paged */
    const count = isPaged ? NUM_KNOBS - 1 : NUM_KNOBS;
    const knobs = new Array(count).fill(0).map((_, i) => ({
        get value() { return store[i]?.value ?? DEFAULTS.KNOB.VALUE; },
        set value(v) { ensureKnob(i).value = v; },
        get cc() { return store[i]?.cc ?? (i + DEFAULTS.KNOB.CC_OFFSET); },
        set cc(v) { ensureKnob(i).cc = v; },
        get name() { return store[i]?.name ?? DEFAULTS.KNOB.NAME; },
        set name(v) { ensureKnob(i).name = v; },
        get colour() { return store[i]?.colour ?? DEFAULTS.KNOB.COLOUR; },
        set colour(v) { ensureKnob(i).colour = v; },
        get min() { return store[i]?.min ?? DEFAULTS.KNOB.MIN; },
        set min(v) { ensureKnob(i).min = v; },
        get max() { return store[i]?.max ?? DEFAULTS.KNOB.MAX; },
        set max(v) { ensureKnob(i).max = v; },
        get relative() { return store[i]?.relative ?? DEFAULTS.KNOB.RELATIVE; },
        set relative(v) { ensureKnob(i).relative = v; },
        get multiplier() { return store[i]?.multiplier ?? DEFAULTS.KNOB.MULTIPLIER; },
        set multiplier(v) { ensureKnob(i).multiplier = v; },
        get channel() { return store[i]?.channel ?? null; },
        set channel(v) { ensureKnob(i).channel = v; }
    }));
    if (isPaged) knobs.push(getKnobs(bankIndex, 0, sceneIndex)[NUM_KNOBS - 1]);
    return knobs;
}

function getButtons(bankIndex, sceneIndex = 0) {
    /* Scene 1 (index 0) reuses the existing per-bank button config;
     * scenes 2-4 store under scenedata[scene].buttons */
    const cfg = sceneIndex > 0 ? getSceneData(bankIndex, sceneIndex)
                               : config[bankIndex];
    if (!cfg.buttons) cfg.buttons = {};
    const store = cfg.buttons;

    /* Helper to ensure button exists */
    const ensureButton = (i) => {
        if (!store[i]) store[i] = {};
        return store[i];
    };

    return new Array(ALL_BUTTONS.length).fill(0).map((_, i) => ({
        get cc() { return store[i]?.cc ?? ALL_BUTTONS[i]; },
        set cc(v) { ensureButton(i).cc = v; },
        get name() { return store[i]?.name ?? BUTTON_NAMES[i]; },
        set name(v) { ensureButton(i).name = v; },
        get colour() { return store[i]?.colour ?? DEFAULTS.BUTTON.COLOUR; },
        set colour(v) { ensureButton(i).colour = v; },
        get channel() { return store[i]?.channel ?? null; },
        set channel(v) { ensureButton(i).channel = v; },
        get buttonoffs() { return store[i]?.buttonoffs ?? null; },
        set buttonoffs(v) { ensureButton(i).buttonoffs = v; },
        get ledOn() { return store[i]?.ledOn ?? 0; },
        set ledOn(v) { ensureButton(i).ledOn = v ? 127 : 0; },
        get value() { return store[i]?.value ?? 0; },
        set value(v) { ensureButton(i).value = v; }
    }));
}

function defaultConfig() {
    /* No longer creates full config - just ensures banks array is populated with getters */
    for (let i = 0; i < NUM_BANKS; i++) {
        banks[i] = getBank(i);
    }
}

function restoreToggleStateForBank(bankIndex) {
    const bank = banks[bankIndex];
    if (!bank) return;
    const scenes = scenesActive(bankIndex) ? NUM_SCENES : 1;
    for (let s = 0; s < scenes; s++) {
        if (s > 0 && !config[bankIndex]?.scenedata?.[s]) continue;
        const sceneCfg = s > 0 ? config[bankIndex].scenedata[s] : config[bankIndex];
        const bankPadOffMode = sceneCfg.padoffs ?? DEFAULTS.BANK.PAD_OFFS;
        const bankButtonOffs = sceneCfg.buttonoffs ?? DEFAULTS.BANK.BUTTON_OFFS;
        const padPages = padPagesActive(bankIndex, s) ? NUM_PAD_PAGES : 1;
        for (let p = 0; p < padPages; p++) {
            const pads = getPads(bankIndex, p, s);
            for (let i = 0; i < NUM_PADS; i++) {
                const pad = pads[i];
                const padOffMode = pad.padoffs ?? bankPadOffMode;
                const key = padToggleKey(bankIndex, i, p, s);
                if (padOffMode === 'toggle' && pad.value === 127) {
                    toggledNotes.add(key);
                } else {
                    toggledNotes.delete(key);
                }
            }
        }
        const buttons = getButtons(bankIndex, s);
        for (let i = 0; i < ALL_BUTTONS.length; i++) {
            const button = buttons[i];
            const buttonOffs = button.buttonoffs ?? bankButtonOffs;
            const key = buttonToggleKey(bankIndex, i, s);
            if (buttonOffs === 'toggle' && button.value === 127) {
                toggledButtons.add(key);
            } else {
                toggledButtons.delete(key);
            }
        }
    }
}

function restoreToggleState() {
    toggledNotes.clear();
    toggledButtons.clear();
    for (let i = 0; i < NUM_BANKS; i++) {
        restoreToggleStateForBank(i);
    }
}

function loadConfig() {
    if (host_file_exists(CONFIG_LOCATION)) {
        config = JSON.parse(host_read_file(CONFIG_LOCATION));
        console.log("Loaded config");
    } else {
        config = {};
        console.log("Starting with empty config");
    }
    defaultConfig();
    restoreToggleState();
    return banks;
}

function saveConfig() {
    console.log("Save Config File");
    host_write_file(CONFIG_LOCATION, JSON.stringify(config));
}

/* Query knob mapping info and show overlay */
function showKnobOverlay(knobNum, val = "") {
    const name = banks[selectedBank].knobs[knobNum].name;
    const cc = banks[selectedBank].knobs[knobNum].cc;

    let value = val;
    if (banks[selectedBank].knobs[knobNum].relative) {
        if (val === 127) value = "---";
        if (val === 1) value = "+++";
    } else {
        value = Math.round(banks[selectedBank].knobs[knobNum].value);
    }

    const displayName = (name !== DEFAULTS.KNOB.NAME) ? name : `Knob${knobNum + 1}`;
    showOverlay(`${displayName} CC: ${cc}`, value, OVERLAY_DURATION);
    return true;
}

/* Query button mapping info and show overlay */
function showButtonOverlay(buttonNum, val = "") {
    const button = banks[selectedBank].buttons[buttonNum];
    const name = button.name;
    const cc = button.cc;
    const buttonOffs = getButtonOffs(button);
    let value = val;
    if (buttonOffs === 'toggle') {
        value = val === 127 ? "On" : "Off";
    } else if (buttonOffs === 'button-on-off') {
        value = val === 0 ? "Off" : "On";
    } else {
        value = "On";
    }
    const displayName = (name !== BUTTON_NAMES[buttonNum]) ? name : BUTTON_NAMES[buttonNum];
    showOverlay(`${displayName} CC: ${cc}`, value, OVERLAY_DURATION);
    return true;
}

/* Query pad mapping info and show overlay */
function showPadOverlay(padNum, vel) {
    let name = banks[selectedBank].pads[padNum].name;
    const padMode = getPadMode(banks[selectedBank].pads[padNum]);
    let valueInfo;
    if (padMode === 'cc') {
        const cc = banks[selectedBank].pads[padNum].cc;
        valueInfo = `CC: ${cc}`;
    } else {
        const note = kbLayoutActive(selectedBank) ? keyboardNote(selectedBank, padNum)
                                                  : banks[selectedBank].pads[padNum].note;
        valueInfo = `Note: ${note}`;
    }
    const displayName = (name !== DEFAULTS.PAD.NAME) ? name : valueInfo;
    const valueText = padMode === 'cc' ? (vel === 127 ? 'On' : 'Off') : vel;
    showOverlay(`Pad${padNum + 1} ${displayName}`, valueText, OVERLAY_DURATION);
    return true;
}

/* Query step mapping info and show overlay */
function showStepOverlay(stepNum) {
    /* Steps select outer banks - show the bank's own name, not the
     * name of whichever scene happens to be active inside it */
    let name = config[stepNum]?.name ?? DEFAULTS.BANK.NAME;
    const displayName = (name !== DEFAULTS.BANK.NAME) ? name : `Bank ${stepNum + 1}`;
    showOverlay("Bank:", displayName, OVERLAY_DURATION);
    return true;
}

export function clamp(value, min, max) {
    if (value > max) return max;
    if (value < min) return min;
    return value;
}

function getColourForKnobValue(colour = 0, value = 0, min = 0, max = 127) {
    let colourSweep = colourSweeps[colour] ?? neutralColourSweep;
    const range = max - min;
    const level = range > 0 ? clamp((value - min) / range, 0, 1) : 0;
    const index = Math.round(level * (colourSweep.length - 1));
    return colourSweep[index];
}

/* Route a MIDI message to the configured output (schwung / move / internal / external) */
function sendMidi(output, statusByte, channel, data1, data2) {
    if (output === 'schwung') {
        shadow_send_midi_to_dsp([statusByte | channel, data1, data2]);
    } else if (output === 'move') {
        move_midi_inject_to_move([cable << 4 | (statusByte >> 4), statusByte | channel, data1, data2]);
    } else {
        move_midi_external_send([cable << 4 | (statusByte >> 4), statusByte | channel, data1, data2]);
    }
}

/* ============================================================================
 * LED Control
 * ============================================================================ */

/* Stop the pulsing LED on the current selection */
function stopPulse() {
    if (selected === 0 && selectedPad >= 0) {
        move_midi_internal_send([0 << 4 | (0x90 >> 4), 0x90, selectedPad + 68, banks[selectedBank].pads[selectedPad].colour]);
    } else if (selected === 1 && selectedKnob >= 0) {
        const knob = banks[selectedBank].knobs[selectedKnob];
        move_midi_internal_send([0 << 4 | (0xB0 >> 4), 0xB0, selectedKnob + 71, getColourForKnobValue(knob.colour, knob.value, knob.min, knob.max)]);
    } else if (selected === 2 && selectedButton >= 0) {
        move_midi_internal_send([0 << 4 | (0xB0 >> 4), 0xB0, ALL_BUTTONS[selectedButton], getButtonRestingColour(banks[selectedBank].buttons[selectedButton], selectedButton)]);
    } else if (selected === 3) {
        move_midi_internal_send([0 << 4 | (0x90 >> 4), 0x90, selectedBank + 16, banks[selectedBank].bankled ?? White]);
    }
}

function transferPulse(newType, newIndex) {
    stopPulse();

    let pulseColour = White;
    if (newType === 2 && newIndex >= 0) {
        const button = banks[selectedBank].buttons[newIndex];
        if (isWhiteButtonByIndex(newIndex)) {
            if (button.ledOn) pulseColour = Black;
        } else if (button.colour !== Black) {
            pulseColour = Black;
        }
    }

    if (newType === 0 && newIndex >= 0) {
        move_midi_internal_send([0 << 4 | ((0x90 + 0x09) >> 4), 0x90 + 0x09, newIndex + 68, White]);
    } else if (newType === 1 && newIndex >= 0) {
        move_midi_internal_send([0 << 4 | ((0xB0 + 0x09) >> 4), 0xB0 + 0x09, newIndex + 71, White]);
    } else if (newType === 2 && newIndex >= 0) {
        move_midi_internal_send([0 << 4 | ((0xB0 + 0x09) >> 4), 0xB0 + 0x09, ALL_BUTTONS[newIndex], pulseColour]);
    } else if (newType === 3 && newIndex >= 0) {
        move_midi_internal_send([0 << 4 | ((0x90 + 0x09) >> 4), 0x90 + 0x09, newIndex + 16, Black]);
    }
}

function enqueueNoteLED(note, colour) {
    ledQueue.push({ type: 'note', note, colour });
}

function enqueueCcLED(cc, colour) {
    ledQueue.push({ type: 'button', cc, colour });
}

function flushLEDQueue() {
    const count = Math.min(LED_MSGS_PER_TICK, ledQueue.length);
    for (let i = 0; i < count; i++) {
        const msg = ledQueue.shift();
        if (msg.type === 'note') {
            setLED(msg.note, msg.colour);
        } else {
            setButtonLED(msg.cc, msg.colour);
        }
    }
}

function updateLEDs() {
    /* This is a full refresh; drop any still-pending messages from a
     * previous refresh so LEDs don't lag behind stale colours. */
    ledQueue.length = 0;

    /* Pad LEDs  */
    const pads = banks[selectedBank].pads;
    const bankPadOffMode = banks[selectedBank].padoffs ?? 'pad-on-off';
    const bankHl = banks[selectedBank].hlcolour;
    const knobPagesOn = !!banks[selectedBank].knobpages;
    const knobPage = activeKnobPage(selectedBank);
    const kbOn = kbLayoutActive(selectedBank);
    const bankPadMode = banks[selectedBank].padmode ?? DEFAULTS.BANK.PAD_MODE;
    for (let i = 0; i < NUM_PADS; i++) {
        if (knobPagesOn && i >= KNOB_PAGE_PAD_START) {
            /* Top row becomes lit knob page selectors */
            enqueueNoteLED(i + 68, (i - KNOB_PAGE_PAD_START) === knobPage ? White : DarkGrey);
            continue;
        }
        const pad = pads[i];
        const padOffMode = pad.padoffs ?? bankPadOffMode;
        const toggleKey = padToggleKey(selectedBank, i);
        const toggledOn = padOffMode === 'toggle' && toggledNotes.has(toggleKey);
        let colour;
        if (kbOn && (pad.padmode ?? bankPadMode) === 'note') {
            /* Keyboard colouring: C marks octaves, naturals dim, sharps dark */
            const pc = keyboardNote(selectedBank, i) % 12;
            colour = pc === 0 ? White : KB_SHARPS.has(pc) ? Black : DarkGrey;
            if (toggledOn) colour = White;
        } else {
            colour = pad.colour ?? Black;
            if (padOffMode === 'toggle') {
                colour = toggledOn ? (pad.colour ?? Black)
                                   : resolveHighlightColour(bankHl, pad.colour);
            }
        }
        enqueueNoteLED(i + 68, colour);
    }

    /* Knob LEDs  */
    let knobs = banks[selectedBank].knobs;
    for (let i = 0; i < NUM_KNOBS; i++) {
        let colour = Black;
        if (knobs[i].value) colour = getColourForKnobValue(knobs[i].colour, knobs[i].value, knobs[i].min, knobs[i].max);
        enqueueCcLED(i + 71, colour);
    }

    /* Button LEDs  */
    let buttons = banks[selectedBank].buttons;
    const bankButtonOffs = banks[selectedBank].buttonoffs ?? 'button-on-only';
    for (let i = 0; i < ALL_BUTTONS.length; i++) {
        const button = buttons[i];
        const buttonOffs = button.buttonoffs ?? bankButtonOffs;
        let colour = getButtonRestingColour(button, i);
        if (buttonOffs === 'toggle') {
            const toggleKey = buttonToggleKey(selectedBank, i);
            colour = toggledButtons.has(toggleKey) ? getButtonRestingColour(button, i) : Black;
        }
        enqueueCcLED(ALL_BUTTONS[i], colour);
    }

    /* Pad page indicator: when Up is the page control it shows page state
     * (bright = page 2, dim = page 1) instead of its button colour */
    const padPageMode = banks[selectedBank].padpages;
    if (padPagesActive(selectedBank) && (padPageMode === 'up-toggle' || padPageMode === 'up-hold')) {
        enqueueCcLED(MoveUp, activePadPage(selectedBank) ? WhiteLedBright : WhiteLedDim);
    }

    /* Scene selectors: Row1-4 lit with the active scene highlighted */
    if (scenesActive(selectedBank)) {
        const scene = activeScene(selectedBank);
        for (let s = 0; s < NUM_SCENES; s++) {
            enqueueCcLED(SCENE_BUTTONS[s], s === scene ? White : DarkGrey);
        }
    }

    /* Bank LEDs. In settings view, leave the selected bank pulsing and don't
     * re-queue its static colour (that would override the pulse). */
    const bankLedColour = banks[selectedBank].bankled ?? White;
    for (let i = 0; i < NUM_BANKS; i++) {
        let colour = DarkGrey;
        if (i === selectedBank) colour = bankLedColour;
        enqueueNoteLED(i + 16, colour);
    }

    /* Navigation buttons */
    enqueueCcLED(CC_MENU, WhiteLedBright);
    enqueueCcLED(CC_BACK, WhiteLedBright);
}

/* ============================================================================
 * Drawing
 * ============================================================================ */

function drawMainView() {
    clear_screen();

    /* Header */
    drawMenuHeader("Custom MIDI Control");

    /* Draw overlay if active */
    drawOverlay();
}

/* Resolve per-element channel with bank fallback */
function getChannel(element) {
    return (element.channel ?? banks[selectedBank].channel ?? DEFAULTS.BANK.CHANNEL) - 1;
}

/* Resolve per-pad output with bank fallback */
function getPadOutput(pad) {
    return pad.output ?? banks[selectedBank].output ?? DEFAULTS.BANK.OUTPUT;
}

/* Resolve per-button buttonoffs with bank fallback */
function getButtonOffs(button) {
    return button.buttonoffs ?? banks[selectedBank].buttonoffs ?? DEFAULTS.BANK.BUTTON_OFFS;
}

/* Resolve per-pad padoffs with bank fallback */
function getPadOffs(pad) {
    return pad.padoffs ?? banks[selectedBank].padoffs ?? DEFAULTS.BANK.PAD_OFFS;
}

/* Resolve per-pad padmode with bank fallback */
function getPadMode(pad) {
    return pad.padmode ?? banks[selectedBank].padmode ?? DEFAULTS.BANK.PAD_MODE;
}

/* Build settings menu items using shared menu item creators */
function getSettingsItems() {
    if (selected === 0) {  // pad config
        const pad = banks[selectedBank].pads[selectedPad];
        const padMode = getPadMode(pad);
        const padItems = [
            createValue('MIDI Channel', {
                get: () => pad.channel ?? 0,
                set: (v) => { pad.channel = v === 0 ? undefined : v; },
                min: 0,
                max: 16,
                step: 1,
                format: (v) => v === 0 ? 'Bank' : `${v}`
            }),
            createValue('Name', {
                get: () => pad.name || "(empty)",
                set: (v) => { needsRedraw = true; }
            }),
            createValue('Colour', {
                get: () => pad.colour ?? 0,
                set: (v) => { pad.colour = v; },
                min: 0,
                max: 127,
                step: 1,
                format: (v) => v
            }),
            createValue('Pad Level', {
                get: () => pad.level ?? 100,
                set: (v) => { pad.level = v; },
                min: 1,
                max: 200,
                step: 1,
                format: (v) => `${v}%`
            }),
            createValue('Choke Grp', {
                get: () => pad.chokegrp ?? 0,
                set: (v) => { pad.chokegrp = v; },
                min: 0,
                max: 8,
                step: 1,
                format: (v) => v === 0 ? 'Off' : `${v}`
            }),
            createEnum('Pad Offs', {
                get: () => pad.padoffs ?? 'bank',
                set: (v) => { pad.padoffs = v === 'bank' ? undefined : v; },
                options: ['bank', 'pad-on-off', 'pad-on-only', 'toggle'],
                format: (v) => {
                    if (v === 'bank') return 'Bank';
                    if (v === 'pad-on-off') return 'On/Off';
                    if (v === 'pad-on-only') return 'On Only';
                    if (v === 'toggle') return 'Toggle';
                    return v;
                }
            }),
            createEnum('Pad Mode', {
                get: () => pad.padmode ?? 'bank',
                set: (v) => { pad.padmode = v === 'bank' ? undefined : v; },
                options: ['bank', 'note', 'cc'],
                format: (v) => v === 'bank' ? 'Bank' : (v === 'cc' ? 'CC' : 'Note')
            }),
            createEnum('Output', {
                get: () => pad.output ?? 'bank',
                set: (v) => { pad.output = v === 'bank' ? undefined : v; },
                options: ['bank', 'external', 'move', 'schwung'],
                format: (v) => v === 'bank' ? 'Bank' : v.charAt(0).toUpperCase() + v.slice(1)
            })
        ];
        if (padMode === 'cc') {
            padItems.unshift(createValue('CC', {
                get: () => pad.cc ?? 0,
                set: (v) => { pad.cc = v; },
                min: 0,
                max: 127,
                step: 1
            }));
        } else {
            padItems.unshift(createValue('Note', {
                get: () => pad.note ?? 0,
                set: (v) => { pad.note = v; },
                min: 0,
                max: 127,
                step: 1,
                format: (v) => `${midiNotes[v]} (${v})`
            }));
        }
        return padItems;
    } else if (selected === 1) {  // knob config
        const knobItems = [
            createValue('CC', {
                get: () => banks[selectedBank].knobs[selectedKnob].cc ?? 0,
                set: (v) => { banks[selectedBank].knobs[selectedKnob].cc = v; },
                min: 0,
                max: 127,
                step: 1
            }),
            createValue('MIDI Channel', {
                get: () => banks[selectedBank].knobs[selectedKnob].channel ?? 0,
                set: (v) => { banks[selectedBank].knobs[selectedKnob].channel = v === 0 ? undefined : v; },
                min: 0,
                max: 16,
                step: 1,
                format: (v) => v === 0 ? 'Bank' : `${v}`
            }),
            createValue('Name', {
                get: () => banks[selectedBank].knobs[selectedKnob].name || "(empty)",
                set: (v) => { needsRedraw = true; }
            }),
            createValue('Colour', {
                get: () => banks[selectedBank].knobs[selectedKnob].colour ?? 0,
                set: (v) => { banks[selectedBank].knobs[selectedKnob].colour = v; },
                min: 0,
                max: colourSweeps.length - 1,
                step: 1,
                format: (v) => `${colourSweepNames[v]}`
            }),
            createValue('Min Value', {
                get: () => banks[selectedBank].knobs[selectedKnob].min ?? 0,
                set: (v) => { banks[selectedBank].knobs[selectedKnob].min = v; },
                min: 0,
                max: 127,
                step: 1
            }),
            createValue('Max Value', {
                get: () => banks[selectedBank].knobs[selectedKnob].max ?? 127,
                set: (v) => { banks[selectedBank].knobs[selectedKnob].max = v; },
                min: 0,
                max: 127,
                step: 1
            }),
            createEnum('Multiplier', {
                get: () => banks[selectedBank].knobs[selectedKnob].multiplier ?? 1,
                set: (v) => { banks[selectedBank].knobs[selectedKnob].multiplier = v; },
                options: [0.25, 0.5, 0.75, 1, 2, 3, 4, 6, 8],
                format: (v) => `${v}x`
            }),
            createToggle('CC Relative', {
                get: () => banks[selectedBank].knobs[selectedKnob].relative ?? 0,
                set: (v) => {
                    banks[selectedBank].knobs[selectedKnob].relative = v ? 1 : 0;
                    banks[selectedBank].knobs[selectedKnob].value = v ? -1 : 0;
                }
            })
        ];
        /* Optional name for the knob page (master knob is not paged) */
        if (banks[selectedBank].knobpages && selectedKnob < NUM_KNOBS - 1) {
            const page = activeKnobPage(selectedBank);
            knobItems.push(createValue('Page Name', {
                get: () => bankCfg(selectedBank)?.knobpagenames?.[page] || "(empty)",
                set: (v) => { needsRedraw = true; }
            }));
        }
        return knobItems;
    } else if (selected === 2) {  // button config
        const buttonItems = [
            createValue('CC', {
                get: () => banks[selectedBank].buttons[selectedButton].cc ?? 0,
                set: (v) => { banks[selectedBank].buttons[selectedButton].cc = v; },
                min: 0,
                max: 127,
                step: 1
            }),
            createValue('MIDI Channel', {
                get: () => banks[selectedBank].buttons[selectedButton].channel ?? 0,
                set: (v) => { banks[selectedBank].buttons[selectedButton].channel = v === 0 ? undefined : v; },
                min: 0,
                max: 16,
                step: 1,
                format: (v) => v === 0 ? 'Bank' : `${v}`
            }),
            createValue('Name', {
                get: () => banks[selectedBank].buttons[selectedButton].name || "(empty)",
                set: (v) => { needsRedraw = true; }
            }),
            createEnum('Button Offs', {
                get: () => banks[selectedBank].buttons[selectedButton].buttonoffs ?? 'bank',
                set: (v) => { banks[selectedBank].buttons[selectedButton].buttonoffs = v === 'bank' ? undefined : v; },
                options: ['bank', 'button-on-off', 'button-on-only', 'toggle'],
                format: (v) => {
                    if (v === 'bank') return 'Bank';
                    if (v === 'button-on-off') return 'On/Off';
                    if (v === 'button-on-only') return 'On Only';
                    if (v === 'toggle') return 'Toggle';
                    return v;
                }
            })
        ];
        if (isWhiteButtonByIndex(selectedButton)) {
            buttonItems.push(createToggle('LED On', {
                get: () => banks[selectedBank].buttons[selectedButton].ledOn,
                set: (v) => { banks[selectedBank].buttons[selectedButton].ledOn = v ? 127 : 0; }
            }));
        } else {
            buttonItems.push(createValue('Colour', {
                get: () => banks[selectedBank].buttons[selectedButton].colour ?? 0,
                set: (v) => { banks[selectedBank].buttons[selectedButton].colour = v; },
                min: 0,
                max: 127,
                step: 10,
                format: (v) => v
            }));
        }
        return buttonItems;
    } else {  // bank config
        const bankItems = [
            createValue('MIDI Channel', {
                get: () => banks[selectedBank].channel || 1,
                set: (v) => { banks[selectedBank].channel = v; },
                min: 1,
                max: 16,
                step: 1
            }),
            createValue('Name', {
                get: () => banks[selectedBank].name || "(empty)",
                set: (v) => { needsRedraw = true; }
            }),
            createValue('Bank LED', {
                get: () => banks[selectedBank].bankled ?? White,
                set: (v) => { banks[selectedBank].bankled = v; },
                min: 0,
                max: 127,
                step: 1,
                format: (v) => v
            }),
            createValue('Master Pad Level', {
                get: () => banks[selectedBank].level ?? 100,
                set: (v) => { banks[selectedBank].level = v; },
                min: 25,
                max: 250,
                step: 1,
                format: (v) => `${v}%`
            }),
            createValue('Min Pad Level', {
                get: () => banks[selectedBank].min ?? 1,
                set: (v) => { banks[selectedBank].min = v; },
                min: 0,
                max: 127,
                step: 1
            }),
            createEnum('Pad Offs', {
                get: () => banks[selectedBank].padoffs ?? 'pad-on-off',
                set: (v) => { banks[selectedBank].padoffs = v; },
                options: ['pad-on-off', 'pad-on-only', 'toggle'],
                format: (v) => {
                    if (v === 'pad-on-off') return 'On/Off';
                    if (v === 'pad-on-only') return 'On Only';
                    if (v === 'toggle') return 'Toggle';
                    return v;
                }
            }),
            createEnum('Pad Mode', {
                get: () => banks[selectedBank].padmode ?? 'note',
                set: (v) => { banks[selectedBank].padmode = v; },
                options: ['note', 'cc'],
                format: (v) => v === 'cc' ? 'CC' : 'Note'
            }),
            createToggle('Knob Pages', {
                get: () => banks[selectedBank].knobpages ?? 0,
                set: (v) => {
                    banks[selectedBank].knobpages = v ? 1 : 0;
                    if (v) {  /* mutually exclusive */
                        banks[selectedBank].padpages = 'off';
                        banks[selectedBank].padlayout = 'off';
                    }
                }
            }),
            createEnum('Pad Pages', {
                get: () => banks[selectedBank].padpages ?? 'off',
                set: (v) => {
                    banks[selectedBank].padpages = v;
                    if (v !== 'off') {  /* mutually exclusive */
                        banks[selectedBank].knobpages = 0;
                        banks[selectedBank].padlayout = 'off';
                    }
                },
                options: ['off', 'up-toggle', 'up-hold', 'jog-toggle'],
                format: (v) => ({
                    'off': 'Off',
                    'up-toggle': 'Up Toggle',
                    'up-hold': 'Up Hold',
                    'jog-toggle': 'Jog Toggle'
                })[v] ?? v
            }),
            createEnum('Pad Layout', {
                get: () => banks[selectedBank].padlayout ?? 'off',
                set: (v) => {
                    banks[selectedBank].padlayout = v;
                    if (v !== 'off') {  /* mutually exclusive */
                        banks[selectedBank].knobpages = 0;
                        banks[selectedBank].padpages = 'off';
                    }
                },
                options: ['off', 'chromatic', 'rows4', 'rows5'],
                format: (v) => ({ 'off': 'Off', 'chromatic': 'Chromatic', 'rows4': 'Rows +4', 'rows5': 'Rows +5' })[v] ?? v
            }),
            createToggle('MIDI In', {
                get: () => banks[selectedBank].midiin ?? 0,
                set: (v) => { banks[selectedBank].midiin = v ? 1 : 0; }
            }),
            createToggle('Scenes', {
                /* Scenes is an outer-bank flag; scenes coexist with the
                 * per-scene pages/layout options */
                get: () => banks[selectedBank].scenes ?? 0,
                set: (v) => { banks[selectedBank].scenes = v ? 1 : 0; }
            }),
            createEnum('Button Offs', {
                get: () => banks[selectedBank].buttonoffs ?? 'button-on-only',
                set: (v) => { banks[selectedBank].buttonoffs = v; },
                options: ['button-on-off', 'button-on-only', 'toggle'],
                format: (v) => {
                    if (v === 'button-on-off') return 'On/Off';
                    if (v === 'button-on-only') return 'On Only';
                    if (v === 'toggle') return 'Toggle';
                    return v;
                }
            }),
            createEnum('Output', {
                get: () => banks[selectedBank].output ?? 'external',
                set: (v) => { banks[selectedBank].output = v; },
                options: ['external', 'move', 'schwung'],
                format: (v) => v.charAt(0).toUpperCase() + v.slice(1)
            }),
            createToggle('Show Overlay', {
                get: () => banks[selectedBank].overlay ?? 1,
                set: (v) => { banks[selectedBank].overlay = v ? 1 : 0; }
            }),
            createEnum('H/light Colour', {
                get: () => {
                    const v = banks[selectedBank].hlcolour ?? DEFAULTS.BANK.HIGHLIGHTCOLOUR;
                    return v === 120 ? 122 : v;  // migrate old White default
                },
                set: (v) => { banks[selectedBank].hlcolour = v; },
                options: [-1, -2, 117, 122, 123, 124, 125, 126, 127, 0],
                format: (v) => HL_COLOUR_LABELS[v] ?? 'White'
            })
        ];
        /* Root note only makes sense once a keyboard layout is enabled */
        if (banks[selectedBank].padlayout !== 'off') {
            bankItems.push(createValue('KB Root', {
                get: () => banks[selectedBank].kbroot ?? DEFAULTS.BANK.KBROOT,
                set: (v) => { banks[selectedBank].kbroot = v; },
                min: 0,
                max: 96,
                step: 1,
                format: (v) => `${midiNotes[v]} (${v})`
            }));
        }
        return bankItems;
    }
}

/* Initialize settings menu */
function initSettingsMenu() {
    settingsMenuState = createMenuState();
    settingsMenuStack = createMenuStack();
    settingsMenuStack.push({
        title: 'Settings',
        items: getSettingsItems(),
        selectedIndex: 0
    });
}

function getSelectedLabel() {
    const sceneSuffix = scenesActive(selectedBank) ? ` S${activeScene(selectedBank) + 1}` : '';
    if (selected === 0) {
        if (padPagesActive(selectedBank)) return `Pad ${selectedPad + 1}${sceneSuffix} P${activePadPage(selectedBank) + 1}`;
        return `Pad ${selectedPad + 1}${sceneSuffix}`;
    }
    if (selected === 1) {
        /* Show the knob page when paging is active (master knob is not paged) */
        if (banks[selectedBank].knobpages && selectedKnob < NUM_KNOBS - 1) {
            return `Knob ${selectedKnob + 1}${sceneSuffix} P${activeKnobPage(selectedBank) + 1}`;
        }
        return `Knob ${selectedKnob + 1}${sceneSuffix}`;
    }
    if (selected === 2) return `Button ${selectedButton + 1}${sceneSuffix}`;
    return `Bank ${selectedBank + 1}`;
}

/* Ensure settings menu cursor stays within the current item list */
function clampMenuSelection() {
    if (!settingsMenuState) return;
    const current = settingsMenuStack ? settingsMenuStack.current() : null;
    const items = current ? current.items : getSettingsItems();
    const maxIndex = Math.max(0, items.length - 1);
    if (settingsMenuState.selectedIndex > maxIndex) {
        settingsMenuState.selectedIndex = maxIndex;
        if (settingsMenuStack && settingsMenuStack.current()) {
            settingsMenuStack.current().selectedIndex = maxIndex;
        }
    }
}

function drawSettingsView() {
    clear_screen();

    if (!settingsMenuStack || settingsMenuStack.depth() === 0) {
        initSettingsMenu();
    }

    /* Update items on current stack entry */
    const top = settingsMenuStack.current();
    if (top) {
        top.items = getSettingsItems();
    }

    /* Ensure cursor is valid for the current (possibly shorter) item list */
    clampMenuSelection();

    const footer = settingsMenuState.editing ? 'Jog:Change Clk:Save' : 'Jog:Scroll Clk:Edit';

    const bottomY = footer
        ? menuLayoutDefaults.listBottomWithFooter
        : menuLayoutDefaults.listBottomNoFooter;

    drawMenuHeader(`Settings - ${getSelectedLabel()}`);
    drawMenuList({
        items: top ? top.items : [],
        selectedIndex: settingsMenuState.selectedIndex,
        listArea: { topY: menuLayoutDefaults.listTopY, bottomY },
        valueAlignRight: true,
        valueX: 40,
        labelGap: 4,
        getLabel: (item) => item ? (item.label || '') : '',
        getValue: (item, index) => {
            if (!item) return '';
            const isEditing = settingsMenuState.editing && index === settingsMenuState.selectedIndex;
            return formatItemValue(item, isEditing, settingsMenuState.editValue);
        }
    });
    if (footer) drawMenuFooter(footer);
}

function draw() {
    switch (viewMode) {
        case VIEW_MAIN:
            drawMainView();
            break;
        case VIEW_SETTINGS:
            drawSettingsView();
            break;
    }
}

/* ============================================================================
 * MIDI Handling
 * ============================================================================ */

function handleCC(cc, val) {
    /* Shift state */
    if (cc === CC_SHIFT) {
        shiftHeld = val > 63;
        needsRedraw = true;
        return;
    }

    /* Navigation */
    if (cc === CC_BACK && val > 63) {
        if (viewMode === VIEW_SETTINGS) {
            /* Let shared menu handle back (cancel edit or exit) */
            if (settingsMenuState && settingsMenuState.editing) {
                /* Cancel edit mode */
                settingsMenuState.editing = false;
                settingsMenuState.editValue = null;
                needsRedraw = true;
                return;
            }
            /* Exit settings */
            if (selected === 3) {
                stopPulse();
                viewMode = VIEW_MAIN;
                saveConfig();
                settingsMenuStack = null;  /* Reset for next time */
            } else {
                stopPulse();
                selected = 3;
                selectedKnob = -1;
                selectedPad = -1;
                selectedButton = -1;
                settingsMenuStack.setSelectedIndex(0);
            }
        } else if (viewMode !== VIEW_MAIN) {
            stopPulse();
            viewMode = VIEW_MAIN;
            saveConfig();
            settingsMenuStack = null;  /* Reset for next time */
        } else {
            saveConfig();
            clearAllLEDs();
            if (typeof shadow_set_overtake_suppress_master_volume === 'function') {
                shadow_set_overtake_suppress_master_volume(0);
            }
            host_exit_module();
            return;
        }
        needsRedraw = true;
        return;
    }

    if (cc === CC_MENU && val > 63) {
        /* Toggle between main and settings */
        if (viewMode === VIEW_SETTINGS) {
            stopPulse();
            viewMode = VIEW_MAIN;
            saveConfig();
            settingsMenuStack = null;  /* Reset for next time */
        } else {
            viewMode = VIEW_SETTINGS;
            selected = 3;
            selectedButton = -1;
            selectedKnob = -1;
            selectedPad = -1;
            transferPulse(3, selectedBank);
        }
        needsRedraw = true;
        return;
    }

    /* Keyboard octave shift: +/- (Up/Down) move the whole grid by octaves */
    if (kbLayoutActive(selectedBank) && (cc === MoveUp || cc === MoveDown)) {
        if (val > 63) {
            if (viewMode === VIEW_SETTINGS) settingsMenuState.editing = false;
            const c = bankCfg(selectedBank);
            const root = c.kbroot ?? DEFAULTS.BANK.KBROOT;
            const oct = c.kboct ?? 0;
            /* Clamp so the whole grid stays inside 0-127 for the layout */
            const next = clamp(oct + (cc === MoveUp ? 1 : -1),
                Math.ceil(-root / 12), Math.floor((127 - keyboardSpan(selectedBank) - root) / 12));
            if (next !== oct) {
                flushHeldPads();
                banks[selectedBank].kboct = next;
                updateLEDs();
            }
            if (viewMode === VIEW_MAIN && banks[selectedBank].overlay) {
                showOverlay('Root', midiNotes[keyboardNote(selectedBank, 0)], OVERLAY_DURATION);
            }
            needsRedraw = true;
        }
        return;
    }

    /* Scenes: Row1-4 become scene selectors instead of sending MIDI */
    const sceneIdx = SCENE_BUTTONS.indexOf(cc);
    if (scenesActive(selectedBank) && sceneIdx >= 0) {
        if (viewMode === VIEW_SETTINGS) settingsMenuState.editing = false;
        if (val > 63) {
            flushHeldPads();
            chokes = [];
            const outerName = config[selectedBank]?.name;
            const bankLabel = outerName && outerName !== DEFAULTS.BANK.NAME ? outerName : `Bank ${selectedBank + 1}`;
            banks[selectedBank].scene = sceneIdx;
            updateLEDs();
            if (viewMode === VIEW_MAIN && banks[selectedBank].overlay) {
                /* Scenes are nameable via the bank's own Name setting */
                const sceneName = banks[selectedBank].name;
                const sceneLabel = sceneName !== DEFAULTS.BANK.NAME ? sceneName : `Scene ${sceneIdx + 1}`;
                showOverlay(bankLabel, sceneLabel, OVERLAY_DURATION);
            }
            needsRedraw = true;
        }
        return;
    }

    /* Pad page controls: Up button or jog click, per the bank's Pad Pages mode */
    const padPageMode = banks[selectedBank].padpages;
    if (padPagesActive(selectedBank) && cc === MoveUp &&
        (padPageMode === 'up-toggle' || padPageMode === 'up-hold')) {
        if (padPageMode === 'up-toggle' && val === 0) return;  /* ignore release */
        if (viewMode === VIEW_SETTINGS) settingsMenuState.editing = false;
        flushHeldPads();
        banks[selectedBank].padpage = padPageMode === 'up-hold' ? (val > 63 ? 1 : 0)
                                      : (activePadPage(selectedBank) ? 0 : 1);
        updateLEDs();
        if (viewMode === VIEW_MAIN && banks[selectedBank].overlay && val > 63) {
            showOverlay('Pad Page', `${activePadPage(selectedBank) + 1}`, OVERLAY_DURATION);
        }
        needsRedraw = true;
        return;
    }
    if (cc === CC_JOG_CLICK && padPageMode === 'jog-toggle' && padPagesActive(selectedBank) &&
        viewMode === VIEW_MAIN && val > 63) {
        flushHeldPads();
        banks[selectedBank].padpage = activePadPage(selectedBank) ? 0 : 1;
        updateLEDs();
        if (banks[selectedBank].overlay) {
            showOverlay('Pad Page', `${activePadPage(selectedBank) + 1}`, OVERLAY_DURATION);
        }
        needsRedraw = true;
        return;
    }

    /* Buttons send midi */
    for (let i = 0; i < ALL_BUTTONS.length; i++) {
        if (cc === ALL_BUTTONS[i]) {
            if (viewMode === VIEW_SETTINGS && selectedButton != i) {
                settingsMenuState.editing = false;
                transferPulse(2, i);
            }
            selected = 2;
            selectedButton = i;
            selectedKnob = -1;
            selectedPad = -1;

            const button = banks[selectedBank].buttons[i];
            let channel = getChannel(button);
            let ccOut = button.cc;
            const output = banks[selectedBank].output;
            const buttonOffs = getButtonOffs(button);

            const isRelease = val === 0;
            const isToggle = buttonOffs === 'toggle';
            const isOnOff = buttonOffs === 'button-on-off';

            /* Toggle mode: flip active state on each press */
            const toggleKey = buttonToggleKey(selectedBank, i);
            const wasToggledOn = isToggle && toggledButtons.has(toggleKey);

            /* Ignore raw button release events (CC value 0) in on-only and toggle modes.
             * For toggle mode, only the press flips state; release just updates the LED. */
            if (isRelease && !isOnOff) {
                if (viewMode !== VIEW_SETTINGS || selectedButton !== i) {
                    if (isToggle) {
                        const colour = toggledButtons.has(toggleKey) ? getButtonRestingColour(button, i) : Black;
                        enqueueCcLED(ALL_BUTTONS[i], colour);
                    } else {
                        enqueueCcLED(ALL_BUTTONS[i], getButtonRestingColour(button, i));
                    }
                }
                return;
            }

            if (isToggle) {
                if (wasToggledOn) {
                    toggledButtons.delete(toggleKey);
                    button.value = 0;
                } else {
                    toggledButtons.add(toggleKey);
                    button.value = 127;
                }
            }

            let ccValue = val;
            if (isToggle) {
                ccValue = wasToggledOn ? 0 : 127;
            }

            /* Send MIDI on press, or on release only in on-off mode */
            if (!isRelease || isOnOff) {
                sendMidi(output, 0xB0, channel, ccOut, ccValue);
            }

            /* Refresh button LED: toggle shows state, non-toggle dims to black while held.
             * In settings view, leave the selected button pulsing. For white buttons,
             * restart the pulse when toggled so the dim/bright partner colour updates. */
            if (viewMode !== VIEW_SETTINGS || selectedButton !== i) {
                if (isToggle) {
                    const colour = toggledButtons.has(toggleKey) ? getButtonRestingColour(button, i) : Black;
                    enqueueCcLED(ALL_BUTTONS[i], colour);
                } else {
                    enqueueCcLED(ALL_BUTTONS[i], isRelease ? getButtonRestingColour(button, i) : Black);
                }
            } else if (viewMode === VIEW_SETTINGS && isWhiteButtonByIndex(i) && isToggle) {
                transferPulse(2, i);
            }

            /* Query the button mapping info and show overlay */
            if (viewMode === VIEW_MAIN && banks[selectedBank].overlay) {
                if (showButtonOverlay(selectedButton, ccValue)) needsRedraw = true;
            }
            return;
        }
    }

    /* Knobs send midi */
    for (let i = 0; i < ALL_KNOBS.length; i++) {
        if (cc === ALL_KNOBS[i]) {
            if (viewMode === VIEW_SETTINGS && selectedKnob != i) {
                settingsMenuState.editing = false;
                transferPulse(1, i);
            }
            selected = 1;
            selectedKnob = i;
            selectedPad = -1;
            selectedButton = -1;

            const knob = banks[selectedBank].knobs[i];
            let channel = getChannel(knob);
            let ccOut = knob.cc;
            let minOut = knob.min;
            let maxOut = knob.max;
            let multiplier = knob.multiplier ?? 1;
            let valOut = val;
            let storedValue = knob.value;
            if (!knob.relative) {
                valOut = storedValue;
                if (val === 127) {
                    valOut -= multiplier;
                } else if (val === 1) {
                    valOut += multiplier;
                }
                if (valOut < minOut) valOut = minOut;
                if (valOut > maxOut) valOut = maxOut;
                knob.value = valOut;
            }
            const midiValue = Math.round(valOut);
            sendMidi(banks[selectedBank].output, 0xB0, channel, ccOut, midiValue);

            if (viewMode === VIEW_MAIN) {
                let knobs = banks[selectedBank].knobs;
                let colour = getColourForKnobValue(knobs[i].colour, midiValue, knobs[i].min, knobs[i].max);
                const cacheKey = `${selectedBank}:${activeScene(selectedBank)}:${activeKnobPage(selectedBank)}:${selectedKnob}`;
                if (cachedKnobColour[cacheKey] != colour) {
                    enqueueCcLED(i+71, colour);
                    cachedKnobColour[cacheKey] = colour;
                }
                if (banks[selectedBank].overlay) {
                    if (showKnobOverlay(selectedKnob, midiValue)) needsRedraw = true;
                }
            }
            return;
        }
    }

    /* Settings view - delegate to shared menu components */
    if (viewMode === VIEW_SETTINGS) {
        if (!settingsMenuStack || settingsMenuStack.depth() === 0) {
            initSettingsMenu();
        }
        const current = settingsMenuStack.current();
        const items = current ? current.items : getSettingsItems();

        /* Capture the current value of the selected item before handling input,
         * so we can detect genuine changes (not just hover/scroll redraws). */
        const item = items[settingsMenuState.selectedIndex];
        const previousValue = item && item.get ? item.get() : undefined;

        const result = handleMenuInput({
            cc,
            value: val,
            items,
            state: settingsMenuState,
            stack: settingsMenuStack,
            shiftHeld
        });
        if (item && item.label === 'Colour' && settingsMenuState.editing) {
            if (selected === 0) enqueueNoteLED(MovePads[selectedPad], settingsMenuState.editValue);
            if (selected === 1) enqueueCcLED(ALL_KNOBS[selectedKnob], getColourForKnobValue(settingsMenuState.editValue, banks[selectedBank].knobs[selectedKnob].value, banks[selectedBank].knobs[selectedKnob].min, banks[selectedBank].knobs[selectedKnob].max));
            if (selected === 2) enqueueCcLED(ALL_BUTTONS[selectedButton], settingsMenuState.editValue);
            return;
        }
        if (item && item.label === 'Colour' && !settingsMenuState.editing) {
            if (selected === 0) enqueueNoteLED(MovePads[selectedPad], banks[selectedBank].pads[selectedPad].colour);
            if (selected === 1) enqueueCcLED(ALL_KNOBS[selectedKnob], getColourForKnobValue(banks[selectedBank].knobs[selectedKnob].colour, banks[selectedBank].knobs[selectedKnob].value, banks[selectedBank].knobs[selectedKnob].min, banks[selectedBank].knobs[selectedKnob].max));
            if (selected === 2) enqueueCcLED(ALL_BUTTONS[selectedButton], banks[selectedBank].buttons[selectedButton].colour);
            return;
        }
        if (item && item.label === 'Bank LED' && settingsMenuState.editing) {
            enqueueNoteLED(selectedBank + 16, settingsMenuState.editValue);
            return;
        }
        if (item && item.label === 'Bank LED' && !settingsMenuState.editing) {
            enqueueNoteLED(selectedBank + 16, banks[selectedBank].bankled ?? White);
            return;
        }
        /* Keep the selection pulsing in settings unless actively editing the
         * Colour or Bank LED item. */
        if (!settingsMenuState.editing || (item && item.label !== 'Colour' && item.label !== 'Bank LED')) {
            if (selected === 0 && selectedPad >= 0) {
                transferPulse(0, selectedPad);
            } else if (selected === 1 && selectedKnob >= 0) {
                transferPulse(1, selectedKnob);
            } else if (selected === 2 && selectedButton >= 0) {
                transferPulse(2, selectedButton);
            } else if (selected === 3) {
                transferPulse(3, selectedBank);
            }
        }
        if (item && item.label === 'Name' && cc === CC_JOG_CLICK && val > 63) {
            let lastEnteredText = "";
            if (selected === 0) lastEnteredText = banks[selectedBank].pads[selectedPad].name ?? "";
            if (selected === 1) lastEnteredText = banks[selectedBank].knobs[selectedKnob].name ?? "";
            if (selected === 2) lastEnteredText = banks[selectedBank].buttons[selectedButton].name ?? "";
            if (selected === 3) lastEnteredText = banks[selectedBank].name ?? "";
            if (lastEnteredText === "(empty)") lastEnteredText = "";
            openTextEntry({
                title: "Enter Name",
                initialText: lastEnteredText,
                onConfirm: (text) => {
                    if (selected === 0) banks[selectedBank].pads[selectedPad].name = text || "(empty)";
                    if (selected === 1) banks[selectedBank].knobs[selectedKnob].name = text || "(empty)";
                    if (selected === 2) banks[selectedBank].buttons[selectedButton].name = text || "(empty)";
                    if (selected === 3) banks[selectedBank].name = text || "(empty)";
                }
            });
            settingsMenuState.editing = false;
            settingsMenuState.editValue = null;
            needsRedraw = true;
            return;
        }
        if (item && item.label === 'Page Name' && cc === CC_JOG_CLICK && val > 63) {
            const page = activeKnobPage(selectedBank);
            let lastText = bankCfg(selectedBank)?.knobpagenames?.[page] ?? "";
            if (lastText === "(empty)") lastText = "";
            openTextEntry({
                title: "Enter Page Name",
                initialText: lastText,
                onConfirm: (text) => {
                    const cfg = bankCfg(selectedBank);
                    if (!cfg.knobpagenames) cfg.knobpagenames = {};
                    cfg.knobpagenames[page] = text || "(empty)";
                }
            });
            settingsMenuState.editing = false;
            settingsMenuState.editValue = null;
            needsRedraw = true;
            return;
        }

        /* Detect whether an enum/value/toggle item was just changed (not merely hovered).
         * handleMenuInput sets needsRedraw when a value is committed and clears editValue.
         * For toggles, editing is never true and editValue stays null. */
        const itemChanged = result && result.needsRedraw && !settingsMenuState.editing &&
            item && item.get && settingsMenuState.editValue === null &&
            item.get() !== previousValue;

        /* LED On toggle for white buttons: update resting colour and restart pulse
         * so the new base colour is reflected immediately. */
        if (itemChanged && item.label === 'LED On' && isWhiteButtonByIndex(selectedButton)) {
            const ledColour = banks[selectedBank].buttons[selectedButton].ledOn ? White : Black;
            const cc = ALL_BUTTONS[selectedButton];
            enqueueCcLED(cc, ledColour);
            transferPulse(2, selectedButton);
        }

        /* Restore toggle state from config when pad/button off mode changes */
        if (itemChanged && (item.label === 'Pad Offs' || item.label === 'Button Offs')) {
            restoreToggleStateForBank(selectedBank);
        }

        /* Full LED refresh when Pad Offs, H/light Colour, Button Offs or a paging/layout option changes */
        if (itemChanged && (item.label === 'Pad Offs' || item.label === 'H/light Colour' || item.label === 'Button Offs' || item.label === 'Knob Pages' || item.label === 'Pad Pages' || item.label === 'Pad Layout' || item.label === 'KB Root' || item.label === 'Scenes')) {
            updateLEDs();
        }

        /* When bank-level Pad Offs, Pad Mode, MIDI Channel, Output or Button Offs changes, clear per-element overrides */
        if (itemChanged && selected === 3 && item && (item.label === 'Pad Offs' || item.label === 'Pad Mode' || item.label === 'MIDI Channel' || item.label === 'Output' || item.label === 'Button Offs')) {
            const bankConfig = config[selectedBank];
            if (bankConfig) {
                if (bankConfig.pads) {
                    for (let i = 0; i < NUM_PADS; i++) {
                        if (bankConfig.pads[i]) {
                            if (item.label === 'Pad Offs') delete bankConfig.pads[i].padoffs;
                            if (item.label === 'Pad Mode') delete bankConfig.pads[i].padmode;
                            if (item.label === 'MIDI Channel') delete bankConfig.pads[i].channel;
                            if (item.label === 'Output') delete bankConfig.pads[i].output;
                        }
                    }
                }
                if (item.label === 'MIDI Channel' && bankConfig.knobs) {
                    for (let i = 0; i < NUM_KNOBS; i++) {
                        if (bankConfig.knobs[i]) delete bankConfig.knobs[i].channel;
                    }
                }
                if (item.label === 'MIDI Channel' && bankConfig.pageknobs) {
                    for (let p = 1; p < NUM_KNOB_PAGES; p++) {
                        const pageKnobs = bankConfig.pageknobs[p];
                        if (pageKnobs) {
                            for (let i = 0; i < NUM_KNOBS - 1; i++) {
                                if (pageKnobs[i]) delete pageKnobs[i].channel;
                            }
                        }
                    }
                }
                if (bankConfig.pagepads) {
                    for (let p = 1; p < NUM_PAD_PAGES; p++) {
                        const pagePads = bankConfig.pagepads[p];
                        if (pagePads) {
                            for (let i = 0; i < NUM_PADS; i++) {
                                if (pagePads[i]) {
                                    if (item.label === 'Pad Offs') delete pagePads[i].padoffs;
                                    if (item.label === 'Pad Mode') delete pagePads[i].padmode;
                                    if (item.label === 'MIDI Channel') delete pagePads[i].channel;
                                    if (item.label === 'Output') delete pagePads[i].output;
                                }
                            }
                        }
                    }
                }
                if ((item.label === 'MIDI Channel' || item.label === 'Button Offs') && bankConfig.buttons) {
                    for (let i = 0; i < ALL_BUTTONS.length; i++) {
                        if (bankConfig.buttons[i]) {
                            if (item.label === 'MIDI Channel') delete bankConfig.buttons[i].channel;
                            if (item.label === 'Button Offs') delete bankConfig.buttons[i].buttonoffs;
                        }
                    }
                }
                if (bankConfig.scenedata) {
                    for (let s = 1; s < NUM_SCENES; s++) {
                        const sd = bankConfig.scenedata[s];
                        if (!sd) continue;
                        if (item.label === 'MIDI Channel' && sd.pageknobs) {
                            for (let p = 1; p < NUM_KNOB_PAGES; p++) {
                                const pageKnobs = sd.pageknobs[p];
                                if (pageKnobs) {
                                    for (let i = 0; i < NUM_KNOBS - 1; i++) {
                                        if (pageKnobs[i]) delete pageKnobs[i].channel;
                                    }
                                }
                            }
                        }
                        if (sd.pagepads) {
                            for (let p = 1; p < NUM_PAD_PAGES; p++) {
                                const pagePads = sd.pagepads[p];
                                if (pagePads) {
                                    for (let i = 0; i < NUM_PADS; i++) {
                                        if (pagePads[i]) {
                                            if (item.label === 'Pad Offs') delete pagePads[i].padoffs;
                                            if (item.label === 'Pad Mode') delete pagePads[i].padmode;
                                            if (item.label === 'MIDI Channel') delete pagePads[i].channel;
                                            if (item.label === 'Output') delete pagePads[i].output;
                                        }
                                    }
                                }
                            }
                        }
                        if (sd.pads) {
                            for (let i = 0; i < NUM_PADS; i++) {
                                if (sd.pads[i]) {
                                    if (item.label === 'Pad Offs') delete sd.pads[i].padoffs;
                                    if (item.label === 'Pad Mode') delete sd.pads[i].padmode;
                                    if (item.label === 'MIDI Channel') delete sd.pads[i].channel;
                                    if (item.label === 'Output') delete sd.pads[i].output;
                                }
                            }
                        }
                        if (item.label === 'MIDI Channel' && sd.knobs) {
                            for (let i = 0; i < NUM_KNOBS; i++) {
                                if (sd.knobs[i]) delete sd.knobs[i].channel;
                            }
                        }
                        if ((item.label === 'MIDI Channel' || item.label === 'Button Offs') && sd.buttons) {
                            for (let i = 0; i < ALL_BUTTONS.length; i++) {
                                if (sd.buttons[i]) {
                                    if (item.label === 'MIDI Channel') delete sd.buttons[i].channel;
                                    if (item.label === 'Button Offs') delete sd.buttons[i].buttonoffs;
                                }
                            }
                        }
                    }
                }
            }
        }

        if (result && result.needsRedraw) {
            needsRedraw = true;
        }
        return;
    }
}

function handleNote(note, vel) {
    /* Knob touch */
    if (note >= 0 && note <= 8 && vel > 0) {
        if (viewMode === VIEW_MAIN && banks[selectedBank].overlay) showKnobOverlay(note);
        if (viewMode === VIEW_SETTINGS && selectedKnob != note) {
            settingsMenuState.editing = false;
            transferPulse(1, note);
        }
        selectedKnob = note;
        selectedPad = -1;
        selectedButton = -1;
        selected = 1;
        needsRedraw = true;
        return;
    }
    /* Step buttons change bank */
    if (note >= 16 && note <= 31 && vel > 0) {
        const bankIdx = note - 16;
        if (viewMode === VIEW_MAIN) showStepOverlay(bankIdx);
        if (viewMode === VIEW_SETTINGS) {
            settingsMenuState.editing = false;
            transferPulse(3, bankIdx);
        }
        flushHeldPads();  /* settle offs for pads held across the switch */
        selectedBank = bankIdx;
        selectedKnob = -1;
        selectedPad = -1;
        selectedButton = -1;
        selected = 3;
        chokes = [];
        needsRedraw = true;
        updateLEDs();
        return;
    }
    /* Pads press */
    if (note >= 68 && note <= 99 && vel > 0) {
        const padIdx = note - 68;
        /* Knob pages: top row pads act as page selectors instead of sending MIDI */
        if (banks[selectedBank].knobpages && padIdx >= KNOB_PAGE_PAD_START) {
            if (viewMode === VIEW_SETTINGS) settingsMenuState.editing = false;
            const page = padIdx - KNOB_PAGE_PAD_START;
            banks[selectedBank].knobpage = page;
            updateLEDs();
            if (viewMode === VIEW_MAIN && banks[selectedBank].overlay) {
                const bankName = banks[selectedBank].name;
                const bankLabel = bankName !== DEFAULTS.BANK.NAME ? bankName : `Bank ${selectedBank + 1}`;
                const pageName = bankCfg(selectedBank)?.knobpagenames?.[page];
                const pageLabel = pageName && pageName !== '(empty)' ? pageName : `Page ${page + 1}`;
                showOverlay(bankLabel, pageLabel, OVERLAY_DURATION);
            }
            needsRedraw = true;
            return;
        }
        if (viewMode === VIEW_SETTINGS && selectedPad != padIdx) {
            settingsMenuState.editing = false;
            transferPulse(0, padIdx);
        }
        selectedKnob = -1;
        selectedButton = -1;
        selectedPad = padIdx;
        selected = 0;
        const pad = banks[selectedBank].pads[selectedPad];
        const padMode = getPadMode(pad);
        const padOutput = getPadOutput(pad);
        let channel = getChannel(pad);
        let noteOut = kbLayoutActive(selectedBank) && padMode === 'note'
            ? keyboardNote(selectedBank, padIdx)
            : pad.note;
        let ccOut = pad.cc;
        const highlightColour = resolveHighlightColour(banks[selectedBank].hlcolour, pad.colour);
        const padOffMode = getPadOffs(pad);

        /* Record the off this press will owe on release, so a page/bank flip
         * while held can settle it correctly (see flushHeldPads) */
        swallowedPadReleases.delete(padIdx);
        heldPadOffs.set(padIdx,
            padOffMode === 'toggle' ? null
            : padMode === 'cc' ? { output: padOutput, status: 0xB0, channel, d1: ccOut }
            : padOffMode === 'pad-on-off' ? { output: padOutput, status: 0x80, channel, d1: noteOut }
            : null);

        /* edit velocity */
        let padLevel = pad.level ?? 100;
        let masterPadLevel = banks[selectedBank].level ?? 100;
        let minPadLevel = banks[selectedBank].min ?? 0;
        let velOut = Math.round(vel * (padLevel/100) * (masterPadLevel/100));
        if (velOut > 127) velOut = 127;
        if (velOut < minPadLevel) velOut = minPadLevel;

        /* toggle mode: flip active state on each press */
        const toggleKey = padToggleKey(selectedBank, padIdx);
        const isToggleOff = padOffMode === 'toggle' && toggledNotes.has(toggleKey);
        if (isToggleOff) {
            toggledNotes.delete(toggleKey);
            pad.value = 0;
        } else if (padOffMode === 'toggle') {
            toggledNotes.add(toggleKey);
            pad.value = 127;
        }

        /* choke group handling */
        let padChokeGrp = pad.chokegrp;
        if (padChokeGrp) {
            if (typeof chokes[padChokeGrp] === 'undefined' || chokes[padChokeGrp] === noteOut) {
                chokes[padChokeGrp] = -1;
            }
        }

        /* send midi */
        function sendNoteOn() {
            sendMidi(padOutput, 0x90, channel, noteOut, velOut);
            if (padChokeGrp && chokes[padChokeGrp] != -1) {
                sendMidi(padOutput, 0x80, channel, chokes[padChokeGrp], 0);
            }
            if (padChokeGrp) chokes[padChokeGrp] = noteOut;
        }

        function sendNoteOff() {
            sendMidi(padOutput, 0x80, channel, noteOut, 0);
        }

        function sendCc(value) {
            sendMidi(padOutput, 0xB0, channel, ccOut, value);
        }

        let displayVelOut = velOut;
        if (padMode === 'cc') {
            if (padOffMode === 'toggle' && isToggleOff) {
                sendCc(0);
                displayVelOut = 0;
            } else {
                sendCc(127);
                displayVelOut = 127;
            }
        } else if (padOffMode === 'toggle') {
            if (isToggleOff) {
                sendNoteOff();
                displayVelOut = 0;
            } else {
                sendNoteOn();
            }
        } else {
            sendNoteOn();
        }

        if (viewMode === VIEW_MAIN && highlightColour != 0) {
            if (kbLayoutActive(selectedBank) && padMode === 'note') {
                /* Light every note-mode pad mapping to this pitch -
                 * overlapping layouts place the same note on several pads */
                const allPads = banks[selectedBank].pads;
                for (let j = 0; j < NUM_PADS; j++) {
                    if (getPadMode(allPads[j]) === 'note' && keyboardNote(selectedBank, j) === noteOut) {
                        enqueueNoteLED(j + 68, highlightColour);
                    }
                }
            } else if (padOffMode === 'toggle') {
                /* In toggle mode the LED state is inverted: */
                /* highlight = active/toggled-on, pad colour = off/pressed-moment */
                enqueueNoteLED(note, pad.colour);
            } else {
                enqueueNoteLED(note, highlightColour);
            }
        }
        if (viewMode === VIEW_MAIN && banks[selectedBank].overlay) showPadOverlay(padIdx, displayVelOut);
        needsRedraw = true;
        return;
    }
    /* Pads release */
    if (note >= 68 && note <= 99 && vel === 0) {
        const padIdx = note - 68;
        /* Knob page selectors send nothing, so their release is ignored */
        if (banks[selectedBank].knobpages && padIdx >= KNOB_PAGE_PAD_START) return;

        /* A page/bank flip while held already sent this pad's off - swallow */
        if (swallowedPadReleases.delete(padIdx)) {
            updateLEDs();
            needsRedraw = true;
            return;
        }

        const releasePad = banks[selectedBank].pads[padIdx];

        /* send midi */
        const releasePadMode = getPadMode(releasePad);
        const releasePadOffMode = getPadOffs(releasePad);
        const padOutput = getPadOutput(releasePad);
        const releaseChannel = getChannel(releasePad);
        let releaseNoteOut = releasePad.note;
        const releaseToggleKey = padToggleKey(selectedBank, padIdx);
        if (heldPadOffs.has(padIdx)) {
            /* Use the off recorded at press so config can't have drifted */
            const off = heldPadOffs.get(padIdx);
            heldPadOffs.delete(padIdx);
            if (off) {
                sendMidi(off.output, off.status, off.channel, off.d1, 0);
                if (off.status === 0xB0 && viewMode === VIEW_MAIN && banks[selectedBank].overlay) showPadOverlay(padIdx, 0);
            }
        } else if (releasePadMode === 'note' && releasePadOffMode === 'pad-on-off') {
            sendMidi(padOutput, 0x80, releaseChannel, releaseNoteOut, vel);
        } else if (releasePadMode === 'cc' && releasePadOffMode !== 'toggle') {
            sendMidi(padOutput, 0xB0, releaseChannel, releasePad.cc, 0);
            if (viewMode === VIEW_MAIN && banks[selectedBank].overlay) showPadOverlay(padIdx, 0);
        }

        const releaseHighlightColour = resolveHighlightColour(banks[selectedBank].hlcolour, releasePad.colour);
        if (kbLayoutActive(selectedBank) && releasePadMode === 'note' && viewMode === VIEW_MAIN) {
            /* Restore keyboard colouring on every pad showing this pitch,
             * brightened while a toggle is on */
            const relNote = keyboardNote(selectedBank, padIdx);
            const pc = relNote % 12;
            const kbColour = toggledNotes.has(releaseToggleKey) ? White
                : pc === 0 ? White : KB_SHARPS.has(pc) ? Black : DarkGrey;
            const allPads = banks[selectedBank].pads;
            for (let j = 0; j < NUM_PADS; j++) {
                if (getPadMode(allPads[j]) === 'note' && keyboardNote(selectedBank, j) === relNote) {
                    enqueueNoteLED(j + 68, kbColour);
                }
            }
        } else if (viewMode === VIEW_MAIN && releaseHighlightColour != 0) {
            if (releasePadOffMode === 'toggle' && toggledNotes.has(releaseToggleKey)) {
                /* Toggle is on: show pad colour */
                enqueueNoteLED(note, releasePad.colour);
            } else if (releasePadOffMode === 'toggle') {
                /* Toggle is off: show highlight colour */
                enqueueNoteLED(note, releaseHighlightColour);
            } else {
                /* Non-toggle: return to pad colour */
                enqueueNoteLED(note, releasePad.colour);
            }
        }
        needsRedraw = true;
        return;
    }
}

function onMidiMessage(msg) {
    if (!msg || msg.length < 3) return;

    const status = msg[0] & 0xF0;
    const data1 = msg[1];
    const data2 = msg[2];

    /* Text entry handles its own MIDI when active */
    if (isTextEntryActive()) {
        handleTextEntryMidi(msg);
        return;
    }

    /* Dismiss overlay on user interaction, but NOT for knob turns (they update the overlay)
     * Don't return early - let the input be processed (it may show a new overlay) */
    const isKnobCC = (status === 0xB0 && ALL_KNOBS.includes(data1));
    if (!isKnobCC) {
        dismissOverlayOnInput(msg);
    }

    if (status === 0xB0) {
        handleCC(data1, data2);
    } else if (status === 0x90 || status === 0x80) {
        const vel = status === 0x80 ? 0 : data2;
        handleNote(data1, vel);
    } else if (status === 0xA0) {
        if (data2 > 18) {  /* ignore light aftertouch */
            let channel = banks[selectedBank].channel - 1;
            sendMidi(banks[selectedBank].output, status, channel, data1, data2);
        }
    }
}

/* Match an incoming external CC against mapped controls in banks that have
 * MIDI In enabled. Updates stored values (and toggle state) so LEDs and
 * outgoing values stay in sync without re-transmitting anything. */
function handleExternalCC(channel, ccNum, value) {
    let matched = false;
    for (let b = 0; b < NUM_BANKS; b++) {
        const bank = banks[b];
        if (!bank) continue;

        /* Every configured scene (sub-bank) stays in sync; unconfigured
         * scenes are skipped like unconfigured pages to avoid phantom
         * matches and empty scenedata entries. MIDI In is per-scene. */
        const scenes = scenesActive(b) ? NUM_SCENES : 1;
        for (let s = 0; s < scenes; s++) {
            const sceneCfg = s > 0 ? config[b]?.scenedata?.[s] : config[b];
            if (!sceneCfg || !sceneCfg.midiin) continue;

            const sceneChannel = sceneCfg.channel ?? DEFAULTS.BANK.CHANNEL;

            /* Knobs - check every configured page so state stays in sync when
             * switching. Unconfigured pages (2-8) are skipped: their knobs only
             * carry default CCs, which would create phantom matches and empty
             * pageknobs entries in the config. */
            const pages = sceneCfg.knobpages ? NUM_KNOB_PAGES : 1;
            for (let p = 0; p < pages; p++) {
                if (p > 0 && !sceneCfg.pageknobs?.[p]) continue;
                const knobs = getKnobs(b, p, s);
                /* Paged views share the master knob; only match it on page 0 */
                const count = p === 0 ? NUM_KNOBS : NUM_KNOBS - 1;
                for (let i = 0; i < count; i++) {
                    const knob = knobs[i];
                    const ch = (knob.channel ?? sceneChannel) - 1;
                    if (ch !== channel || knob.cc !== ccNum) continue;
                    knob.value = value;
                    matched = true;
                    if (b === selectedBank && p === activeKnobPage(b) && s === activeScene(b)) {
                        const colour = getColourForKnobValue(knob.colour, value, knob.min, knob.max);
                        const cacheKey = `${b}:${s}:${p}:${i}`;
                        if (cachedKnobColour[cacheKey] !== colour) {
                            enqueueCcLED(i + 71, colour);
                            cachedKnobColour[cacheKey] = colour;
                        }
                    }
                }
            }

            /* Buttons */
            const bankButtonOffs = sceneCfg.buttonoffs ?? DEFAULTS.BANK.BUTTON_OFFS;
            const buttons = getButtons(b, s);
            for (let i = 0; i < ALL_BUTTONS.length; i++) {
                const button = buttons[i];
                const ch = (button.channel ?? sceneChannel) - 1;
                if (ch !== channel || button.cc !== ccNum) continue;
                matched = true;
                const buttonOffs = button.buttonoffs ?? bankButtonOffs;
                if (buttonOffs === 'toggle') {
                    const key = buttonToggleKey(b, i, s);
                    if (value > 63) { toggledButtons.add(key); button.value = 127; }
                    else { toggledButtons.delete(key); button.value = 0; }
                    if (b === selectedBank && s === activeScene(b)) {
                        enqueueCcLED(ALL_BUTTONS[i], value > 63 ? getButtonRestingColour(button, i) : Black);
                    }
                } else {
                    button.value = value;
                }
            }

            /* CC-mode pads - every configured pad page, so state stays synced when
             * switching (top row excluded when it serves as knob page selectors) */
            const bankPadMode = sceneCfg.padmode ?? DEFAULTS.BANK.PAD_MODE;
            const bankPadOffMode = sceneCfg.padoffs ?? DEFAULTS.BANK.PAD_OFFS;
            const padLimit = sceneCfg.knobpages ? KNOB_PAGE_PAD_START : NUM_PADS;
            const padPages = padPagesActive(b, s) ? NUM_PAD_PAGES : 1;
            for (let p = 0; p < padPages; p++) {
                if (p > 0 && !sceneCfg.pagepads?.[p]) continue;
                const pads = getPads(b, p, s);
                for (let i = 0; i < padLimit; i++) {
                    const pad = pads[i];
                    const padMode = pad.padmode ?? bankPadMode;
                    if (padMode !== 'cc' || pad.cc !== ccNum) continue;
                    const ch = (pad.channel ?? sceneChannel) - 1;
                    if (ch !== channel) continue;
                    matched = true;
                    const padOffMode = pad.padoffs ?? bankPadOffMode;
                    if (padOffMode === 'toggle') {
                        const key = padToggleKey(b, i, p, s);
                        if (value > 63) { toggledNotes.add(key); pad.value = 127; }
                        else { toggledNotes.delete(key); pad.value = 0; }
                        if (b === selectedBank && p === activePadPage(b) && s === activeScene(b)) {
                            enqueueNoteLED(i + 68, value > 63 ? pad.colour : resolveHighlightColour(sceneCfg.hlcolour, pad.colour));
                        }
                    } else {
                        pad.value = value;
                    }
                }
            }
        }
    }
    midiInReceived++;
    if (matched) midiInMatched++;
    if (DEBUG_MIDI_IN && !matched) console.log(`MIDI in: no match ch=${channel + 1} cc=${ccNum} val=${value} (matched ${midiInMatched}/${midiInReceived})`);
}

function onExternalMidiMessage(msg) {
    if (!msg || msg.length < 3) return;

    /* External messages may arrive either as [status, d1, d2] or with a
     * cable/type prefix byte: [cable<<4|type, status, d1, d2]. Log the raw
     * form while debugging so the actual format is visible on device. */
    if (DEBUG_MIDI_IN) console.log(`ext midi (${msg.length}b): ${JSON.stringify(msg)}`);

    const off = msg.length >= 4 ? 1 : 0;
    const status = msg[off];
    if ((status & 0xF0) === 0xB0) {
        handleExternalCC(status & 0x0F, msg[off + 1], msg[off + 2]);
    }
}

    /* ============================================================================
 * Lifecycle
 * ============================================================================ */

function init() {
    /* Clear LEDs first */
    clearAllLEDs();

    /* Take the master/volume knob outright: Move otherwise processes CC 79 /
     * master-touch note 8 in parallel (real volume change) and steals the
     * OLED for its own volume overlay while the knob is held. */
    if (typeof shadow_set_overtake_suppress_master_volume === 'function') {
        shadow_set_overtake_suppress_master_volume(1);
    }

    /* Initial sync */
    banks = loadConfig();

    /* Initial LED state */
    updateLEDs();

    /* Initial draw */
    draw();
}

function tick() {
    tickCount++;

    /* Handle overlay timeout */
    if (tickOverlay()) {
        needsRedraw = true;
    }

    /* Text entry takes over when active */
    if (isTextEntryActive()) {
        tickTextEntry();
        drawTextEntry();
        return;
    }

    /* drain up to LED_MSGS_PER_TICK per tick */
    flushLEDQueue();

    /* Periodic state sync and redraw */
    if (tickCount % REDRAW_INTERVAL === 0) {
        needsRedraw = true;
    }

    if (needsRedraw) {
        draw();
        needsRedraw = false;
    }
}

/* Export module interface */
globalThis.init = init;
globalThis.tick = tick;
globalThis.onMidiMessageInternal = onMidiMessage;
globalThis.onMidiMessageExternal = onExternalMidiMessage;
