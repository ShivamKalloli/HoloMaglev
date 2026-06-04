// In: src/physics/FieldSolver.js

import * as THREE from 'three';

export class FieldSolver {
    /**
     * @param {Array<Magnet>} allMagnets - A list of all magnet objects in the scene.
     */
    constructor(allMagnets = []) {
        this.magnets = allMagnets;
        // The magnetic constant (μ₀) divided by 4π
        this.B_CONSTANT = 1e-7; // This is (4π * 1e-7) / 4π

        // Helper vectors to avoid creating new ones in the loop (performance)
        this.dl = new THREE.Vector3();
        this.r = new THREE.Vector3();
        this.r_hat = new THREE.Vector3();
        this.dl_cross_r_hat = new THREE.Vector3();
    }

    /**
     * The core of our physics engine.
     * Calculates the B-field vector at a single point in world space.
     * @param {THREE.Vector3} point - The point in space to calculate the field at.
     * @returns {THREE.Vector3} The magnetic field vector B.
     */
    calculateFieldAtPoint(point) {
        const totalField = new THREE.Vector3(0, 0, 0);

        for (const magnet of this.magnets) {
            // Magnets can be moved, so we need to get their world position
            const worldPosition = magnet.getWorldPosition(new THREE.Vector3());

            for (const segment of magnet.segments) {
                // Get the start and end points of the current-carrying wire segment in world space
                const start = segment.start.clone().add(worldPosition);
                const end = segment.end.clone().add(worldPosition);

                // This is the implementation of the Biot-Savart Law for a finite wire
                const fieldFromSegment = this._calculateFieldFromSegment(point, start, end, magnet.current);
                totalField.add(fieldFromSegment);
            }
        }

        return totalField;
    }
    
    /**
     * Calculates the magnetic field from a single, straight wire segment using Biot-Savart Law.
     * This uses vector math to be robust.
     * @private
     */
    _calculateFieldFromSegment(point, start, end, current) {
        // Vector representing the wire segment
        this.dl.subVectors(end, start);
        const segmentLength = this.dl.length();
        if (segmentLength === 0) return new THREE.Vector3(0,0,0);

        // Vector from the start of the segment to the point
        const r1 = new THREE.Vector3().subVectors(point, start);
        // Vector from the end of the segment to the point
        const r2 = new THREE.Vector3().subVectors(point, end);

        // Perpendicular distance (rho) from the point to the line defined by the segment
        const r1_cross_dl = new THREE.Vector3().crossVectors(r1, this.dl);
        const rho = r1_cross_dl.length() / segmentLength;
        if (rho === 0) return new THREE.Vector3(0,0,0);

        // The direction of the magnetic field is perpendicular to the plane
        // formed by the wire and the point.
        const B_direction = r1_cross_dl.normalize();
        
        // Calculate angles using dot products
        const cos_theta1 = r1.dot(this.dl) / (r1.length() * segmentLength);
        const cos_theta2 = r2.dot(this.dl.clone().negate()) / (r2.length() * segmentLength);

        // Magnitude of the B field for a finite wire
        const B_magnitude = (this.B_CONSTANT * current / rho) * (cos_theta1 + cos_theta2);

        return B_direction.multiplyScalar(B_magnitude);
    }
}