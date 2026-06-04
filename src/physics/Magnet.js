// In: src/physics/Magnet.js

import * as THREE from 'three';

export class Magnet extends THREE.Object3D {
    /**
     * @param {Array<Object>} segments - Array of objects like { start: Vector3, end: Vector3 } representing current flow.
     * @param {number} current - The current in Amperes.
     */
    constructor(segments, current = 10.0) {
        super();
        this.segments = segments;
        this.current = current;
    }
}