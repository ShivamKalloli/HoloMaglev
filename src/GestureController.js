// In: src/GestureController.js

// --- THIS IS THE CORRECTED IMPORT ---
// We are now importing from the local "node_modules" package
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// Helper function to check if a finger is curled
function isFingerCurled(tip, knuckle) {
    return tip.y > knuckle.y;
}

export class GestureController {
    constructor() {
        this.handLandmarker = null;
        this.webcamRunning = false;
        this.videoElement = document.getElementById("webcam");
        this.uiButton = document.getElementById("gesture-btn");
        this.lastGesture = "none";
        this.lastVideoTime = -1;

        if (this.uiButton) {
            this.uiButton.addEventListener('click', () => this.toggleWebcam());
            this.uiButton.disabled = true;
        }
        
        this.createHandLandmarker();
    }

    async createHandLandmarker() {
        try {
            // --- THIS IS THE CORRECTED PATH ---
            // We are telling it to find the helper files in our local node_modules folder
            const vision = await FilesetResolver.forVisionTasks(
                "./node_modules/@mediapipe/tasks-vision/wasm"
            );
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 1
            });
            console.log("HandLandmarker model loaded.");
            if (this.uiButton) this.uiButton.disabled = false;
        } catch(error) {
            console.error("Failed to load HandLandmarker model:", error);
        }
    }

    toggleWebcam() {
        if (!this.handLandmarker) {
            console.error("HandLandmarker model not loaded yet.");
            return;
        }

        if (this.webcamRunning) {
            this.webcamRunning = false;
            if (this.uiButton) this.uiButton.classList.remove("active");
            if (this.videoElement.srcObject) {
                this.videoElement.srcObject.getTracks().forEach(track => track.stop());
            }
            console.log("Gesture control stopped.");
        } else {
            this.webcamRunning = true;
            if (this.uiButton) this.uiButton.classList.add("active");
            
            navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
                this.videoElement.srcObject = stream;
                this.videoElement.addEventListener("loadeddata", () => this.predictWebcam());
            }).catch(err => {
                console.error("Error accessing webcam:", err);
                this.webcamRunning = false;
                if (this.uiButton) this.uiButton.classList.remove("active");
            });
            console.log("Gesture control started.");
        }
    }

    async predictWebcam() {
        if (!this.handLandmarker || !this.webcamRunning) return;

        if (this.videoElement.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = this.videoElement.currentTime;
            try {
                const results = this.handLandmarker.detectForVideo(this.videoElement, performance.now());
                if (results.landmarks && results.landmarks.length > 0) {
                    this._recognizeGesture(results.landmarks[0]);
                } else {
                    if (this.lastGesture !== "none") {
                        this.lastGesture = "none";
                        console.log("No hand detected.");
                    }
                }
            } catch (error) {
                console.error("Error during hand detection:", error);
            }
        }
        
        if (this.webcamRunning) {
            window.requestAnimationFrame(() => this.predictWebcam());
        }
    }

    _recognizeGesture(landmarks) {
        // Get positions for all relevant joints
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const indexKnuckle = landmarks[5];
        const middleTip = landmarks[12];
        const middleKnuckle = landmarks[9];
        const ringTip = landmarks[16];
        const ringKnuckle = landmarks[13];
        const pinkyTip = landmarks[20];
        const pinkyKnuckle = landmarks[17];

        // --- Define gesture rules ---
        const indexCurled = isFingerCurled(indexTip, indexKnuckle);
        const middleCurled = isFingerCurled(middleTip, middleKnuckle);
        const ringCurled = isFingerCurled(ringTip, ringKnuckle);
        const pinkyCurled = isFingerCurled(pinkyTip, pinkyKnuckle);

        const allFingersCurled = indexCurled && middleCurled && ringCurled && pinkyCurled;
        const allFingersExtended = !indexCurled && !middleCurled && !ringCurled && !pinkyCurled;

        // Calculate distance between thumb and index finger
        const pinchDistance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);

        let currentGesture = "none";

        // --- Gesture Priority ---
        // 1. Pinch (most specific)
        if (pinchDistance < 0.05) {
            currentGesture = "pinch_close";
        }
        // 2. Pointing
        else if (!indexCurled && middleCurled && ringCurled && pinkyCurled) {
            // This logic assumes the camera is not mirrored. If your webcam is mirrored,
            // 'left' and 'right' might be swapped.
            if (indexTip.x > 0.7) currentGesture = "pointing_left"; // Hand is on the right side of the screen
            else if (indexTip.x < 0.3) currentGesture = "pointing_right"; // Hand is on the left side of the screen
            else currentGesture = "pointing"; // Just pointing, no turn
        }
        // 3. Two Fingers (Resume)
        else if (!indexCurled && !middleCurled && ringCurled && pinkyCurled) {
            currentGesture = "two_fingers_up";
        }
        // 4. Fist (Pause)
        // else if (allFingersCurled) {
        //     currentGesture = "fist";
        // }
        // 5. Open Palm (Zoom Out)
        else if (allFingersExtended) {
            currentGesture = "open_palm";
        }
        
        // Only send a command if the gesture has changed
        if (currentGesture !== this.lastGesture && currentGesture !== "none") {
            this.lastGesture = currentGesture;
            console.log("Gesture recognized:", currentGesture);
            this.sendCommand(currentGesture);
        }
    }
    
    sendCommand(commandName) {
        const event = new CustomEvent('gestureCommand', { detail: { command: commandName } });
        window.dispatchEvent(event);
    }
}