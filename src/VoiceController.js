// In: src/VoiceController.js

export class VoiceController {
    constructor() {
        // Check for browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("Speech Recognition is not supported in this browser.");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false; // Only listen for a single command at a time
        this.recognition.lang = 'en-US';
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 1;

        this.isListening = false;
        this.uiButton = document.getElementById('voice-btn');

        // This function runs when the API gets a result
        this.recognition.onresult = (event) => {
            const command = event.results[0][0].transcript.toLowerCase().trim();
            console.log('Voice command received:', command);
            this.parseCommand(command);
        };

        // This function runs when listening stops
        this.recognition.onend = () => {
            this.isListening = false;
            if (this.uiButton) this.uiButton.classList.remove('listening');
            console.log('Voice recognition stopped.');
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
        };

        // Add a click listener to our microphone button
        if (this.uiButton) {
            this.uiButton.addEventListener('click', () => {
                if (this.isListening) {
                    this.stopListening();
                } else {
                    this.startListening();
                }
            });
        }
        
        // Add a reference to the browser's speech synthesis API
        this.synth = window.speechSynthesis;
    }

    speak(text) {
        if (this.synth.speaking) {
            return;
        }
        if (text !== '') {
            const utterance = new SpeechSynthesisUtterance(text);
            this.synth.speak(utterance);
        }
    }

    startListening() {
        if (this.isListening) return;
        this.isListening = true;
        if (this.uiButton) this.uiButton.classList.add('listening');
        this.recognition.start();
        console.log('Voice recognition started. Speak now...');
    }

    stopListening() {
        this.isListening = false;
        if (this.uiButton) this.uiButton.classList.remove('listening');
        this.recognition.stop();
    }

    // --- THIS IS THE CORRECTED PARSING LOGIC ---
    // REPLACE your entire parseCommand function with this one
    parseCommand(command) {
        // --- Quantitative Commands (with numbers) ---
        const gravityMatch = command.match(/gravity to (\d+(\.\d+)?)/);
        const levitationMatch = command.match(/levitation to (\d+)/);
        const propulsionMatch = command.match(/propulsion to (\d+)/);
        const dampingMatch = command.match(/damping to (\d+)/);
        const cabinMatch = command.match(/(cabin|cabins) to (\d+)/);

        if (gravityMatch) { this.sendCommand('setGravity', parseFloat(gravityMatch[1])); return; }
        if (levitationMatch) { this.sendCommand('setLevitation', parseInt(levitationMatch[1])); return; }
        if (propulsionMatch) { this.sendCommand('setPropulsion', parseInt(propulsionMatch[1])); return; }
        if (dampingMatch) { this.sendCommand('setDamping', parseInt(dampingMatch[1])); return; }
        if (cabinMatch) { this.sendCommand('setCabins', parseInt(cabinMatch[2])); return; }
        
        // --- NEW Camera & View Commands ---
        if (command.includes('zoom in')) {
            this.sendCommand('zoomIn');
        } else if (command.includes('zoom out')) {
            this.sendCommand('zoomOut');
        } else if (command.includes('microscopic') || command.includes('focus view')) {
            this.sendCommand('microscopicMode');
        } else if (command.includes('exit') || command.includes('normal view')) {
            this.sendCommand('exitMicroscopic');
        } else if (command.includes('presenter') || command.includes('full screen')) {
            this.sendCommand('presenterMode');
        } else if (command.includes('hologram') || command.includes('holographic')) {
            this.sendCommand('holographicMode');
        } else if (command.includes('left')) {
            this.sendCommand('turnLeft');
        } else if (command.includes('right')) {
            this.sendCommand('turnRight');
        }
        
        // --- Existing Keyword Commands ---
        else if (command.includes('start') || command.includes('reset simulation')) {
            this.sendCommand('start');
        } else if (command.includes('faster') || command.includes('accelerate') || command.includes('increase propulsion')) {
            this.sendCommand('propulsionUp');
        } else if (command.includes('slower') || command.includes('decelerate') || command.includes('decrease propulsion')) {
            this.sendCommand('propulsionDown');
        } else if (command.includes('stop') || command.includes('break')) {
            this.sendCommand('stop');
        } else if (command.includes('pause')) {
            this.sendCommand('pause');
        } else if (command.includes('resume') || command.includes('play')) {
            this.sendCommand('resume');
        } else if (command.includes('increase gravity')) {
            this.sendCommand('gravityUp');
        } else if (command.includes('decrease gravity')) {
            this.sendCommand('gravityDown');
        } else if (command.includes('increase levitation') || command.includes('more lift')) {
            this.sendCommand('levitationUp');
        } else if (command.includes('decrease levitation') || command.includes('less lift')) {
            this.sendCommand('levitationDown');
        } else if (command.includes('increase damping') || command.includes('more stability')) {
            this.sendCommand('dampingUp');
        } else if (command.includes('decrease damping') || command.includes('less stability')) {
            this.sendCommand('dampingDown');
        } else if (command.includes('reset physics') || command.includes('default settings')) {
            this.sendCommand('resetPhysics');
        }
    }

    // --- THIS IS THE CORRECTED DISPATCH FUNCTION ---
    sendCommand(commandName, value = null) {
        const event = new CustomEvent('voiceCommand', { 
            detail: { 
                command: commandName,
                value: value 
            } 
        });
        window.dispatchEvent(event);
    }
}