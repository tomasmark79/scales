
let KEYBOARD_SIZE_MULTIPLIER = 0.7;
let KEYBOARD_VERTICAL_OFFSET = 6.2;
const BASE_SIZE_MULTIPLIER = 0.7;
const BASE_VERTICAL_OFFSET = 6.2;
const MOBILE_VERTICAL_OFFSET = 2.5;  // Lower position for mobile (smaller number = lower on screen)
let currentScaleMultiplier = 1.0;

// Calculate scale multiplier based on viewport
function calculateScaleMultiplier() {
    const viewportWidth = window.innerWidth;
    const minWidth = 320;
    const maxWidth = 1200;
    const minScale = 1.2;  // Increased to make keyboard much bigger on mobile
    const maxScale = 1.0;
    
    return minScale + (maxScale - minScale) * 
        Math.min(1, Math.max(0, (viewportWidth - minWidth) / (maxWidth - minWidth)));
}

// Calculate vertical offset based on viewport (lower on mobile)
function calculateVerticalOffset() {
    const viewportWidth = window.innerWidth;
    const mobileBreakpoint = 768;
    
    // On mobile (width < 768), use lower offset; on desktop use base offset
    if (viewportWidth < mobileBreakpoint) {
        return MOBILE_VERTICAL_OFFSET;
    }
    return BASE_VERTICAL_OFFSET;
}

// Update carousel (masterGroup) position for responsive design
function updateCarouselPosition() {
    if (!masterGroup) return;
    
    const viewportWidth = window.innerWidth;
    const mobileBreakpoint = 768;
    
    // On mobile, move carousel down (negative Y value)
    if (viewportWidth < mobileBreakpoint) {
        masterGroup.position.y = -8;  // Move down on mobile
    } else {
        masterGroup.position.y = 0;   // Default position on desktop
    }
}

// Adjust keyboard position and size based on viewport
function updateKeyboardPosition() {
    const oldScale = currentScaleMultiplier;
    currentScaleMultiplier = calculateScaleMultiplier();
    KEYBOARD_VERTICAL_OFFSET = calculateVerticalOffset();
    
    // Update carousel position based on viewport
    updateCarouselPosition();
    
    // Only rebuild if scale changed significantly (more than 1%)
    const scaleChange = Math.abs(currentScaleMultiplier - oldScale);
    const threshold = 0.01;
    
    if (keyboardGroup && scaleChange > threshold) {
        // Remove old keyboard
        scene.remove(keyboardGroup);
        keyboardInteractives = [];
        
        // Rebuild with new scale
        buildKeyboard();
        
        // Update display to restore colors
        if (typeof displayKeyboard === 'function' && masterGroup && masterGroup.children.length > 0) {
            displayKeyboard();
        }
    }
}

function buildKeyboard() {
    keyboardGroup = new THREE.Group();
    let whiteKeyIndices = [0,2,4,5,7,9,11,12,14,16,17,19,21,23];
    
    // Apply scale multiplier directly to dimensions instead of using group.scale
    let whiteKeyThickness = 0.75 * BASE_SIZE_MULTIPLIER * currentScaleMultiplier;
    let whiteKeyBorder = whiteKeyThickness / 7;
    let whiteKeyWidth = whiteKeyThickness - whiteKeyBorder;

    // Calculate offset to center the keyboard - 14 keys means 13 intervals
    const keyboardCenterOffset = -6.5 * whiteKeyWidth; // Half of 13 intervals

    for (let i = 0; i < 14; i++) {
        let keyGroup = new THREE.Group();
        keyGroup.userData.index = whiteKeyIndices.shift();

        let whiteKeyOutline = new THREE.BoxBufferGeometry(whiteKeyThickness, whiteKeyThickness * 3, 0.01);
        let whiteKeyInner = new THREE.BoxBufferGeometry(whiteKeyThickness - whiteKeyBorder, whiteKeyThickness * 3 - whiteKeyBorder, 0.01);

        let wkoMesh = new THREE.Mesh(whiteKeyOutline, new THREE.MeshBasicMaterial({
            color: 0x666666,
            depthWrite: false  // Match black keys
        }));

        wkoMesh.translateZ(-.0000001);
        
        let wkiMesh = new THREE.Mesh(whiteKeyInner, new THREE.MeshBasicMaterial({
            color: 0x1f262f
        }));
        wkiMesh.userData.noteIndex = keyGroup.userData.index;
        wkiMesh.userData.isInner = true;  // Mark as inner mesh
        keyboardInteractives.push(wkiMesh);
        
        keyGroup.add(wkoMesh, wkiMesh);  // Outline first, inner second - CONSISTENT with black keys

        // Position keys centered around 0
        keyGroup.position.x = keyboardCenterOffset + whiteKeyWidth * i;
        keyGroup.translateZ(carouselRadius);

        keyboardGroup.add(keyGroup);
    }

    let blackKeyThickness = 0.45 * BASE_SIZE_MULTIPLIER * currentScaleMultiplier;
    let blackKeyIndices = [1,3,6,8,10,13,15,18,20,22];
    let blackKeyBorder = blackKeyThickness / 7;

    for (let j = 0; j < 13; j++) {

        // skip E-F and B-C intervals
        if(j !== 2 && j !== 6 && j != 9) {
            let keyGroup = new THREE.Group();
            keyGroup.userData.index = blackKeyIndices.shift();

            let blackKeyOutline = new THREE.BoxBufferGeometry(blackKeyThickness, blackKeyThickness * 3, 0.01);
            let blackKeyInner = new THREE.BoxBufferGeometry(blackKeyThickness - blackKeyBorder, blackKeyThickness * 3 - blackKeyBorder, 0.01);

            let bkoMesh = new THREE.Mesh(blackKeyOutline, new THREE.MeshBasicMaterial({
                color: 0x666666,
                side: THREE.FrontSide,
                depthTest: true,
                depthWrite: false,  // Don't write to depth buffer
                polygonOffset: true,
                polygonOffsetFactor: -1,
                polygonOffsetUnits: -1
            }));
            
            let bkiMesh = new THREE.Mesh(blackKeyInner, new THREE.MeshBasicMaterial({
                color: 0x2a3139,
                side: THREE.FrontSide,
                depthTest: true,
                depthWrite: true,
                polygonOffset: false  // Inner mesh renders normally
            }));
            bkiMesh.userData.noteIndex = keyGroup.userData.index;
            bkiMesh.userData.isInner = true;  // Mark as inner mesh
            keyboardInteractives.push(bkiMesh);

            keyGroup.add(bkoMesh, bkiMesh);  // Add outline first, then inner on top

            // Position black keys centered around 0 (same offset as white keys)
            keyGroup.position.x = keyboardCenterOffset + whiteKeyThickness / 2 - whiteKeyBorder / 2 + whiteKeyWidth * j;
            keyGroup.translateZ(carouselRadius + 0.02);
            keyGroup.translateY((whiteKeyThickness - blackKeyThickness) * 3/2 - whiteKeyBorder / 2);

            keyboardGroup.add(keyGroup);

        }
    }

    keyboardGroup.children.sort((a, b) => {
        return a.userData.index - b.userData.index;
    });

    // Don't apply scale - dimensions are already scaled
    // Just set position
    keyboardGroup.position.x = 0;
    keyboardGroup.position.y = KEYBOARD_VERTICAL_OFFSET;

    scene.add(keyboardGroup);
    
    // Update keyboard display if masterGroup exists
    if (typeof displayKeyboard === 'function' && masterGroup && masterGroup.children.length > 0) {
        displayKeyboard();
    }
}

initKeyboard();

function initKeyboard() {
    // Calculate initial scale before building keyboard
    currentScaleMultiplier = calculateScaleMultiplier();
    buildKeyboard();
}

function displayKeyboard() {

    let notes = masterGroup.children[scaleshift].userData.notes;

    let keys = keyboardGroup.children;

    let isRoot = true;

    for (let i = 0; i < keys.length; i++) {
        
        // Find the inner mesh (the one with isInner flag)
        // Structure is now: outline[0], inner[1] for ALL keys
        let innerMesh = keys[i].children.find(child => child.userData && child.userData.isInner);
        if (!innerMesh) {
            innerMesh = keys[i].children[1];  // Inner is always at index 1 now
        }
        
        if (!innerMesh || !innerMesh.material) {
            continue;
        }
        
        if(i < pitchshift || i >= pitchshift + 12 || notes[i - pitchshift] == false) {
            innerMesh.material.color = new THREE.Color(0x2a3139);
        } else {

            //if(isRoot || i === pitchshift + 12) {
            if(isRoot) {
                // root is gold
                innerMesh.material.color = new THREE.Color(0xffd830);
            } else {
                innerMesh.material.color = new THREE.Color(0x00e19e);
            }

            // after the first assignment switch isRoot
            isRoot = false;
        };
        
        // Mark material as needing update for mobile rendering
        innerMesh.material.needsUpdate = true;
        
    }

}

function playKeyboardNote(n) {

    if(!keyboardGroup || !keyboardGroup.children.length) {
        return;
    }

    let keys = keyboardGroup.children;
    let keyIndex = n + pitchshift;

    if(!keys[keyIndex] || keys[keyIndex].children.length < 2) {
        return;
    }

    // Get inner mesh (now at index 1 for all keys)
    let key = keys[keyIndex].children.find(child => child.userData && child.userData.isInner);
    if (!key) {
        key = keys[keyIndex].children[1];  // Fallback to index 1
    }
    
    if (!key || !key.material) {
        return;
    }

    let originalColor = getKeyBaseColor(n);

    // change to white
    key.material.color = new THREE.Color(0xffffff);

    // tween back to original color
    let t = new TWEEN.Tween(key.material.color);
    t.to({r: originalColor.r, g: originalColor.g, b: originalColor.b}, 1800)
    .easing(TWEEN.Easing.Exponential.Out)
    .onComplete(() => {
        tweens.delete(t);
    })
    .start();

    tweens.add(t);

}

function getKeyBaseColor(relativeNoteIndex) {
    const baseColor = new THREE.Color(0x2a3139);  // Default gray for non-scale notes

    if(!masterGroup || !masterGroup.children.length) {
        return baseColor;
    }

    const currentScale = masterGroup.children[scaleshift];
    const notes = currentScale && currentScale.userData && currentScale.userData.notes;

    if(!Array.isArray(notes) || relativeNoteIndex < 0 || relativeNoteIndex >= notes.length) {
        return baseColor;
    }

    // Check if this note is in the scale
    if(!notes[relativeNoteIndex]) {
        return baseColor;
    }

    // First note in scale is gold (root)
    if(relativeNoteIndex === 0) {
        return new THREE.Color(0xffd830);  // Gold
    }

    // Other scale notes are green
    return new THREE.Color(0x00e19e);  // Green
}