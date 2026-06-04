import * as THREE from 'three';
import { Magnet } from '../physics/Magnet.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class SCMaglevScene extends THREE.Scene {
    constructor(gui) {
        super();
        this.background = new THREE.Color(0x000000);

        this.params = {
            start: () => this.reset(),
        };

        this.voiceController = null;
        this.isPaused = false;
        this.ZOOM_THRESHOLD = 3.1;
        this.isMicroscopicView = false;
        
        this.isDraggingMagnet = false;

        this.locomotiveModel = null;
        this.cabinModel = null;
        this.visibleTrainModel = null; // Will hold the *visible* 3D models

        // --- 🟢 FIX #1 & #2: Train Layout ---
        this.LOCO_LENGTH = 10.2;
        this.CABIN_LENGTH = 10;
        this.CABIN_GAP = 1;
        this.WHEEL_X_OFFSET = 0.1;
        this.WHEEL_Z_OFFSET = 0.5;
        
        this.physicsFolder = null;

        this.defaultParams = {
            gravity: 9.8,
            levitationForceConstant: 1300,
            propulsionForce: 40,
            dampingFactor_Stable: 40,
        };
        
        this.sim = {
            numCabins: 1, // --- 🟢 FIX #2: Default cabin count set to 1 ---
            k_revenue_per_cabin: 25000,
            k_energy_per_cabin: 8000,
            k_maint_per_cabin: 3000,
            k_infra_per_cabin_sq: 150 
        };

        this.propulsionForce = this.defaultParams.propulsionForce;
        this.maxSpeed = 150;
        this.dragCoefficient = 0.001;
        this.activationDistance = 3.0;
        this.COLOR_DEFAULT_EMISSIVE = new THREE.Color(0x221100);
        this.COLOR_PUSH = new THREE.Color(0xff0000);
        this.COLOR_PULL = new THREE.Color(0x0088ff);
        this.TAKEOFF_SPEED = 25;
        this.INITIAL_ACCELERATION = 3.0;
        this.NUM_TRACK_SEGMENTS = 8;
        this.TRACK_SEGMENT_LENGTH = 12;
        this.WHEELS_DOWN_Y = 0.3;
        this.trainMass = 100;                 
        this.gravity = this.defaultParams.gravity;
        this.levitationForceConstant = this.defaultParams.levitationForceConstant;
        this.guidewayRepulsionY = 0.5;        
        this.levitationRampUpTime = 4.0;      
        this.dampingFactor_Stable = this.defaultParams.dampingFactor_Stable;
        this.dampingFactor_Takeoff = 500;   
        this.trainVelocity = new THREE.Vector3(0, 0, 0);
        this.trainMagnets = [];
        this.guidewayCoils = [];
        this.levitationStrength = 0.0; 
        this.rampProgress = 0.0;
        this.statsPanel = document.getElementById('stats-panel');
        this.coilWorldPos = new THREE.Vector3();
        this.magnetWorldPos = new THREE.Vector3();
        this.cameraTarget = new THREE.Object3D();

        this.add(this.cameraTarget);
        this._setupLighting();
        this.initModels(); 

        if (gui) {
            const oldDiagramFolder = gui.__folders['Educational Diagrams'];
            if (oldDiagramFolder) {
                gui.removeFolder(oldDiagramFolder);
            }
            
            // This ensures the folder isn't duplicated
            if (!this.physicsFolder) {
                this.physicsFolder = gui.addFolder('Physics Sandbox');
                this.physicsFolder.add(this, 'gravity', 0, 20, 0.1).name('Gravity');
                this.physicsFolder.add(this, 'levitationForceConstant', 500, 5000).name('Levitation Force');
                this.physicsFolder.add(this, 'propulsionForce', 0, 100).name('Propulsion Force');
                this.physicsFolder.add(this, 'dampingFactor_Stable', 0, 100).name('Damping Factor');
                
                this.physicsFolder.add(this.sim, 'numCabins', 1, 30, 1).name('Num of Cabins')
                    .onChange((numCabins) => {
                        this.rebuildTrain(numCabins);
                    });
                    
                this.params.resetPhysics = () => this.resetPhysicsDefaults();
                // this.physicsFolder.add(this.params, 'resetPhysics').name('Reset to Defaults');
                this.physicsFolder.open();
            }
        }
        
        window.addEventListener('voiceCommand', (event) => {
            const { command, value } = event.detail;
            const speak = (text) => { if (this.voiceController) { this.voiceController.speak(text); } };

            switch (command) {
                case 'start': this.reset(); speak("Simulation reset."); this._updateGUISliders(); break;
                case 'propulsionUp': this.propulsionForce = Math.min(100, this.propulsionForce + 10); speak("Increasing propulsion."); this._updateGUISliders(); break;
                case 'propulsionDown': this.propulsionForce = Math.max(0, this.propulsionForce - 10); speak("Decreasing propulsion."); this._updateGUISliders(); break;
                case 'stop': this.propulsionForce = 0; this.speed = Math.max(0, this.speed * 0.5); speak("Brakes engaged."); this._updateGUISliders(); break;
                case 'pause': this.isPaused = true; speak("Simulation paused."); break;
                case 'resume': this.isPaused = false; speak("Resuming simulation."); break;
                case 'gravityUp': this.gravity = Math.min(20, this.gravity + 1.0); speak(`Gravity at ${this.gravity.toFixed(1)}`); this._updateGUISliders(); break;
                case 'gravityDown': this.gravity = Math.max(0, this.gravity - 1.0); speak(`Gravity at ${this.gravity.toFixed(1)}`); this._updateGUISliders(); break;
                case 'levitationUp': this.levitationForceConstant = Math.min(5000, this.levitationForceConstant + 250); speak("Increasing levitation."); this._updateGUISliders(); break;
                case 'levitationDown': this.levitationForceConstant = Math.max(500, this.levitationForceConstant - 250); speak("Decreasing levitation."); this._updateGUISliders(); break;
                case 'dampingUp': this.dampingFactor_Stable = Math.min(100, this.dampingFactor_Stable + 5); speak("Increasing stability."); this._updateGUISliders(); break;
                case 'dampingDown': this.dampingFactor_Stable = Math.max(0, this.dampingFactor_Stable - 5); speak("Decreasing stability."); this._updateGUISliders(); break;
                case 'resetPhysics': this.resetPhysicsDefaults(); speak("Physics reset to default."); this._updateGUISliders(); break;
                case 'setGravity': this.gravity = Math.max(0, Math.min(20, value)); speak(`Gravity set to ${this.gravity.toFixed(1)}`); this._updateGUISliders(); break;
                case 'setLevitation': this.levitationForceConstant = Math.max(500, Math.min(5000, value)); speak(`Levitation force set to ${this.levitationForceConstant}`); this._updateGUISliders(); break;
                case 'setPropulsion': this.propulsionForce = Math.max(0, Math.min(100, value)); speak(`Propulsion force set to ${this.propulsionForce}`); this._updateGUISliders(); break;
                case 'setDamping': this.dampingFactor_Stable = Math.max(0, Math.min(100, value)); speak(`Damping set to ${this.dampingFactor_Stable}`); this._updateGUISliders(); break;
                case 'setCabins':
                    // Clamp the value to the slider's 1-30 range
                    const newCabinCount = Math.max(1, Math.min(30, value));
                    
                    this.sim.numCabins = newCabinCount; // Update the simulation variable
                    speak(`Setting train to ${newCabinCount} cabins.`);
                    
                    this.rebuildTrain(newCabinCount); // Call the master rebuild function
                    this._updateGUISliders(); // Make the slider update
                    break;
                // --- END OF NEW CASE ---
            }
        });
        
        // This is a single, central listener for all gesture commands
        window.addEventListener('gestureCommand', (event) => {
            const command = event.detail.command;
            
            // Commands for the Scene (Physics)
            switch (command) {
                case 'fist':
                    this.isPaused = true;
                    if (this.voiceController) this.voiceController.speak("Simulation paused.");
                    break;
                case 'thumbs_up':
                    this.isPaused = false;
                    if (this.voiceController) this.voiceController.speak("Resuming simulation.");
                    break;
            }
        });
        
        this.reset();
    }

    setVoiceController(controller) {
        this.voiceController = controller;
    }

    _bindInteractionEvents() {
        this._onMicroViewMouseDown = this._onMicroViewMouseDown.bind(this);
        this._onMicroViewMouseUp = this._onMicroViewMouseUp.bind(this);
        this._onMicroViewMouseMove = this._onMicroViewMouseMove.bind(this);
    }
    
    _addInteractionListeners() {
        window.addEventListener('mousedown', this._onMicroViewMouseDown);
        window.addEventListener('mouseup', this._onMicroViewMouseUp);
        window.addEventListener('mousemove', this._onMicroViewMouseMove);
    }

    _removeInteractionListeners() {
        window.removeEventListener('mousedown', this._onMicroViewMouseDown);
        window.removeEventListener('mouseup', this._onMicroViewMouseUp);
        window.removeEventListener('mousemove', this._onMicroViewMouseMove);
    }

    _onMicroViewMouseDown(event) {
        if (this.isMicroscopicView && event.shiftKey) {
            this.isDraggingMagnet = true;
        }
    }

    _onMicroViewMouseUp(event) {
        this.isDraggingMagnet = false;
    }

    _onMicroViewMouseMove(event) {
        if (!this.isDraggingMagnet) return;
        const moveY = event.movementY * -0.01;
        this.microMagnet.position.y += moveY;
        this.microMagnet.position.y = THREE.MathUtils.clamp(this.microMagnet.position.y, 1.8, 5.0);
    }
    
    resetPhysicsDefaults() {
        this.gravity = this.defaultParams.gravity;
        this.levitationForceConstant = this.defaultParams.levitationForceConstant;
        this.propulsionForce = this.defaultParams.propulsionForce;
        this.dampingFactor_Stable = this.defaultParams.dampingFactor_Stable;
        this.reset();
        this._updateGUISliders(); // Update GUI on reset
    }

    _updateGUISliders() {
        if (this.physicsFolder) {
            for (let i in this.physicsFolder.__controllers) {
                this.physicsFolder.__controllers[i].updateDisplay();
            }
        }
    }
    
    reset() {
        this.speed = 0;
        this.isLevitating = false;
        this.trainVelocity.set(0, 0, 0);
        this.levitationStrength = 0.0;
        this.rampProgress = 0.0;
        this.guidewayCoils.forEach(c => c.material.emissive.copy(this.COLOR_DEFAULT_EMISSIVE));
        this.train.position.set(0, this.WHEELS_DOWN_Y, 0);
        this.wheelGroups.forEach(group => {
            group.position.y = -0.1;
        });
        for (let i = 0; i < this.trackSegments.length; i++) {
            const segment = this.trackSegments[i];
            segment.position.x = i * this.TRACK_SEGMENT_LENGTH - (this.TRACK_SEGMENT_LENGTH * 3);
        }
        setTimeout(() => { this.speed = 0.1; }, 100);
        this._updateStatsPanel();
    }
    
    initModels() {
        this.wheelGroups = [];
        this.trackSegments = [];
        this.guidewayCoils = [];

        this.train = new THREE.Group();
        this.add(this.train);
        
        this.guideway = new THREE.Group();
        this.add(this.guideway);

        this._loadTrainAssets(); 

        // We build the guideway *after* the train is loaded and rebuilt
        
        this.microscopicView = this._createMicroscopicView();
        this.add(this.microscopicView);
        
        this._bindInteractionEvents();
    }

    _loadTrainAssets() {
        const loadingManager = new THREE.LoadingManager();
        const loader = new GLTFLoader(loadingManager);

        loader.load( 'locomotive.glb', (gltf) => {
            this.locomotiveModel = gltf.scene;
            console.log("Locomotive model loaded.");
        });
        loader.load( 'cabin.glb', (gltf) => {
            this.cabinModel = gltf.scene;
            console.log("Cabin model loaded.");
        });

        loadingManager.onLoad = () => {
            console.log("All train assets loaded.");
            this.rebuildTrain(this.sim.numCabins);
        };
    }
    
    rebuildTrain(numCabins) {
        while(this.train.children.length > 0){ 
            this.train.remove(this.train.children[0]); 
        }
        this.trainMagnets = [];
        this.wheelGroups = [];
        this.visibleTrainModel = new THREE.Group(); // Use a group to hold all visible models
        this.train.add(this.visibleTrainModel);

        if (!this.locomotiveModel || !this.cabinModel) {
            console.error("Models not loaded yet! Cannot build train.");
            return;
        }

        // --- 🟢 FIX #1: Add Locomotive ---
        const locomotive = this.locomotiveModel.clone();
        
        // --- 🟢 FIX #1: Rotate Locomotive ---
        locomotive.rotation.y = Math.PI; // Rotate 180 degrees
        locomotive.scale.set(1, 1, 1); // Set your desired scale
        locomotive.position.set(0, 0, 0);
        
        this.visibleTrainModel.add(locomotive);
        this.addPhysicsComponents(0, this.LOCO_LENGTH); // Add physics for the loco

        // --- 🟢 FIX #2: Add Cabins (starting behind the loco) ---
        let currentX = -(this.LOCO_LENGTH / 2) - this.CABIN_GAP;

        for (let i = 0; i < numCabins; i++) {
            const cabin = this.cabinModel.clone();
            const cabinXPosition = currentX - (this.CABIN_LENGTH / 2);
            
            cabin.scale.set(1, 1, 1);
            cabin.position.set(cabinXPosition, 0, 0);
            
            this.visibleTrainModel.add(cabin);
            this.addPhysicsComponents(cabinXPosition, this.CABIN_LENGTH);
            
            currentX -= (this.CABIN_LENGTH + this.CABIN_GAP);
        }
        
        this._updateTrainPhysics(numCabins);
        this.rebuildGuideway(numCabins); // Pass numCabins, not numCars
        this.reset();
    }

    addPhysicsComponents(xPos, carLength) {
        // Add Magnets
        [-this.WHEEL_Z_OFFSET, this.WHEEL_Z_OFFSET].forEach(zPos => {
            const magnet = new Magnet([], 1000);
            magnet.position.set(xPos, -0.7, zPos); 
            this.train.add(magnet);
            this.trainMagnets.push(magnet);
        });

        // Add Wheels
        const wheelGeom = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 16);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 1, roughness: 0.4 });
        
        const frontWheelX = xPos - (carLength / 2) + this.WHEEL_X_OFFSET;
        const backWheelX = xPos + (carLength / 2) - this.WHEEL_X_OFFSET;

        [frontWheelX, backWheelX].forEach(wheelXPos => {
            const wheelGroup = new THREE.Group();
            wheelGroup.position.set(wheelXPos, -0.75, 0);
            this.wheelGroups.push(wheelGroup);

            [-this.WHEEL_Z_OFFSET, this.WHEEL_Z_OFFSET].forEach(zPos => {
                const wheel = new THREE.Mesh(wheelGeom, wheelMat);
                wheel.rotation.x = Math.PI / 2;
                wheel.position.z = zPos;
                wheelGroup.add(wheel);
            });
            this.train.add(wheelGroup);
        });
    }

    _updateTrainPhysics(numCabins) {
        // --- 🟢 FIX #5 & #6: Correct Physics ---
        // We define a mass for each set of physics components
        const massPerCar = 200; // Let's say loco and cabins are roughly equal in mass/lift
        
        // Total mass is now directly proportional to the total number of cars
        this.trainMass = (numCabins + 1) * massPerCar; // +1 for the locomotive

        const baseDrag = 0.001;
        const dragPerCabin = 0.0002;
        this.dragCoefficient = baseDrag + (numCabins * dragPerCabin);

        console.log(`Physics updated: ${numCabins+1} total cars, Mass: ${this.trainMass}, Drag: ${this.dragCoefficient}`);
    }

    // --- 🟢 FIX #3: Dynamic Guideway ---
    rebuildGuideway(numCabins) {
        while(this.guideway.children.length > 0){ 
            this.guideway.remove(this.guideway.children[0]); 
        }
        this.trackSegments = [];
        this.guidewayCoils = [];

        // Correctly calculate total train length
        const totalTrainLength = this.LOCO_LENGTH + (numCabins * this.CABIN_LENGTH) + (numCabins * this.CABIN_GAP) + 4.0;
        
        this.NUM_TRACK_SEGMENTS = Math.ceil(totalTrainLength / this.TRACK_SEGMENT_LENGTH) + 4; // Add 4 segments as a visual buffer

        console.log(`Rebuilding guideway with ${this.NUM_TRACK_SEGMENTS} segments.`);

        for (let i = 0; i < this.NUM_TRACK_SEGMENTS; i++) {
            const segment = this._createTrackSegment();
            this.guideway.add(segment);
        }
    }

    _createTrackSegment() { 
        const segment = new THREE.Group(); 
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.4 }); 
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6 }); 
        const coilMat = new THREE.MeshStandardMaterial({ color: 0xcc8800, roughness: 0.5, emissive: this.COLOR_DEFAULT_EMISSIVE, }); 
        
        // --- 🟢 FIX #3: Track Dimensions ---
        // Change the '3' to your desired width (e.g., 8)
        const trackWidth = 3.0; 
        const wallZ = trackWidth / 2.0;
        const coilZ = wallZ - 0.3;
        
        const base = new THREE.Mesh(new THREE.BoxGeometry(this.TRACK_SEGMENT_LENGTH, 0.1, trackWidth), baseMat); 
        base.position.y = 0; 
        segment.add(base); 
        const wallGeom = new THREE.BoxGeometry(this.TRACK_SEGMENT_LENGTH, 1.0, 0.2); 
        const wallLeft = new THREE.Mesh(wallGeom, wallMat); 
        wallLeft.position.set(0, 0.5, wallZ); 
        segment.add(wallLeft); 
        const wallRight = new THREE.Mesh(wallGeom, wallMat); 
        wallRight.position.set(0, 0.5, -wallZ); 
        segment.add(wallRight); 
        const coilGeom = new THREE.TorusGeometry(0.21, 0.06, 16, 32); 
        for (let x = -this.TRACK_SEGMENT_LENGTH / 2; x < this.TRACK_SEGMENT_LENGTH / 2; x += 0.7) { 
            [-coilZ, coilZ].forEach(zPos => { 
                const upperCoil = new THREE.Mesh(coilGeom, coilMat.clone()); 
                upperCoil.position.set(x, 0.75, zPos); 
                segment.add(upperCoil); 
                this.guidewayCoils.push(upperCoil); 
                const lowerCoil = new THREE.Mesh(coilGeom, coilMat.clone()); 
                lowerCoil.position.set(x, 0.3, zPos); 
                segment.add(lowerCoil); 
                this.guidewayCoils.push(lowerCoil); 
            }); 
        } 
        this.trackSegments.push(segment); 
        return segment; 
    }

    // --- Microscopic View (Unchanged from your last working version) ---
    _createMicroscopicView() {
        const group = new THREE.Group();
        const guidewayMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.4, transparent: true, opacity: 0.7 });
        const guidewayGeo = new THREE.BoxGeometry(12, 0.4, 6);
        const guidewayBase = new THREE.Mesh(guidewayGeo, guidewayMat);
        guidewayBase.position.y = 1.0;
        group.add(guidewayBase);
        const magnetMat = new THREE.MeshStandardMaterial({ color: 0xeeeeff, metalness: 0.5, roughness: 0.3, transparent: true, opacity: 0.7 });
        const magnetGeo = new THREE.BoxGeometry(4, 0.8, 2);
        this.microMagnet = new THREE.Mesh(magnetGeo, magnetMat);
        this.microMagnet.position.y = 5.0;
        group.add(this.microMagnet);
        const PARTICLE_COUNT = 1200;
        const guidewayParticleCount = 800;
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const types = new Float32Array(PARTICLE_COUNT);
        const randoms = new Float32Array(PARTICLE_COUNT * 3);
        const guidewaySurfaceY = 1.2;
        const magnetBaseY = 5.0 - 0.4;
        const initialMidpointY = (guidewaySurfaceY + magnetBaseY) / 2;
        const guidewayVolume = { h: initialMidpointY - guidewaySurfaceY, w: 10, d: 5 };
        const magnetVolume = { h: magnetBaseY - initialMidpointY, w: 4, d: 2 };
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            if (i < guidewayParticleCount) {
                const r = Math.random(); const h = Math.pow(r, 4); 
                positions[i3 + 0] = (Math.random() - 0.5) * guidewayVolume.w;
                positions[i3 + 1] = guidewaySurfaceY + (h * guidewayVolume.h);
                positions[i3 + 2] = (Math.random() - 0.5) * guidewayVolume.d;
                types[i] = 0.0;
            } else {
                const r = Math.random(); const h = Math.pow(r, 4);
                positions[i3 + 0] = (Math.random() - 0.5) * magnetVolume.w;
                positions[i3 + 1] = magnetBaseY - (h * magnetVolume.h);
                positions[i3 + 2] = (Math.random() - 0.5) * magnetVolume.d;
                types[i] = 1.0;
            }
            randoms[i3 + 0] = Math.random(); randoms[i3 + 1] = Math.random(); randoms[i3 + 2] = Math.random();
        }
        const particleGeo = new THREE.BufferGeometry();
        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeo.setAttribute('a_type', new THREE.BufferAttribute(types, 1));
        particleGeo.setAttribute('a_random', new THREE.BufferAttribute(randoms, 3));
        this.shaderUniforms = { u_time: { value: 0.0 }, u_intensity: { value: 0.0 }, u_magnet_y: { value: 5.0 } };
        const particleMat = new THREE.ShaderMaterial({
            uniforms: this.shaderUniforms,
            vertexShader: `
                uniform float u_time; uniform float u_intensity; uniform float u_magnet_y;
                attribute float a_type; attribute vec3 a_random;
                varying float v_type; varying float v_energy;
                float remap(float value, float low1, float high1, float low2, float high2) { return low2 + (value - low1) * (high2 - low2) / (high1 - low1); }
                void main() {
                    v_type = a_type; vec3 pos; float time = u_time * (0.5 + a_random.x * 0.5);
                    float guideway_surface = 1.2; float magnet_surface = u_magnet_y - 0.4;
                    float midpoint = mix(guideway_surface, magnet_surface, 0.5);
                    float initial_guideway_top = 2.9; float initial_magnet_bottom = 2.9; float initial_magnet_top = 4.6;
                    if (a_type < 0.5) {
                        float normalized_y = remap(position.y, guideway_surface, initial_guideway_top, 0.0, 1.0);
                        float top_boundary = mix(initial_guideway_top, midpoint, u_intensity);
                        pos = vec3(position.x, remap(normalized_y, 0.0, 1.0, guideway_surface, top_boundary), position.z);
                    } else {
                        float normalized_y = remap(position.y, initial_magnet_bottom, initial_magnet_top, 1.0, 0.0);
                        float bottom_boundary = mix(initial_magnet_bottom, midpoint, u_intensity);
                        pos = vec3(position.x, remap(normalized_y, 0.0, 1.0, magnet_surface, bottom_boundary), position.z);
                    }
                    pos.yz += vec2(sin(time + a_random.y * 6.28), cos(time + a_random.z * 6.28)) * 0.15;
                    float distance_to_mid = abs(pos.y - midpoint);
                    float energy_zone = 1.0 - smoothstep(0.0, 1.5, distance_to_mid);
                    v_energy = energy_zone * u_intensity;
                    float vibration = sin(u_time * 100.0 + a_random.x * 6.28) * v_energy * 0.3;
                    pos.x += vibration; pos.z += vibration;
                    vec4 modelViewPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = (20.0 / -modelViewPosition.z) * (1.0 + v_energy * 3.0);
                    gl_Position = projectionMatrix * modelViewPosition;
                }
            `,
            fragmentShader: `
                varying float v_type; varying float v_energy;
                void main() {
                    vec3 blue = vec3(0.2, 0.6, 1.0); vec3 green = vec3(0.3, 1.0, 0.5);
                    vec3 color = mix(blue, green, v_type);
                    color = mix(color, vec3(1.0, 1.0, 1.0), v_energy * v_energy);
                    float strength = 1.0 - distance(gl_PointCoord, vec2(0.5)) * 2.0;
                    gl_FragColor = vec4(color, strength * 0.9);
                }
            `,
            transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const particles = new THREE.Points(particleGeo, particleMat);
        group.add(particles);
        group.visible = false;
        return group;
    }
    
    _setupLighting() {
        this.add(new THREE.AmbientLight(0xffffff, 0.7));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        this.add(directionalLight);
    }

    // --- UPDATED update() function ---
    update(deltaTime, cameraRadius) {
        if (this.isPaused) {
            if (this.isMicroscopicView) { this.shaderUniforms.u_time.value += deltaTime; }
            return;
        }

        this._updateStatsPanel();

        if (cameraRadius !== undefined) {
            const shouldBeMicroscopic = cameraRadius < this.ZOOM_THRESHOLD;
            if (shouldBeMicroscopic !== this.isMicroscopicView) {
                this.isMicroscopicView = shouldBeMicroscopic;

                // --- 🟢 FIX #4: Correct View Switching ---
                // We toggle the entire guideway and micro view
                this.guideway.visible = !this.isMicroscopicView;
                this.microscopicView.visible = this.isMicroscopicView;
                
                // We *only* toggle the visible parts of the train
                if (this.visibleTrainModel) {
                    this.visibleTrainModel.visible = !this.isMicroscopicView;
                }
                this.wheelGroups.forEach(group => {
                    group.visible = !this.isMicroscopicView;
                });
                // Note: The main `this.train` group stays visible, as it's the
                // parent for physics magnets which we always need.
                // --- End of Fix ---

                if (this.isMicroscopicView) {
                    this._addInteractionListeners();
                } else {
                    this._removeInteractionListeners();
                    this.isDraggingMagnet = false;
                }
            }
        }
        
        if (this.isMicroscopicView) {
            this.shaderUniforms.u_time.value += deltaTime;
            const distance = (this.microMagnet.position.y - 0.4) - 1.2;
            let intensity = 1.0 / (distance * distance);
            intensity = THREE.MathUtils.clamp(intensity * 1.5, 0.0, 1.0); 
            this.shaderUniforms.u_intensity.value = intensity;
            this.shaderUniforms.u_magnet_y.value = this.microMagnet.position.y;
            return; 
        }

        if (!this.train || this.speed < 0.1) return;

        // --- PHYSICS LOGIC (Now correctly uses dynamic this.trainMass) ---
        if (this.isLevitating) {
            const propulsionAccel = this.propulsionForce / this.trainMass;
            const dragForce = this.dragCoefficient * this.speed * this.speed;
            const dragAccel = dragForce / this.trainMass;
            if (this.speed < this.maxSpeed) {
                this.speed += (propulsionAccel - dragAccel) * deltaTime;
            } else { this.speed = this.maxSpeed; }
        } else {
            this.speed += this.INITIAL_ACCELERATION * deltaTime;
        }
        if (this.speed > this.TAKEOFF_SPEED && !this.isLevitating) {
            this.isLevitating = true;
        }
        const totalTrackLength = this.NUM_TRACK_SEGMENTS * this.TRACK_SEGMENT_LENGTH;
        const wrapBoundary = -this.TRACK_SEGMENT_LENGTH * (this.NUM_TRACK_SEGMENTS - 2); // Corrected boundary
        this.trackSegments.forEach(segment => {
            segment.position.x -= this.speed * deltaTime;
            if (segment.position.x < wrapBoundary) {
                segment.position.x += totalTrackLength;
            }
        });
        this.wheelGroups.forEach(group => {
            const wheelTargetY = this.isLevitating ? 0.5 : -0.1; // Using your corrected 0.5
            group.position.y += (wheelTargetY - group.position.y) * 0.1;
            if (!this.isLevitating) {
                group.rotation.z -= this.speed * deltaTime * 0.4;
            }
        });
        if (this.isLevitating) {
            if (this.rampProgress < 1.0) {
                this.rampProgress += deltaTime / this.levitationRampUpTime;
                this.rampProgress = Math.min(this.rampProgress, 1.0);
            }
            this.levitationStrength = Math.pow(this.rampProgress, 4);
            const currentDamping = this.dampingFactor_Takeoff + (this.dampingFactor_Stable - this.dampingFactor_Takeoff) * this.rampProgress;
            
            // --- 🟢 FIX #5 & #6: Correct Physics ---
            let totalLevitationForce = 0;
            // The total force is now correctly the sum of all magnets
            this.trainMagnets.forEach(magnet => {
                const magnetWorldPos = magnet.getWorldPosition(new THREE.Vector3());
                const distance = magnetWorldPos.y - this.guidewayRepulsionY;
                if (distance > 0.1) {
                    totalLevitationForce += this.levitationForceConstant / (distance * distance);
                } else {
                    totalLevitationForce += this.levitationForceConstant / (0.1 * 0.1); 
                }
            });
            // The gravitational force now correctly uses the dynamic trainMass
            const gravitationalForce = this.trainMass * this.gravity;
            const dampingForce = currentDamping * this.trainVelocity.y;
            const finalLevitationForce = totalLevitationForce * this.levitationStrength;
            const netForceY = finalLevitationForce - gravitationalForce - dampingForce;
            
            // The acceleration now correctly uses the dynamic trainMass
            const accelerationY = netForceY / this.trainMass;
            this.trainVelocity.y += accelerationY * deltaTime;
            this.train.position.y += this.trainVelocity.y * deltaTime;
        } else {
            this.train.position.y = this.WHEELS_DOWN_Y;
            this.trainVelocity.y = 0;
        }
        if (this.train.position.y < this.WHEELS_DOWN_Y) {
            this.train.position.y = this.WHEELS_DOWN_Y;
            this.trainVelocity.y = 0;
        }
        this.cameraTarget.position.copy(this.train.position);
        this._updateCoilVisuals(deltaTime);
    }
    
    _updateStatsPanel() {
        if (!this.statsPanel) return;

        const speedKmh = this.speed * 3.6; 
        const levitationHeight = this.isLevitating ? this.train.position.y - this.WHEELS_DOWN_Y : 0;
        const levitationHeightCm = levitationHeight;
        const vertSpeedCms = this.trainVelocity.y;

        let status = "Stationary";
        if (this.speed > 0.1 && !this.isLevitating) status = "On Wheels";
        if (this.isLevitating && this.rampProgress < 1.0) status = "Taking Off";
        if (this.isLevitating && this.rampProgress >= 1.0) status = "Levitating";

        const n = this.sim.numCabins;
        const revenue = n * this.sim.k_revenue_per_cabin;
        const energyCost = n * this.sim.k_energy_per_cabin;
        const maintCost = n * this.sim.k_maint_per_cabin;
        const infraCost = this.sim.k_infra_per_cabin_sq * (n * n);
        const totalCost = energyCost + maintCost + infraCost;
        const profit = revenue - totalCost;
        const passengers = n * 80;
        const costPerPassenger = (passengers > 0) ? (totalCost / passengers) : 0;

        // --- 🟢 FIX #4: Live Stats Display ---
        // Change the labels/values here as you wish
        const statsHTML = `
            <strong>Status:</strong>     <span>${status}</span><br>
            <strong>Speed:</strong>      <span>${speedKmh.toFixed(1)} km/h</span><br>
            <strong>Lev. Height:</strong><span>${levitationHeight.toFixed(3)} cm</span><br> 
            <strong>Vert. Speed:</strong><span>${vertSpeedCms.toFixed(2)} cm/s</span>
            <hr style="border-color: #555; margin: 8px 0;">
            <strong style="color: #00ffaa;">Cabins:</strong>     <span style="color: #00ffaa;">${n}</span><br>
            <strong style="color: #00ffaa;">Passengers:</strong> <span style="color: #00ffaa;">${passengers}</span><br>
            <strong style="color: #00ffaa;">Profit/Trip:</strong> <span style="color: #00ffaa;">$${Math.round(profit)}</span><br>
            <strong style="color: #00ffaa;">Cost/Pass:</strong>  <span style="color: #00ffaa;">$${costPerPassenger.toFixed(2)}</span>
        `;
        this.statsPanel.innerHTML = statsHTML;
    }
    _updateCoilVisuals(deltaTime) { if (!this.isLevitating) return; this.guidewayCoils.forEach(coil => { let targetColor = this.COLOR_DEFAULT_EMISSIVE; coil.getWorldPosition(this.coilWorldPos); for (const magnet of this.trainMagnets) { magnet.getWorldPosition(this.magnetWorldPos); const dx = this.coilWorldPos.x - this.magnetWorldPos.x; const dz = Math.abs(this.coilWorldPos.z - this.magnetWorldPos.z); if (dz < 1.0) { if (dx > 0 && dx < this.activationDistance) { targetColor = this.COLOR_PULL; break; } if (dx < 0 && dx > -this.activationDistance) { targetColor = this.COLOR_PUSH; break; } } } coil.material.emissive.lerp(targetColor, deltaTime * 10.0); }); }
}