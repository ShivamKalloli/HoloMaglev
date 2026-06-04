// In: src/scenes/RealisticMaglevScene.js

import * as THREE from 'three';
import { Magnet } from '../physics/Magnet.js';
import { FieldSolver } from '../physics/FieldSolver.js';

export class RealisticMaglevScene extends THREE.Scene {
    constructor() {
        super();
        this.background = new THREE.Color(0x000000);

        this.params = {
            current: 50000,
            propulsionCurrent: 10000,
            showFields: true,
            particleSpeed: 0.3,
            particleSize: 4.0,
            gravity: -9.8, // Using a negative value for standard physics
        };
        this.physics = {
            trainMass: 50.0,
            velocity: new THREE.Vector3(),
            dampingFactor: 0.98,
        };

        // State Management for the Two Worlds
        this.currentViewMode = 'CONCEPTUAL';
        this.ZOOM_THRESHOLD = 15.0;

        this.cameraTarget = new THREE.Object3D();
        this.add(this.cameraTarget);
        
        // --- THE FIX IS HERE: The function call now has a corresponding definition ---
        this._setupLighting();
        this.initModels();
        
        this.fieldSolver = new FieldSolver(this.allMagnets);
    }
    
    // --- THIS IS THE MISSING FUNCTION ---
    _setupLighting() {
        this.add(new THREE.AmbientLight(0xffffff, 0.7));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        this.add(directionalLight);
    }
    
    // The main update loop is now a router
    update(deltaTime, zoomLevel) {
        if (!this.conceptualTrain || !this.physicsTrain) return;

        this._updateViewMode(zoomLevel);

        if (this.currentViewMode === 'CONCEPTUAL') {
            this._updateConceptualView(deltaTime);
        } else { // 'PHYSICS'
            this._updatePhysicsView(deltaTime);
        }
    }

    // Mode Switching Logic
    _updateViewMode(zoomLevel) {
        if (zoomLevel < this.ZOOM_THRESHOLD && this.currentViewMode !== 'PHYSICS') {
            this._switchToPhysicsView();
        } else if (zoomLevel >= this.ZOOM_THRESHOLD && this.currentViewMode !== 'CONCEPTUAL') {
            this._switchToConceptualView();
        }
    }

    toggleViewMode() {
        if (this.currentViewMode === 'CONCEPTUAL') {
            this._switchToPhysicsView();
        } else {
            this._switchToConceptualView();
        }
    }

    _switchToPhysicsView() {
        this.currentViewMode = 'PHYSICS';
        this.conceptualGroup.visible = false;
        this.physicsGroup.visible = true;
        this.physicsTrain.position.copy(this.conceptualTrain.position);
        this.physics.velocity.set(0,0,0);
    }

    _switchToConceptualView() {
        this.currentViewMode = 'CONCEPTUAL';
        this.conceptualGroup.visible = true;
        this.physicsGroup.visible = false;
        this.conceptualTrain.position.copy(this.physicsTrain.position);
    }
    
    // Logic for the "Conceptual" (Zoomed-Out) View
    _updateConceptualView(deltaTime) {
        this.conceptualTrain.position.x += 4 * deltaTime;
        if (this.conceptualTrain.position.x > 20) {
            this.conceptualTrain.position.x = -20;
        }
        this.cameraTarget.position.copy(this.conceptualTrain.position);
    }

    // Logic for the "Physics" (Zoomed-In) View
    _updatePhysicsView(deltaTime) {
        const gravityForce = new THREE.Vector3(0, this.params.gravity * this.physics.trainMass, 0);
        const totalForce = this._calculateForces();
        totalForce.add(gravityForce);
        
        const acceleration = totalForce.divideScalar(this.physics.trainMass);
        this.physics.velocity.add(acceleration.multiplyScalar(deltaTime));
        this.physics.velocity.multiplyScalar(this.physics.dampingFactor);
        this.physicsTrain.position.add(this.physics.velocity.clone().multiplyScalar(deltaTime));

        this.cameraTarget.position.copy(this.physicsTrain.position);
        this.generateFieldLines();
    }

    _calculateForces() {
        const totalForce = new THREE.Vector3();
        // Placeholder for real physics calculation
        const height = this.physicsTrain.position.y > 0.1 ? this.physicsTrain.position.y : 0.1;
        const levitationForceY = (this.params.current * 5) / (height * height);
        totalForce.y = levitationForceY;
        return totalForce;
    }
    
    initModels() {
        this.conceptualGroup = new THREE.Group();
        this.add(this.conceptualGroup);
        this.physicsGroup = new THREE.Group();
        this.add(this.physicsGroup);

        this.allMagnets = [];
        
        this.conceptualTrain = this._createConceptualTrain();
        this.conceptualGroup.add(this.conceptualTrain);
        
        this.physicsTrain = this._createPhysicsTrain();
        this.physicsGroup.add(this.physicsTrain);

        this.track = this._createTrack();
        this.add(this.track);
        
        this._switchToConceptualView();
        this.conceptualTrain.position.set(-15, 1.5, 0);
        this.physicsTrain.position.copy(this.conceptualTrain.position);
    }

    _createConceptualTrain() {
        const group = new THREE.Group();
        const bodyGeom = new THREE.BoxGeometry(4, 1, 1.8); 
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x88aaff, roughness: 0.2, metalness: 0.8 });
        group.add(new THREE.Mesh(bodyGeom, bodyMat));
        return group;
    }

    _createPhysicsTrain() {
        const group = new THREE.Group();
        const bodyGeom = new THREE.BoxGeometry(4, 1, 1.8); 
        const bodyMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });
        group.add(new THREE.Mesh(bodyGeom, bodyMat));

        const levSegs = [ { start: new THREE.Vector3(-1.8, -0.6, 0), end: new THREE.Vector3(1.8, -0.6, 0) } ];
        const trainLevMagnet = new Magnet(levSegs, this.params.current);
        this.allMagnets.push(trainLevMagnet);
        group.add(trainLevMagnet);

        this.fieldLinesGroup = new THREE.Group();
        group.add(this.fieldLinesGroup);
        return group;
    }

    _createTrack() {
        const track = new THREE.Group();
        const baseGeom = new THREE.BoxGeometry(40, 0.2, 3);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.4 });
        const baseMesh = new THREE.Mesh(baseGeom, baseMat);
        baseMesh.position.y = -0.1;
        track.add(baseMesh);

        const levSeg = [{ start: new THREE.Vector3(-20, 0, 0), end: new THREE.Vector3(20, 0, 0) }];
        const trackLevMagnet = new Magnet(levSeg, -this.params.current);
        this.allMagnets.push(trackLevMagnet);
        track.add(trackLevMagnet);
        return track;
    }

    generateFieldLines() {
        // Placeholder, will be filled with the particle shader logic next.
    }
}