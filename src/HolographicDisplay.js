import * as THREE from 'three';

export class HolographicDisplay {
    constructor(sceneToRender) {
        this.scene = sceneToRender;
        this.clock = new THREE.Clock();
        // --- ADD THIS LINE ---
        this.voiceController = null;

        // --- VIEW SWITCH ---: ADDED
        this.isHolographicMode = true; // Start in holographic mode by default

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setScissorTest(true);
        document.body.appendChild(this.renderer.domElement);

        this.cameras = [];
        for (let i = 0; i < 4; i++) {
            const camera = new THREE.PerspectiveCamera(75, 1.0, 0.1, 1000);
            this.cameras.push(camera);
        }

        // --- VIEW SWITCH ---: ADDED
        this.mainCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        this.targetTheta = 0;
        this.currentTheta = 0;
        this.targetPhi = Math.PI / 2 * 0.9;
        this.currentPhi = Math.PI / 2 * 0.9;
        this.targetRadius = 35;
        this.currentRadius = 35;
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.DAMPING_FACTOR = 0.05;
        this.spherical = new THREE.Spherical();
        this.rollQuaternion = new THREE.Quaternion();
        this.rollAxis = new THREE.Vector3(0, 0, 1);

        this.animate = this.animate.bind(this);
        this._setupEventListeners();

        // --- ADD THIS ENTIRE BLOCK ---
        // Inside the constructor of HolographicDisplay.js

        // REPLACE your existing voice listener in HolographicDisplay.js with this
        // REPLACE your existing voice listener in HolographicDisplay.js with this
        window.addEventListener('voiceCommand', (event) => {
            const command = event.detail.command;
            const speak = (text) => { if (this.voiceController) { this.voiceController.speak(text); } };

            // Define our zoom increment
            const ZOOM_INCREMENT = 10.0;
            
            // --- 🟢 THIS IS THE FIX 🟢 ---
            // It now matches your new threshold value of 3.0
            const MICRO_THRESHOLD = 3.0; 
            // --- END OF FIX ---

            const DEFAULT_ZOOM = 35.0;
            const MAX_ZOOM = 150.0;

            switch (command) {
                case 'presenterMode':
                    this.isHolographicMode = false;
                    speak("Presenter mode activated.");
                    break;
                case 'holographicMode':
                    this.isHolographicMode = true;
                    speak("Holographic mode activated.");
                    break;

                // --- NEW INCREMENTAL ZOOM ---
                case 'zoomIn':
                    // Zoom in, but don't go past the new threshold
                    this.targetRadius = Math.max(MICRO_THRESHOLD, this.targetRadius - ZOOM_INCREMENT);
                    speak("Zooming in.");
                    break;
                case 'zoomOut':
                    this.targetRadius = Math.min(MAX_ZOOM, this.targetRadius + ZOOM_INCREMENT);
                    speak("Zooming out.");
                    break;

                // --- NEW SHORTCUT COMMANDS ---
                case 'microscopicMode':
                    // Go directly to the microscopic view
                    this.targetRadius = MICRO_THRESHOLD;
                    speak("Engaging microscopic view.");
                    break;
                case 'exitMicroscopic':
                    this.targetRadius = DEFAULT_ZOOM;
                    speak("Exiting microscopic view.");
                    break;

                // --- ROTATION COMMANDS ---
                case 'turnLeft':
                    this.targetTheta += Math.PI / 4; // Turn 45 degrees
                    speak("Turning left.");
                    break;
                case 'turnRight':
                    this.targetTheta -= Math.PI / 4; // Turn 45 degrees
                    speak("Turning right.");
                    break;
            }
        });
    }

    // --- ADD THIS ENTIRE NEW FUNCTION ---
    setVoiceController(controller) {
        this.voiceController = controller;
    }

    _setupEventListeners() {
        window.addEventListener('mousedown', (e) => this.onMouseDown(e), false);
        window.addEventListener('mousemove', (e) => this.onMouseMove(e), false);
        window.addEventListener('mouseup', (e) => this.onMouseUp(e), false);
        window.addEventListener('wheel', (e) => this.onWheel(e), false);
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // --- VIEW SWITCH ---: ADDED
        window.addEventListener('keydown', (e) => this.onKeyDown(e), false);
    }

    // --- VIEW SWITCH ---: ADDED
    onKeyDown(event) {
        if (event.key.toLowerCase() === 'h') {
            this.isHolographicMode = !this.isHolographicMode;
            console.log("Switched to", this.isHolographicMode ? "Holographic Mode" : "Presenter Mode");
        }
    }

    start() {
        this.animate();
    }
    
    animate() {
        requestAnimationFrame(this.animate);
        const deltaTime = this.clock.getDelta();

        this.currentTheta += (this.targetTheta - this.currentTheta) * this.DAMPING_FACTOR;
        this.currentPhi += (this.targetPhi - this.currentPhi) * this.DAMPING_FACTOR;
        this.currentRadius += (this.targetRadius - this.currentRadius) * this.DAMPING_FACTOR;

        if (this.scene.update) {
            this.scene.update(deltaTime, this.currentRadius);
        }

        const lookAtTarget = this.scene.cameraTarget ? this.scene.cameraTarget.position : new THREE.Vector3(0,0,0);
        const offset = new THREE.Vector3();
        this.spherical.set(this.currentRadius, this.currentPhi, this.currentTheta);
        offset.setFromSpherical(this.spherical);
        const masterCameraPosition = new THREE.Vector3().copy(lookAtTarget).add(offset);

        // --- VIEW SWITCH ---: MODIFIED to choose which render path to take
        if (this.isHolographicMode) {
            this.renderer.setScissorTest(true);

            // YOUR ORIGINAL HOLOGRAPHIC LOGIC - UNCHANGED
            for (let i = 0; i < 4; i++) {
                const camera = this.cameras[i];
                camera.position.copy(masterCameraPosition);
                camera.lookAt(lookAtTarget);
                let rollAngle = 0;
                if (i === 1) rollAngle = Math.PI;
                if (i === 2) rollAngle = -Math.PI / 2;
                if (i === 3) rollAngle = Math.PI / 2;
                this.rollQuaternion.setFromAxisAngle(this.rollAxis, rollAngle);
                camera.quaternion.multiply(this.rollQuaternion);
            }
            
            const w = window.innerWidth;
            const h = window.innerHeight;
            const screenCenter_X = w / 2;
            const screenCenter_Y = h / 2;
            const sideLength = Math.min(w / 3, h / 3);

            this.renderer.setViewport(screenCenter_X - sideLength / 2, screenCenter_Y + sideLength / 2, sideLength, sideLength);
            this.renderer.setScissor(screenCenter_X - sideLength / 2, screenCenter_Y + sideLength / 2, sideLength, sideLength);
            this.renderer.render(this.scene, this.cameras[0]);

            this.renderer.setViewport(screenCenter_X - sideLength / 2, screenCenter_Y - sideLength * 1.5, sideLength, sideLength);
            this.renderer.setScissor(screenCenter_X - sideLength / 2, screenCenter_Y - sideLength * 1.5, sideLength, sideLength);
            this.renderer.render(this.scene, this.cameras[1]);

            this.renderer.setViewport(screenCenter_X - sideLength * 1.5, screenCenter_Y - sideLength / 2, sideLength, sideLength);
            this.renderer.setScissor(screenCenter_X - sideLength * 1.5, screenCenter_Y - sideLength / 2, sideLength, sideLength);
            this.renderer.render(this.scene, this.cameras[2]);

            this.renderer.setViewport(screenCenter_X + sideLength / 2, screenCenter_Y - sideLength / 2, sideLength, sideLength);
            this.renderer.setScissor(screenCenter_X + sideLength / 2, screenCenter_Y - sideLength / 2, sideLength, sideLength);
            this.renderer.render(this.scene, this.cameras[3]);

        } else {
            // --- NEW PRESENTER MODE LOGIC ---
            this.renderer.setScissorTest(false);

            this.mainCamera.position.copy(masterCameraPosition);
            this.mainCamera.lookAt(lookAtTarget);

            this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
            this.renderer.render(this.scene, this.mainCamera);
        }
    }

    onMouseDown(event) {
        this.isDragging = true;
        this.previousMousePosition.x = event.clientX;
        this.previousMousePosition.y = event.clientY;
    }

    onMouseMove(event) {
        if (!this.isDragging) return;
        const deltaX = event.clientX - this.previousMousePosition.x;
        const deltaY = event.clientY - this.previousMousePosition.y;
        this.targetTheta -= deltaX * 0.005;
        this.targetPhi -= deltaY * 0.005;
        const phiMin = 0.1;
        const phiMax = Math.PI - 0.1;
        this.targetPhi = Math.max(phiMin, Math.min(phiMax, this.targetPhi));
        this.previousMousePosition.x = event.clientX;
        this.previousMousePosition.y = event.clientY;
    }

    onMouseUp() {
        this.isDragging = false;
    }

    onWheel(event) {
        this.targetRadius += event.deltaY * 0.05;
        this.targetRadius = Math.max(2, Math.min(150, this.targetRadius));
    }
    
    onWindowResize() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // --- VIEW SWITCH ---: ADDED
        this.mainCamera.aspect = window.innerWidth / window.innerHeight;
        this.mainCamera.updateProjectionMatrix();
    }
}