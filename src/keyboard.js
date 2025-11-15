
let KEYBOARD_SIZE_MULTIPLIER = 0.7;
let KEYBOARD_VERTICAL_OFFSET = 6.2;
const BASE_SIZE_MULTIPLIER = 0.7;
const BASE_VERTICAL_OFFSET = 6.2;
let currentScaleMultiplier = 1.0;

// Adjust keyboard position and size based on viewport
function updateKeyboardPosition() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const aspectRatio = viewportWidth / viewportHeight;
    
    // Calculate scale multiplier smoothly based on width (0.5 at 480px, 1.0 at 1200px+)
    const minWidth = 320;
    const maxWidth = 1200;
    const minScale = 0.45;
    const maxScale = 1.0;
    
    currentScaleMultiplier = minScale + (maxScale - minScale) * 
        Math.min(1, Math.max(0, (viewportWidth - minWidth) / (maxWidth - minWidth)));
    
    // Keep vertical offset constant - don't adjust it
    // The perspective will handle the visual positioning
    KEYBOARD_VERTICAL_OFFSET = BASE_VERTICAL_OFFSET;
    
    // If keyboard already exists, just scale it
    if (keyboardGroup) {
        keyboardGroup.scale.set(currentScaleMultiplier, currentScaleMultiplier, 1);
        // Keep Y position constant
        keyboardGroup.position.y = KEYBOARD_VERTICAL_OFFSET;
        
        // Compensate X position for scale - divide by scale to keep visual position constant
        const whiteKeyThickness = 0.75 * BASE_SIZE_MULTIPLIER;
        const whiteKeyBorder = whiteKeyThickness / 7;
        const centerOffset = -6.5 * (whiteKeyThickness - whiteKeyBorder);
        keyboardGroup.position.x = centerOffset / currentScaleMultiplier;
        
        // Update display if needed
        if (typeof displayKeyboard === 'function' && masterGroup && masterGroup.children.length > 0) {
            displayKeyboard();
        }
    }
}

function buildKeyboard() {
    keyboardGroup = new THREE.Group();
    let whiteKeyIndices = [0,2,4,5,7,9,11,12,14,16,17,19,21,23];
    let whiteKeyThickness = 0.75 * BASE_SIZE_MULTIPLIER;
    let whiteKeyBorder = whiteKeyThickness / 7;

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

        // Use position instead of translate for X coordinate
        keyGroup.position.x = (whiteKeyThickness - whiteKeyBorder) * i;
        keyGroup.translateZ(carouselRadius);

        keyboardGroup.add(keyGroup);
    }

    let blackKeyThickness = 0.45 * BASE_SIZE_MULTIPLIER;
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
                color: 0x666666
            }));
    
            bkoMesh.translateZ(-.0000001);
            
            let bkiMesh = new THREE.Mesh(blackKeyInner, new THREE.MeshBasicMaterial({
                color: 0x1f262f
            }));
            bkiMesh.userData.noteIndex = keyGroup.userData.index;
            keyboardInteractives.push(bkiMesh);

            keyGroup.add(bkiMesh, bkoMesh);

            // Use position instead of translate for X coordinate
            keyGroup.position.x = whiteKeyThickness / 2 - whiteKeyBorder + (whiteKeyThickness - whiteKeyBorder) * j;
            keyGroup.translateZ(carouselRadius + .00001);
            keyGroup.translateY((whiteKeyThickness - blackKeyThickness) * 3/2);

            keyboardGroup.add(keyGroup);

        }
    }

    keyboardGroup.children.sort((a, b) => {
        return a.userData.index - b.userData.index;
    });

    // Set horizontal position (use position.x instead of translateX to avoid scale issues)
    const centerOffset = -6.5 * (whiteKeyThickness - whiteKeyBorder);
    keyboardGroup.position.x = centerOffset;
    
    // Set initial Y position
    keyboardGroup.position.y = KEYBOARD_VERTICAL_OFFSET;

    scene.add(keyboardGroup);
    
    // Update keyboard display if masterGroup exists
    if (typeof displayKeyboard === 'function' && masterGroup && masterGroup.children.length > 0) {
        displayKeyboard();
    }
}

initKeyboard();

function initKeyboard() {

    updateKeyboardPosition();
    buildKeyboard();

}

function displayKeyboard() {

    let notes = masterGroup.children[scaleshift].userData.notes;

    let keys = keyboardGroup.children;

    let isRoot = true;

    for (let i = 0; i < keys.length; i++) {
        
        if(i < pitchshift || i >= pitchshift + 12 || notes[i - pitchshift] == false) {
            keys[i].children[0].material.color = new THREE.Color(0x1f262f);
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
    const baseColor = new THREE.Color(0x1f262f);

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