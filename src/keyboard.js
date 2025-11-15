
let KEYBOARD_SIZE_MULTIPLIER = 0.7;
let KEYBOARD_VERTICAL_OFFSET = 6.2;

// Adjust keyboard position and size based on viewport
function updateKeyboardPosition() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const aspectRatio = viewportWidth / viewportHeight;
    
    // Adjust size multiplier based on width
    if (viewportWidth < 480) {
        KEYBOARD_SIZE_MULTIPLIER = 0.35;
    } else if (viewportWidth < 768) {
        KEYBOARD_SIZE_MULTIPLIER = 0.5;
    } else if (viewportWidth < 1024) {
        KEYBOARD_SIZE_MULTIPLIER = 0.6;
    } else {
        KEYBOARD_SIZE_MULTIPLIER = 0.7;
    }
    
    // Calculate offset more smoothly based on viewport height
    // Base offset + adjustment based on aspect ratio
    const baseOffset = 6.2;
    
    if (viewportHeight < 600) {
        // Very small screens
        KEYBOARD_VERTICAL_OFFSET = baseOffset - 1.5;
    } else if (viewportHeight < 800) {
        // Medium screens
        KEYBOARD_VERTICAL_OFFSET = baseOffset - 1.0;
    } else if (aspectRatio < 1.0) {
        // Portrait mode on larger screens
        KEYBOARD_VERTICAL_OFFSET = baseOffset - 0.5;
    } else {
        // Desktop/landscape
        KEYBOARD_VERTICAL_OFFSET = baseOffset;
    }
    
    // If keyboard already exists, rebuild it with new size
    if (keyboardGroup) {
        // Remove old keyboard
        scene.remove(keyboardGroup);
        keyboardInteractives.length = 0;
        
        // Rebuild with new size
        buildKeyboard();
    }
}

function buildKeyboard() {
    keyboardGroup = new THREE.Group();
    let whiteKeyIndices = [0,2,4,5,7,9,11,12,14,16,17,19,21,23];
    let whiteKeyThickness = 0.75 * KEYBOARD_SIZE_MULTIPLIER;
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

        keyGroup.translateX((whiteKeyThickness - whiteKeyBorder) * i);
        keyGroup.translateZ(carouselRadius);
        keyGroup.translateY(KEYBOARD_VERTICAL_OFFSET);

        keyboardGroup.add(keyGroup);
    }

    let blackKeyThickness = 0.45 * KEYBOARD_SIZE_MULTIPLIER;
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

            keyGroup.translateX(whiteKeyThickness / 2 - whiteKeyBorder + (whiteKeyThickness - whiteKeyBorder) * j);
            keyGroup.translateZ(carouselRadius + .00001);
            keyGroup.translateY(KEYBOARD_VERTICAL_OFFSET + (whiteKeyThickness - blackKeyThickness) * 3/2);

            keyboardGroup.add(keyGroup);

        }
    }

    keyboardGroup.children.sort((a, b) => {
        return a.userData.index - b.userData.index;
    });

    keyboardGroup.translateX(-6.5 * (whiteKeyThickness - whiteKeyBorder));

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