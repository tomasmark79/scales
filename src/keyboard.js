
let KEYBOARD_SIZE_MULTIPLIER = 0.7;
let KEYBOARD_VERTICAL_OFFSET = 6.2;
const BASE_SIZE_MULTIPLIER = 0.7;
const BASE_VERTICAL_OFFSET = 6.2;
let currentScaleMultiplier = 1.0;

// Calculate scale multiplier based on viewport
function calculateScaleMultiplier() {
    const viewportWidth = window.innerWidth;
    const minWidth = 320;
    const maxWidth = 1200;
    const minScale = 0.75;  // Increased from 0.45 to make piano roll bigger on mobile
    const maxScale = 1.0;
    
    return minScale + (maxScale - minScale) * 
        Math.min(1, Math.max(0, (viewportWidth - minWidth) / (maxWidth - minWidth)));
}

// Adjust keyboard position and size based on viewport
function updateKeyboardPosition() {
    console.log('updateKeyboardPosition() called');
    const oldScale = currentScaleMultiplier;
    currentScaleMultiplier = calculateScaleMultiplier();
    console.log('oldScale:', oldScale, 'newScale:', currentScaleMultiplier);
    KEYBOARD_VERTICAL_OFFSET = BASE_VERTICAL_OFFSET;
    
    // Only rebuild if scale changed significantly (more than 1%)
    const scaleChange = Math.abs(currentScaleMultiplier - oldScale);
    const threshold = 0.01;
    
    if (keyboardGroup && scaleChange > threshold) {
        console.log('Rebuilding keyboard - scale change:', scaleChange);
        // Remove old keyboard
        scene.remove(keyboardGroup);
        keyboardInteractives = [];
        
        // Rebuild with new scale
        buildKeyboard();
        
        // Update display to restore colors
        if (typeof displayKeyboard === 'function' && masterGroup && masterGroup.children.length > 0) {
            displayKeyboard();
        }
    } else {
        console.log('Scale change too small, skipping rebuild:', scaleChange);
    }
}

function buildKeyboard() {
    console.log('buildKeyboard() called - currentScaleMultiplier:', currentScaleMultiplier);
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
            color: 0x666666
        }));

        wkoMesh.translateZ(-.0000001);
        
        let wkiMesh = new THREE.Mesh(whiteKeyInner, new THREE.MeshBasicMaterial({
            color: 0x1f262f
        }));
        wkiMesh.userData.noteIndex = keyGroup.userData.index;
        keyboardInteractives.push(wkiMesh);
        
        keyGroup.add(wkiMesh, wkoMesh);

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
                color: 0xaaaaaa  // Lighter gray for better visibility on mobile
            }));
    
            bkoMesh.translateZ(-.0000001);
            
            let bkiMesh = new THREE.Mesh(blackKeyInner, new THREE.MeshBasicMaterial({
                color: 0x2a3139  // Slightly lighter than 0x1f262f so black keys are visible
            }));
            bkiMesh.userData.noteIndex = keyGroup.userData.index;
            keyboardInteractives.push(bkiMesh);

            keyGroup.add(bkiMesh, bkoMesh);

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

    // Debug: log number of keys
    console.log('Keyboard built: ' + keyboardGroup.children.length + ' keys total (14 white + 10 black = 24)');

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
    console.log('initKeyboard() called');
    // Calculate initial scale before building keyboard
    currentScaleMultiplier = calculateScaleMultiplier();
    buildKeyboard();
}

function displayKeyboard() {

    let notes = masterGroup.children[scaleshift].userData.notes;

    let keys = keyboardGroup.children;

    let isRoot = true;

    for (let i = 0; i < keys.length; i++) {
        
        if(i < pitchshift || i >= pitchshift + 12 || notes[i - pitchshift] == false) {
            keys[i].children[0].material.color = new THREE.Color(0x2a3139);  // Slightly lighter for visibility
        } else {

            //if(isRoot || i === pitchshift + 12) {
            if(isRoot) {
                // root is gold
                keys[i].children[0].material.color = new THREE.Color(0xffd830);
            } else {
                keys[i].children[0].material.color = new THREE.Color(0x00e19e);
            }

            // after the first assignment switch isRoot
            isRoot = false;
        };
        
        // Mark material as needing update for mobile rendering
        keys[i].children[0].material.needsUpdate = true;
        
    }

}

function playKeyboardNote(n) {

    if(!keyboardGroup || !keyboardGroup.children.length) {
        return;
    }

    let keys = keyboardGroup.children;
    let keyIndex = n + pitchshift;

    if(!keys[keyIndex] || !keys[keyIndex].children.length) {
        return;
    }

    let key = keys[keyIndex].children[0];

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
    const baseColor = new THREE.Color(0x2a3139);  // Match the black key color

    if(!masterGroup || !masterGroup.children.length) {
        return baseColor;
    }

    const currentScale = masterGroup.children[scaleshift];
    const notes = currentScale && currentScale.userData && currentScale.userData.notes;

    if(!Array.isArray(notes)) {
        return baseColor;
    }

    const absoluteIndex = relativeNoteIndex + pitchshift;

    if(absoluteIndex < pitchshift || absoluteIndex >= pitchshift + notes.length) {
        return baseColor;
    }

    const scaleIndex = absoluteIndex - pitchshift;

    if(!notes[scaleIndex]) {
        return baseColor;
    }

    if(scaleIndex === 0) {
        return new THREE.Color(0xffd830);
    }

    return new THREE.Color(0x00e19e);
}