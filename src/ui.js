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
import * as os from 'os';

/* ============================================================================
 * Constants
 * ============================================================================ */

const SCREEN_WIDTH = 128;
const SCREEN_HEIGHT = 64;

const NUM_PADS = 32;
const NUM_KNOBS = 9;
const NUM_BANKS = 16;

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
        HIGHLIGHTCOLOUR: 122
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
        get channel() { return config[index].channel ?? DEFAULTS.BANK.CHANNEL; },
        set channel(v) { config[index].channel = v; },
        get name() { return config[index].name ?? DEFAULTS.BANK.NAME; },
        set name(v) { config[index].name = v; },
        get level() { return config[index].level ?? DEFAULTS.BANK.LEVEL; },
        set level(v) { config[index].level = v; },
        get min() { return config[index].min ?? DEFAULTS.BANK.MIN; },
        set min(v) { config[index].min = v; },
        get output() { return config[index].output ?? DEFAULTS.BANK.OUTPUT; },
        set output(v) { config[index].output = v; },
        get padoffs() { return config[index].padoffs ?? DEFAULTS.BANK.PAD_OFFS; },
        set padoffs(v) { config[index].padoffs = v; },
        get padmode() { return config[index].padmode ?? DEFAULTS.BANK.PAD_MODE; },
        set padmode(v) { config[index].padmode = v; },
        get buttonoffs() { return config[index].buttonoffs ?? DEFAULTS.BANK.BUTTON_OFFS; },
        set buttonoffs(v) { config[index].buttonoffs = v; },
        get overlay() { return config[index].overlay ?? DEFAULTS.BANK.OVERLAY; },
        set overlay(v) { config[index].overlay = v; },
        get hlcolour() { return config[index].hlcolour ?? DEFAULTS.BANK.HIGHLIGHTCOLOUR; },
        set hlcolour(v) { config[index].hlcolour = v; },
        get bankled() { return config[index].bankled ?? White; },
        set bankled(v) { config[index].bankled = v; },
        pads: getPads(index),
        knobs: getKnobs(index),
        buttons: getButtons(index)
    };

    return bank;
}

function getPads(bankIndex) {
    if (!config[bankIndex].pads) config[bankIndex].pads = {};

    /* Helper to ensure pad exists */
    const ensurePad = (i) => {
        if (!config[bankIndex].pads[i]) config[bankIndex].pads[i] = {};
        return config[bankIndex].pads[i];
    };

    return new Array(NUM_PADS).fill(0).map((_, i) => ({
        get note() { return config[bankIndex].pads[i]?.note ?? (i + DEFAULTS.PAD.NOTE_OFFSET); },
        set note(v) { ensurePad(i).note = v; },
        get cc() { return config[bankIndex].pads[i]?.cc ?? (i + DEFAULTS.PAD.CC_OFFSET); },
        set cc(v) { ensurePad(i).cc = v; },
        get name() { return config[bankIndex].pads[i]?.name ?? DEFAULTS.PAD.NAME; },
        set name(v) { ensurePad(i).name = v; },
        get colour() { return config[bankIndex].pads[i]?.colour ?? DEFAULTS.PAD.COLOUR; },
        set colour(v) { ensurePad(i).colour = v; },
        get level() { return config[bankIndex].pads[i]?.level ?? DEFAULTS.PAD.LEVEL; },
        set level(v) { ensurePad(i).level = v; },
        get chokegrp() { return config[bankIndex].pads[i]?.chokegrp ?? DEFAULTS.PAD.CHOKEGRP; },
        set chokegrp(v) { ensurePad(i).chokegrp = v; },
        get padoffs() { return config[bankIndex].pads[i]?.padoffs ?? null; },
        set padoffs(v) { ensurePad(i).padoffs = v; },
        get padmode() { return config[bankIndex].pads[i]?.padmode ?? null; },
        set padmode(v) { ensurePad(i).padmode = v; },
        get channel() { return config[bankIndex].pads[i]?.channel ?? null; },
        set channel(v) { ensurePad(i).channel = v; },
        get output() { return config[bankIndex].pads[i]?.output ?? null; },
        set output(v) { ensurePad(i).output = v; },
        get value() { return config[bankIndex].pads[i]?.value ?? 0; },
        set value(v) { ensurePad(i).value = v; }
    }));
}

function getKnobs(bankIndex) {
    if (!config[bankIndex].knobs) config[bankIndex].knobs = {};

    /* Helper to ensure knob exists */
    const ensureKnob = (i) => {
        if (!config[bankIndex].knobs[i]) config[bankIndex].knobs[i] = {};
        return config[bankIndex].knobs[i];
    };

    return new Array(NUM_KNOBS).fill(0).map((_, i) => ({
        get value() { return config[bankIndex].knobs[i]?.value ?? DEFAULTS.KNOB.VALUE; },
        set value(v) { ensureKnob(i).value = v; },
        get cc() { return config[bankIndex].knobs[i]?.cc ?? (i + DEFAULTS.KNOB.CC_OFFSET); },
        set cc(v) { ensureKnob(i).cc = v; },
        get name() { return config[bankIndex].knobs[i]?.name ?? DEFAULTS.KNOB.NAME; },
        set name(v) { ensureKnob(i).name = v; },
        get colour() { return config[bankIndex].knobs[i]?.colour ?? DEFAULTS.KNOB.COLOUR; },
        set colour(v) { ensureKnob(i).colour = v; },
        get min() { return config[bankIndex].knobs[i]?.min ?? DEFAULTS.KNOB.MIN; },
        set min(v) { ensureKnob(i).min = v; },
        get max() { return config[bankIndex].knobs[i]?.max ?? DEFAULTS.KNOB.MAX; },
        set max(v) { ensureKnob(i).max = v; },
        get relative() { return config[bankIndex].knobs[i]?.relative ?? DEFAULTS.KNOB.RELATIVE; },
        set relative(v) { ensureKnob(i).relative = v; },
        get multiplier() { return config[bankIndex].knobs[i]?.multiplier ?? DEFAULTS.KNOB.MULTIPLIER; },
        set multiplier(v) { ensureKnob(i).multiplier = v; },
        get channel() { return config[bankIndex].knobs[i]?.channel ?? null; },
        set channel(v) { ensureKnob(i).channel = v; }
    }));
}

function getButtons(bankIndex) {
    if (!config[bankIndex].buttons) config[bankIndex].buttons = {};

    /* Helper to ensure button exists */
    const ensureButton = (i) => {
        if (!config[bankIndex].buttons[i]) config[bankIndex].buttons[i] = {};
        return config[bankIndex].buttons[i];
    };

    return new Array(ALL_BUTTONS.length).fill(0).map((_, i) => ({
        get cc() { return config[bankIndex].buttons[i]?.cc ?? ALL_BUTTONS[i]; },
        set cc(v) { ensureButton(i).cc = v; },
        get name() { return config[bankIndex].buttons[i]?.name ?? BUTTON_NAMES[i]; },
        set name(v) { ensureButton(i).name = v; },
        get colour() { return config[bankIndex].buttons[i]?.colour ?? DEFAULTS.BUTTON.COLOUR; },
        set colour(v) { ensureButton(i).colour = v; },
        get channel() { return config[bankIndex].buttons[i]?.channel ?? null; },
        set channel(v) { ensureButton(i).channel = v; },
        get buttonoffs() { return config[bankIndex].buttons[i]?.buttonoffs ?? null; },
        set buttonoffs(v) { ensureButton(i).buttonoffs = v; },
        get ledOn() { return config[bankIndex].buttons[i]?.ledOn ?? 0; },
        set ledOn(v) { ensureButton(i).ledOn = v ? 127 : 0; },
        get value() { return config[bankIndex].buttons[i]?.value ?? 0; },
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
    const bankPadOffMode = bank.padoffs ?? DEFAULTS.BANK.PAD_OFFS;
    const bankButtonOffs = bank.buttonoffs ?? DEFAULTS.BANK.BUTTON_OFFS;
    for (let i = 0; i < NUM_PADS; i++) {
        const pad = bank.pads[i];
        const padOffMode = pad.padoffs ?? bankPadOffMode;
        const key = `${bankIndex}:${i}`;
        if (padOffMode === 'toggle' && pad.value === 127) {
            toggledNotes.add(key);
        } else {
            toggledNotes.delete(key);
        }
    }
    for (let i = 0; i < ALL_BUTTONS.length; i++) {
        const button = bank.buttons[i];
        const buttonOffs = button.buttonoffs ?? bankButtonOffs;
        const key = `${bankIndex}:b${i}`;
        if (buttonOffs === 'toggle' && button.value === 127) {
            toggledButtons.add(key);
        } else {
            toggledButtons.delete(key);
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

    const displayName = (name !== DEFAULTS.KNOB.NAME) ? name : `Knob: ${knobNum + 1}`;
    showOverlay(displayName, `${value}  CC: ${cc}`, OVERLAY_DURATION);
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
    showOverlay(displayName, `${value}  CC: ${cc}`, OVERLAY_DURATION);
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
        const note = banks[selectedBank].pads[padNum].note;
        valueInfo = `Note: ${midiNotes[note]} (${note})`;
    }
    const displayName = (name !== DEFAULTS.PAD.NAME) ? name : valueInfo;
    const valueText = padMode === 'cc' ? (vel === 127 ? 'On' : 'Off') : vel;
    showOverlay(displayName, `${valueText}  Pad: ${padNum + 1}`, OVERLAY_DURATION);
    return true;
}

/* Query step mapping info and show overlay */
function showStepOverlay(stepNum) {
    let name = banks[stepNum].name;
    const displayName = (name !== DEFAULTS.BANK.NAME) ? name : `Bank ${stepNum + 1}`;
    showOverlay("Bank changed", displayName, OVERLAY_DURATION);
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
    for (let i = 0; i < NUM_PADS; i++) {
        const pad = pads[i];
        const padOffMode = pad.padoffs ?? bankPadOffMode;
        let colour = pad.colour ?? Black;
        if (padOffMode === 'toggle') {
            const toggleKey = `${selectedBank}:${i}`;
            if (toggledNotes.has(toggleKey)) {
                /* Toggled on: show pad colour */
                colour = pad.colour ?? Black;
            } else {
                /* Toggled off: show highlight colour */
                colour = resolveHighlightColour(bankHl, pad.colour);
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
            const toggleKey = `${selectedBank}:b${i}`;
            colour = toggledButtons.has(toggleKey) ? getButtonRestingColour(button, i) : Black;
        }
        enqueueCcLED(ALL_BUTTONS[i], colour);
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
        return [
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
        return [
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
    if (selected === 0) return `Pad ${selectedPad + 1}`;
    if (selected === 1) return `Knob ${selectedKnob + 1}`;
    if (selected === 2) return `Button ${selectedButton + 1}`;
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
            const toggleKey = `${selectedBank}:b${i}`;
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
                if (cachedKnobColour[selectedKnob] != colour) {
                    enqueueCcLED(i+71, colour);
                    cachedKnobColour[selectedKnob] = colour;
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

        /* Full LED refresh when Pad Offs, H/light Colour or Button Offs changes */
        if (itemChanged && (item.label === 'Pad Offs' || item.label === 'H/light Colour' || item.label === 'Button Offs')) {
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
                if ((item.label === 'MIDI Channel' || item.label === 'Button Offs') && bankConfig.buttons) {
                    for (let i = 0; i < ALL_BUTTONS.length; i++) {
                        if (bankConfig.buttons[i]) {
                            if (item.label === 'MIDI Channel') delete bankConfig.buttons[i].channel;
                            if (item.label === 'Button Offs') delete bankConfig.buttons[i].buttonoffs;
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
        let noteOut = pad.note;
        let ccOut = pad.cc;
        const highlightColour = resolveHighlightColour(banks[selectedBank].hlcolour, pad.colour);
        const padOffMode = getPadOffs(pad);

        /* edit velocity */
        let padLevel = pad.level ?? 100;
        let masterPadLevel = banks[selectedBank].level ?? 100;
        let minPadLevel = banks[selectedBank].min ?? 0;
        let velOut = Math.round(vel * (padLevel/100) * (masterPadLevel/100));
        if (velOut > 127) velOut = 127;
        if (velOut < minPadLevel) velOut = minPadLevel;

        /* toggle mode: flip active state on each press */
        const toggleKey = `${selectedBank}:${padIdx}`;
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
            if (typeof chokes[padChokeGrp] === 'undefined') chokes[padChokeGrp] = -1;
            if (chokes[padChokeGrp] === noteOut) chokes[padChokeGrp] = -1; //remove current pad if exists
        }

        /* send midi */
        function sendNoteOn() {
            sendMidi(padOutput, 0x90, channel, noteOut, velOut);
            if (chokes[padChokeGrp] != -1) {
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
            if (padOffMode === 'toggle') {
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
        const releasePad = banks[selectedBank].pads[padIdx];

        /* send midi */
        const releasePadMode = getPadMode(releasePad);
        const releasePadOffMode = getPadOffs(releasePad);
        const padOutput = getPadOutput(releasePad);
        const releaseChannel = getChannel(releasePad);
        let releaseNoteOut = releasePad.note;
        const releaseToggleKey = `${selectedBank}:${padIdx}`;
        if (releasePadMode === 'note' && releasePadOffMode === 'pad-on-off') {
            sendMidi(padOutput, 0x80, releaseChannel, releaseNoteOut, vel);
        } else if (releasePadMode === 'cc' && releasePadOffMode !== 'toggle') {
            sendMidi(padOutput, 0xB0, releaseChannel, releasePad.cc, 0);
            if (viewMode === VIEW_MAIN && banks[selectedBank].overlay) showPadOverlay(padIdx, 0);
        }

        const releaseHighlightColour = resolveHighlightColour(banks[selectedBank].hlcolour, releasePad.colour);
        if (viewMode === VIEW_MAIN && releaseHighlightColour != 0) {
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

function midiIgnore(msg) {
    /* ignore external MIDI messages */
}

    /* ============================================================================
 * Lifecycle
 * ============================================================================ */

function init() {
    /* Clear LEDs first */
    clearAllLEDs();
    os.sleep(200);

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
globalThis.onMidiMessageExternal = midiIgnore;
