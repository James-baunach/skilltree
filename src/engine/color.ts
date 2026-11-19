// The map is a stylised 2D UI, so colours are authored and blended as plain sRGB values.
// This module must be imported before any THREE.Color is created (Engine.ts imports it first).
import { ColorManagement } from 'three';

ColorManagement.enabled = false;
