// In: src/main.js

import { GUI } from 'dat.gui';
import { HolographicDisplay } from './HolographicDisplay.js';
import { SCMaglevScene } from './scenes/SCMaglevScene.js';
import { VoiceController } from './VoiceController.js';
import { GestureController } from './GestureController.js';

// --- GUI SETUP ---
const gui = new GUI();

// --- SCENE & DISPLAY SETUP ---
// We now pass the 'gui' object into the scene's constructor
const scene = new SCMaglevScene(gui);
const display = new HolographicDisplay(scene);

// This 'Start / Reset' button will now reset the train's position
// using the current physics values you've set in the sandbox.
gui.add(scene.params, 'start').name("Start / Reset");

// --- START THE SIMULATION ---
display.start();

const voiceController = new VoiceController();

// --- AUDIO FEEDBACK ---: Pass the voice controller to the scene
scene.setVoiceController(voiceController);

// --- ADD THIS LINE ---
display.setVoiceController(voiceController);

const gestureController = new GestureController();

window.addEventListener('gestureCommand', (event) => {
    const command = event.detail.command;
    const speak = (text) => { if (voiceController) { voiceController.speak(text); } };

    // --- Commands for the Scene (Physics) ---
    // switch (command) {
    //     case 'fist':
    //         scene.isPaused = true;
    //         speak("Simulation paused.");
    //         break;
    //     case 'two_fingers_up':
    //         scene.isPaused = false;
    //         speak("Resuming simulation.");
    //         break;
    // }

    // --- Commands for the Display (Camera) ---
    switch (command) {
        case 'pointing_left':
            display.targetTheta += Math.PI / 4; // Turn 45 degrees
            speak("Turning left.");
            break;
        case 'pointing_right':
            display.targetTheta -= Math.PI / 4; // Turn 45 degrees
            speak("Turning right.");
            break;
        case 'pinch_close':
            display.targetRadius = Math.max(2, display.targetRadius - 10); // Zoom in
            speak("Zooming in.");
            break;
        case 'open_palm':
            display.targetRadius = Math.min(150, display.targetRadius + 10); // Zoom out
            speak("Zooming out.");
            break;
    }
});