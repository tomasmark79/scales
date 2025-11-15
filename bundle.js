
// track screen dimensions
let width = window.innerWidth;
let height = window.innerHeight;

// basic THREE.js objects
let scene, camera, renderer;
let masterGroup, keyboardGroup;
let carouselRadius;
let dataLength;
let categorySet;
let noteRadius;

// required for interactivity
let raycaster;
let highlights = [], activeHighlight = null;
let keyboardInteractives = [];
let panels = [], activePanel = null;
let mouse = new THREE.Vector2();
let isMouseDown = false;
let pitchshift = 0;
let scaleshift = 0;
let noteLabelType = 'sharp';
let intervalStyle = 'arc';  // arc | pie | gear ...
let noteLabels = {
    sharp: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    flat: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
    elements: []
};
let pageElements = {
    name: null,
    category: null,
    description: null,
    genre: null,
    usage: null
}
let midiAccess = null;
let midiEnabled = false;
let midiInputs = new Map();
let midiButtonEl = null;
let midiStatusEl = null;
let midiFilterEl = null;
let midiFilterScaleOnly = true;
let scalesData = null;

// colors
let green = '#00e19e';
let gold = '#ffd830';
let grey = '#666666';

// required for animation
let tweens = new Set([]);
let carouselRot = {amount: 0};
let flagUpdate = true;

// required for audio
let audioCtx;
let audioBuffers = [];

init();
loadAudio();
loadData('./scales.json', (data) => {
    scalesData = data;
    visualize(data).then(() => {
        console.log(scene);
    });
});
initDocument();

function initDocument() {

    window.addEventListener('resize', resize, false);
    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mouseleave', onMouseLeave);

    document.onkeydown = (e) => {
    
        e = e || window.event;

        const activeElement = document.activeElement;
        const scaleSelect = document.getElementById('scale-select');
        const isScaleSelectFocused = scaleSelect && activeElement === scaleSelect;
        const isArrowKey = e.keyCode >= 37 && e.keyCode <= 40;

        if (isScaleSelectFocused && isArrowKey) {
            return;
        }

        if (e.keyCode == '37') {
            rotateCarousel('left');
        }
        else if (e.keyCode == '39') {
            rotateCarousel('right');
        }
        else if (e.keyCode == '38') {
            // Arrow Up - increase pitch
            changePitch(1);
        }
        else if (e.keyCode == '40') {
            // Arrow Down - decrease pitch
            changePitch(-1);
        }
    
    }

    document.getElementById('flat').onclick = () => {
        if(noteLabelType != 'flat') {
            noteLabelType = 'flat';
            createLabels(carouselRadius, pitchshift);
            createNoteSelector();
        }
    }

    document.getElementById('sharp').onclick = () => {
        if(noteLabelType != 'sharp') {
            noteLabelType = 'sharp';
            createLabels(carouselRadius, pitchshift);
            createNoteSelector();
        }
    }

    var intStyleControls = document.getElementById('interval-styles')
                                   .getElementsByTagName('a');
    for (let i = 0; i < intStyleControls.length; i++) {
      var styleControl = intStyleControls[i];
      styleControl.onclick = (evt) => {
        newStyle = evt.target.getAttribute('id');
        updateIntervalStyle(newStyle);
      }
    }

    // Create note selector buttons
    createNoteSelector();

    setupMIDISupport();

}

function createNoteSelector() {
    const container = document.getElementById('note-selector');
    container.innerHTML = ''; // Clear existing buttons
    
    const notes = noteLabelType === 'sharp' ? noteLabels.sharp : noteLabels.flat;
    
    notes.forEach((note, index) => {
        const btn = document.createElement('div');
        btn.className = 'note-btn';
        btn.textContent = note;
        btn.dataset.pitch = index;
        
        if (index === pitchshift) {
            btn.classList.add('active');
        }
        
        btn.onclick = () => {
            setPitch(index);
        };
        
        container.appendChild(btn);
    });
}

function getScaleNoteCount(scale) {
    if (scale && Array.isArray(scale.intervals) && scale.intervals.length > 0) {
        return scale.intervals.length;
    }
    if (scale && Array.isArray(scale.notes) && scale.notes.length > 0) {
        return scale.notes.length;
    }
    return null;
}

function formatToneCount(count) {
    if (!Number.isFinite(count) || count <= 0) {
        return 'neznámý počet tónů';
    }
    if (count === 1) {
        return '1 tón';
    }
    if (count >= 2 && count <= 4) {
        return `${count} tóny`;
    }
    return `${count} tónů`;
}

function buildScaleOptionLabel(scale) {
    const count = getScaleNoteCount(scale);
    return `${scale.name} — ${formatToneCount(count)}`;
}

function buildScaleOptionTooltip(scale) {
    return buildScaleOptionLabel(scale);
}

function createScaleSelector(scaleData = []) {
    const selectEl = document.getElementById('scale-select');
    if (!selectEl) {
        return;
    }

    selectEl.innerHTML = '';

    scaleData.forEach((scale, index) => {
        const option = document.createElement('option');
        option.value = index;
        const label = buildScaleOptionLabel(scale);
        option.textContent = label;
        option.title = buildScaleOptionTooltip(scale);
        selectEl.appendChild(option);
    });

    selectEl.value = scaleshift;

    selectEl.onchange = (event) => {
        const selectedIndex = parseInt(event.target.value, 10);
        if (!Number.isNaN(selectedIndex)) {
            setScaleIndex(selectedIndex, true);
        }
    };
}

function updateScaleSelectorValue() {
    const selectEl = document.getElementById('scale-select');
    if (selectEl && selectEl.value !== String(scaleshift)) {
        selectEl.value = scaleshift;
    }
}

function setPitch(newPitch) {
    pitchshift = newPitch;
    
    // Update note selector buttons
    const buttons = document.querySelectorAll('.note-btn');
    buttons.forEach((btn, index) => {
        if (index === pitchshift) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    createLabels(carouselRadius, pitchshift);
    displayKeyboard();
}

function init() {
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1f262f);

    const DPR = (window.devicePixelRatio) ? window.devicePixelRatio : 1;
    renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
    renderer.setPixelRatio(DPR);
    renderer.setSize(width, height);
    document.getElementById('canvas').appendChild(renderer.domElement);

    const clock = new THREE.Clock();

    // @TODO: make the radius responsive to the number of scales in the data
    carouselRadius = 100;

    let aspect = width/height;
    camera = new THREE.PerspectiveCamera(60, aspect, 1, carouselRadius/2);
    camera.position.set(0, 0, carouselRadius * 1.2);
    camera.updateMatrixWorld();

    raycaster = new THREE.Raycaster();
    AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    masterGroup = new THREE.Group();

}

function loadData(src, callback){

    let request = new XMLHttpRequest();
    request.open('GET', src);
    request.onload = () => {
        let data = JSON.parse(request.response);
        dataLength = data.length;
        scene.userData.data = data;
        callback(data);
    }
    request.send();
}

function loadAudio(){
    for(let i = 0; i < 23; i++) {
        let url = `./audio/${i+1}.mp3`;
        let request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';
        request.onload = () => {
            audioCtx.decodeAudioData(request.response, function(buffer) {
                audioBuffers[i] = buffer;
            }, (err) => {
                console.error(err);
            });
          }
        request.send();
    }
}

function animate(time){
    window.requestAnimationFrame(animate);
    render(time);
}

function render(time){

    tweens.forEach((t) => {
        t.update(time);
    })

    masterGroup.rotation.y = carouselRot.amount;

    raycaster.setFromCamera(mouse, camera);

    // note interactivity

    let intersects = raycaster.intersectObjects(highlights);

    if(intersects.length > 0 && isMouseDown) {
        let obj = intersects[0].object;
        if(activeHighlight != obj) { // indicates a new highlight
            activeHighlight = obj;
            playNote(obj, pitchshift);
        }
        activeHighlight = obj;
    } else {
        if(activeHighlight){
            activeHighlight.material.opacity = 0.0;
            activeHighlight = null;
        }
    }

    // panel interactivity

    let intersectsPanels = raycaster.intersectObjects(panels);

    if(intersectsPanels.length > 0) {
        let obj = intersectsPanels[0].object;
        if(activePanel != obj) { // indicates a new highlight
            activePanel = obj;
        }
        activePanel = obj;
        obj.material.opacity = 0.1;    
    } else {
        if(activePanel){
            activePanel.material.opacity = 0.0;
            activePanel = null;
        }
    }

    // keyboard interactivity (hover with mouse button down)
    
    if(isMouseDown && keyboardInteractives.length > 0) {
        let intersectsKeyboard = raycaster.intersectObjects(keyboardInteractives, false);
        
        if(intersectsKeyboard.length > 0) {
            let noteIndex = intersectsKeyboard[0].object.userData.noteIndex;
            
            if(typeof noteIndex === 'number') {
                const currentScaleNotes = masterGroup.children[scaleshift].userData.notes;
                const relativeIndex = ((noteIndex - pitchshift) % 12 + 12) % 12;
                
                if(currentScaleNotes[relativeIndex]) {
                    // Přehraj notu pouze pokud se změnila
                    if(!activeHighlight || activeHighlight.userData.noteIndex !== noteIndex) {
                        triggerNoteAudio(relativeIndex);
                        activeHighlight = intersectsKeyboard[0].object;
                        activeHighlight.userData.noteIndex = noteIndex;
                    }
                }
            }
        }
    }

    renderer.render(scene, camera);

}

function visualize(data){
    return new Promise((resolve, reject) => {
        try {
                
            let size = .7;
            let distance = 4;
            let thickness = 0.05

            noteRadius = distance;

            // gather differently styled intervals (as groups)
            scene.userData.styledIntervals = [ ];

            // create labels
            createLabels(distance, pitchshift);

            let categoryList = [];

            // cycle through all scales in 'data'
            for(let i = 0; i < data.length; i++) {

                let scaleGroup = new THREE.Group();
                
                // cycle through all notes in an octave (1-12) and mark
                // whether or not (T/F) they are in the scale
                let notes = [];
                let intervals = data[i].intervals;
                for(let j = 0; j < intervals.length; j++) {
                    // root is always in scale
                    if(j === 0){notes.push(true);}
                    // push intervals[j] - 1 false entries
                    for(let k = 0; k < intervals[j] - 1; k++){notes.push(false);}
                    // add a true for the next note in the scale
                    notes.push(true);
                }
                
                // the final interval duplicates the root note; remove it
                notes.pop();
                
                createRings(notes, scaleGroup, size, distance, thickness);
                createPaths(intervals, scaleGroup, size, distance);
                
                // find coordinates for scaleGroup according to its index
                let s = new THREE.Spherical(carouselRadius, -Math.PI/2, Math.PI + i * (2 * Math.PI / data.length));
                let v = new THREE.Vector3().setFromSpherical(s);
                
                // rotate it to its position on the carousel
                scaleGroup.rotateY(Math.PI * 2 * (i/data.length));
                scaleGroup.position.copy(v);
                
                // add user data
                scaleGroup.userData.notes = notes;
                scaleGroup.userData.index = i;
                scaleGroup.userData.name = data[i].name;
                scaleGroup.userData.category = data[i].category;
                scaleGroup.userData.feelings = data[i].feelings;
                scaleGroup.userData.genre = data[i].genre || '';
                scaleGroup.userData.usage = data[i].usage || '';

                categoryList.push(data[i].category);
                
                // add to master group
                masterGroup.add(scaleGroup);

            }

            // show visible interval styles
            updateIntervalStyle();

            // create navigation panels
            createPanels(distance);

            // update the note labels
            updateLabels(masterGroup.children[scaleshift].userData.notes, false);

            // set up initial keyboard display
            displayKeyboard();

            // find unique categories and update the categoryCount
            categorySet = new Set(categoryList);

            scene.add(masterGroup);

            createScaleSelector(scene.userData.data || []);
            updateScaleSelectorValue();

            resolve();
  
        } catch (error) {
            reject(error);
        }
    });
}

function createRings(notes, group, size, distance, thickness){

    for(let i = 0; i < notes.length; i++) {

        let geo = new THREE.RingBufferGeometry(size * (1-thickness), size, 64);
        let mat = new THREE.MeshBasicMaterial({color: new THREE.Color(grey), transparent: true, opacity: 1, wireframe: false});
        let mesh = new THREE.Mesh(geo, mat);

        mesh.rotateZ(getRotation(i));
        mesh.translateY(distance);

        if(notes[i]) {
            if(i === 0){
                // if this is the root note, change it to gold
                mat.color = new THREE.Color(gold);
            } else {
                // otherwise, it is in the scale but not the root: change to green
                mat.color = new THREE.Color(green);
            }

            // add a highlight that will be triggered by mousover
            let highlightGeo = new THREE.CircleBufferGeometry(size*(1-thickness), 64);
            let highlightMat = new THREE.MeshBasicMaterial({color: new THREE.Color(0xffffff), transparent: true, opacity: 0.0, wireframe: false});
            let highlight = new THREE.Mesh(highlightGeo, highlightMat);
            highlight.position.copy(mesh.position);
            highlight.userData.note = i;
            highlight.userData.ring = mesh;

            // add a highlight that will be visible and move with the ring
            let visHighlight = highlight.clone();
            visHighlight.material = highlightMat.clone();
            visHighlight.material.opacity = 0.05;

            let ringGroup = new THREE.Group();
            ringGroup.add(mesh, visHighlight);

            highlights.push(highlight);
            group.add(highlight);
            group.add(ringGroup);

        } else {
            group.add(mesh);
        }
    }
}

function changePitch(n) {
    const newPitch = pitchshift + n;
    if (newPitch >= 0 && newPitch <= 11) {
        setPitch(newPitch);
    }
}

function createLabels(distance, pitchshift) {

        for(let i = 0 + pitchshift; i < 12 + pitchshift; i++){

            // no need to recreate note labels entirely each time this is called
            if(noteLabels.elements.length != 12) {

                let dummy = new THREE.Mesh();
                dummy.rotateZ(getRotation(i - pitchshift));
                dummy.translateY(distance);
                dummy.translateZ(carouselRadius);

                let meshScreenPos = screenPosition(dummy, camera);

                let noteLabel = document.createElement('div');
                    noteLabel.innerHTML = noteLabels[noteLabelType][i%12];
                    noteLabel.style.position = 'absolute';
                    noteLabel.classList.add('note');
                    document.body.appendChild(noteLabel);
                    noteLabel.style.left = meshScreenPos.x - noteLabel.clientWidth / 2 + 'px';
                    noteLabel.style.top = meshScreenPos.y - noteLabel.clientHeight / 2 + 'px';
                    noteLabels.elements.push(noteLabel);

            } else {
                let noteLabel = noteLabels.elements[i - pitchshift];

                let priors = {
                    width: noteLabel.clientWidth,
                    height: noteLabel.clientHeight,
                    left: parseFloat(noteLabel.style.left.slice(0, -2)),
                    top: parseFloat(noteLabel.style.top.slice(0, -2))
                }
                
                noteLabel.innerHTML = noteLabels[noteLabelType][i%12];

                noteLabel.style.left = priors.left + (priors.width - noteLabel.clientWidth)/2 + 'px';
                noteLabel.style.top = priors.top + (priors.height - noteLabel.clientHeight)/2 + 'px';
            }


        }

    if(noteLabelType == 'sharp') {
        document.getElementById('sharp').style.textDecoration = 'underline';
        document.getElementById('flat').style.textDecoration = 'none';
    } else if(noteLabelType == 'flat') {
        document.getElementById('flat').style.textDecoration = 'underline';
        document.getElementById('sharp').style.textDecoration = 'none';
    }
}

function updateIntervalStyle( newStyle ) {
    if (newStyle) {
        intervalStyle = newStyle;

        // update the interval label positions to match the chosen style
        updateLabelPositions();
    }

    // update style-selection UI
    var intStyleControls = document.getElementById('interval-styles').children;
    for (let i = 0; i < intStyleControls.length; i++) {
      var styleControl = intStyleControls[i];
      styleControl.style.textDecoration = 'none';
    }
    document.getElementById(intervalStyle).style.textDecoration = 'underline';

    // hide all of our pre-rendered interval groups, but show the chosen style
    var styledIntervalGroups = scene.userData.styledIntervals || [ ];
    for (var i = 0; i < styledIntervalGroups.length; i++) {
        var intervalGroup = styledIntervalGroups[i];
        if (intervalGroup.name == intervalStyle +'-intervals') {
            // e.g. 'pie-intervals'
            intervalGroup.visible = true;
        } else {
            intervalGroup.visible = false;
        }
    }

}

function updateLabels(notes, timeout) {

    let t = timeout ? 300 : 0;

    // timeout allows the carousel to move before updating labels
    window.setTimeout(() => {    
        // update the title, category, and description
        let data = masterGroup.children[scaleshift].userData;

        document.getElementById('category').innerText = data.category + ' · ' + data.feelings;
        document.getElementById('category').style.color = '#ff4c7a';
        const genreEl = document.getElementById('genre');
        if (genreEl) {
            genreEl.innerText = data.genre || '—';
        }
        const usageEl = document.getElementById('usage');
        if (usageEl) {
            usageEl.innerText = data.usage || '—';
        }

        for(let i = 0; i < noteLabels.elements.length; i++) {
            if(!notes[i]) {
                // set notes outside of scale to grey
                noteLabels.elements[i].style.color = '#444444';
            } else{
                // set notes in scale to white
                noteLabels.elements[i].style.color = '#FFFFFF';

            }
        }

        let oldLables = Array.from(document.getElementsByClassName('interval-label'));

        // clear out old interval labels
        for(let j = 0; j < oldLables.length; j++) {
            oldLables[j].remove();
        }

        // add new interval labels
        for(let k = 0; k < data.intervals[intervalStyle].length; k++) {

            let intScreenPos = screenPosition(data.intervals[intervalStyle][k].mesh, camera);

            let intElement = document.createElement('div');
                intElement.classList.add(`interval-label`);
                intElement.style.position = 'absolute';
                intElement.innerText = data.intervals[intervalStyle][k].interval;
                document.body.appendChild(intElement);
                intElement.style.left = intScreenPos.x - intElement.clientWidth / 2 + 'px';
                intElement.style.top = intScreenPos.y - intElement.clientHeight / 2 + 'px';
        }

    }, t)
}

function updateLabelPositions() {

    // update each note label

    for(let i = 0; i < 12; i++){

        let dummy = new THREE.Mesh();
        dummy.rotateZ(getRotation(i));
        dummy.translateY(noteRadius);
        dummy.translateZ(carouselRadius);

        let meshScreenPos = screenPosition(dummy, camera);

        let noteLabel = noteLabels.elements[i];

        noteLabel.style.left = meshScreenPos.x - noteLabel.clientWidth / 2 + 'px';
        noteLabel.style.top = meshScreenPos.y - noteLabel.clientHeight / 2 + 'px';

    }

    // update each interval label

    let intervals = masterGroup.children[scaleshift].userData.intervals[intervalStyle];
    let intervalLabels = Array.from(document.getElementsByClassName('interval-label'));
    console.log(masterGroup.children[scaleshift].userData.intervals);
    console.log(intervalStyle);
    console.log(intervalLabels);
    for(let j = 0; j < intervals.length; j++) {

        let dummy = intervals[j].mesh;
        let labelElement = intervalLabels[j];
        let meshScreenPos = screenPosition(dummy, camera);

        labelElement.style.left = meshScreenPos.x - labelElement.clientWidth / 2 + 'px';
        labelElement.style.top = meshScreenPos.y - labelElement.clientHeight / 2 + 'px';

    }

}

function createPaths(intervals, group, size, distance){

    let noteCounter = 0;

    group.userData.intervals = {
        arc: [],
        gear: [],
        pie: []
    };

    // create a named sub-group for each interval style
    var arcStyleGroup =  new THREE.Group();
    arcStyleGroup.name = 'arc-intervals';
    group.add(arcStyleGroup);
    scene.userData.styledIntervals.push( arcStyleGroup );

    var pieStyleGroup =  new THREE.Group();
    pieStyleGroup.name = 'pie-intervals';
    group.add(pieStyleGroup);
    scene.userData.styledIntervals.push( pieStyleGroup );

    var gearStyleGroup =  new THREE.Group();
    gearStyleGroup.name = 'gear-intervals';
    group.add(gearStyleGroup);
    scene.userData.styledIntervals.push( gearStyleGroup );

    for(let i = 0; i < intervals.length; i++) {

        let start = noteCounter;
        let end = noteCounter + intervals[i];
        let minRadius = distance - size;
        let maxRadius = minRadius - intervals[i] * distance / 3.5;

        let s1 = new THREE.Spherical(minRadius, getRotation(start), - Math.PI / 2);
        let s2 = new THREE.Spherical(maxRadius, (getRotation(start)+getRotation(end))/2, - Math.PI / 2);
        let s3 = new THREE.Spherical(minRadius, getRotation(end), - Math.PI / 2);
        
        let v1 = new THREE.Vector3().setFromSpherical(s1);
        let v2 = new THREE.Vector3().setFromSpherical(s2);
        let v3 = new THREE.Vector3().setFromSpherical(s3);

        var c;
        console.warn("intervalStyle: "+ intervalStyle);

        // draw arc-style intervals into a dedicated group
        c = createBezierCurve(
            new THREE.Vector2(v1.x, v1.y),
            new THREE.Vector2(v2.x, v2.y),
            new THREE.Vector2(v3.x, v3.y)
        );
        arcStyleGroup.add(c);

        // create a mesh to track the position of the interval label in the current formation
        let arcIntervalLabelPos = new THREE.Mesh();
        arcIntervalLabelPos.position.copy(new THREE.Vector3().setFromSpherical(
            // adjusts the interval label radius according to the size of the interval
            new THREE.Spherical(minRadius - intervals[i]*0.85, (getRotation(start)+getRotation(end))/2, - Math.PI / 2)
        ));
        arcIntervalLabelPos.translateZ(carouselRadius);

        group.userData.intervals.arc.push({
            mesh: arcIntervalLabelPos,
            interval: intervals[i]
        })

        // draw gear-style intervals into a dedicated group
        // this is a circular arc with a pointy half-tooth at start and end: \_____/ \_____/
        let innerRadiusScale = 0.8;
        let angleOffset = Math.PI / 12;
        let sArcStart = new THREE.Spherical(minRadius * innerRadiusScale, getRotation(start + angleOffset), - Math.PI / 2);
        let sArcEnd = new THREE.Spherical(minRadius * innerRadiusScale, getRotation(end - angleOffset), - Math.PI / 2);

        // construct circular arc segment 
        c = createArcCurve(
            sArcStart,
            sArcEnd
        );

        // construct the first tooth, a straight line from the opening note label to the inner circular curve
        let sOpeningToothStart = new THREE.Spherical(minRadius, getRotation(start + angleOffset / 3), - Math.PI / 2);
        let sOpeningToothEnd = new THREE.Spherical(minRadius * innerRadiusScale, getRotation(start + angleOffset), - Math.PI / 2);

        let vOpeningToothStart = new THREE.Vector3().setFromSpherical(sOpeningToothStart);
        let vOpeningToothEnd = new THREE.Vector3().setFromSpherical(sOpeningToothEnd);

        let openingTooth = createBezierCurve(vOpeningToothStart, vOpeningToothStart, vOpeningToothEnd);

        // construct the second tooth, a straight line from the inner circular curve to the closing note label
        let sClosingToothStart = new THREE.Spherical(minRadius * innerRadiusScale, getRotation(end - angleOffset), - Math.PI / 2);
        let sClosingToothEnd = new THREE.Spherical(minRadius, getRotation(end - angleOffset / 3), - Math.PI / 2);

        let vClosingToothStart = new THREE.Vector3().setFromSpherical(sClosingToothStart);
        let vClosingToothEnd = new THREE.Vector3().setFromSpherical(sClosingToothEnd);

        let closingTooth = createBezierCurve(vClosingToothStart, vClosingToothStart, vClosingToothEnd);

        // create a mesh to track the position of the interval label in the current formation
        let gearIntervalLabelPos = new THREE.Mesh();
        gearIntervalLabelPos.position.copy(new THREE.Vector3().setFromSpherical(
            // sets the interval label on the inside of the circular arc segments
            new THREE.Spherical(innerRadiusScale * 0.85 * minRadius, getRotation((start + end) / 2), - Math.PI / 2)
        ));
        gearIntervalLabelPos.translateZ(carouselRadius);

        group.userData.intervals.gear.push({
            mesh: gearIntervalLabelPos,
            interval: intervals[i]
        })

        /* These "pins" are kind of an interesting alternative.
        c = createBezierCurve(
            new THREE.Vector2(v1.x, v1.y),
            new THREE.Vector2(vArcStart.x - v1.x, vArcStart.y - v1.y),
            //new THREE.Vector2(vArcStart.x - (v1.x/2), vArcStart.y - (v1.y/2)),
            new THREE.Vector2(vArcStart.x, vArcStart.y)
            //new THREE.Vector2(vArcMid.x * 2.0, vArcMid.y * 2.0),
            //new THREE.Vector2(vArcEnd.x, vArcEnd.y)
        );
        */

        gearStyleGroup.add(c, openingTooth, closingTooth);

        // draw pie-style intervals into a dedicated group
        // define a very boring "curve" for straight line segment
        c = createBezierCurve(
            new THREE.Vector2(0, 0),
            new THREE.Vector2(v1.x * 0.5, v1.y * 0.5),
            new THREE.Vector2(v1.x, v1.y)
        );
        pieStyleGroup.add(c);

        // create a mesh to track the position of the interval label in the current formation
        let pieIntervalLabelPos = new THREE.Mesh();
        pieIntervalLabelPos.position.copy(new THREE.Vector3().setFromSpherical(
            // pie interval labels are similar to the gear interval labels, but with a smaller radius
            new THREE.Spherical(Math.pow(innerRadiusScale, 4) * minRadius, getRotation((start + end) / 2), - Math.PI / 2)
        ));
        pieIntervalLabelPos.translateZ(carouselRadius);
        
        group.userData.intervals.pie.push({
            mesh: pieIntervalLabelPos,
            interval: intervals[i]
        })

 
        // This just honestly doesn't look as good:

        // let intervalText;
        // switch(intervals[i]){
        //     case 1:
        //         intervalText = 'm2'; break;
        //     case 2:
        //         intervalText = 'M2'; break;
        //     case 3:
        //         intervalText = 'm3'; break;
        //     case 4:
        //         intervalText = 'M3'; break;
        //     case 5:
        //         intervalText = 'P4'; break;
        // }

        noteCounter += intervals[i];

    }

}

function createPanels(distance){
    // add a backgroup for the scale group
    let backW = distance * 4.5;
    let backH = distance * 3;
    let backGeo = new THREE.PlaneBufferGeometry(backW, backH);
    let backMat = new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.0});
    let backMesh = new THREE.Mesh(backGeo, backMat);
    backMesh.position.copy(camera.position.clone().multiplyScalar(0.8));
    backMesh.updateMatrix();

    // add left and right panels for navigation
    let backR = backMesh.clone();
    let backL = backMesh.clone();

    // clone material too
    backR.material = backMat.clone();
    backL.material = backMat.clone();

    // scale and position panels
    let scale = 0.1;
    backR.scale.set(scale, 1, 1);
    backL.scale.set(scale, 1, 1);
    backR.translateX(backW/2 - backW * scale / 2);
    backL.translateX(-backW/2 + backW * scale / 2);
    
    // add an indicator for left/right
    backR.userData.direction = 'right';
    backL.userData.direction = 'left';

    panels.push(backR);
    panels.push(backL);
    scene.add(backR);
    scene.add(backL);

    // create arrow icons
    let aGeo = new THREE.BufferGeometry();
    let posAttr = new Float32Array(9);
    posAttr.set([0,-1,0,1,0,0,0,1,0]);
    aGeo.addAttribute('position', new THREE.BufferAttribute(posAttr, 3));
    aGeo.computeVertexNormals();
    let aMat = new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide});
    let aMesh = new THREE.Mesh(aGeo, aMat);
    aMesh.position.copy(camera.position.clone().multiplyScalar(0.8));

    let rMesh = aMesh.clone();
    let lMesh = aMesh.clone();

    rMesh.translateX(backW/2 - 0.5 - backW * scale / 2);
    lMesh.rotateY(Math.PI);
    lMesh.translateX(backW/2 - 0.5 - backW * scale / 2);

    scene.add(rMesh);
    scene.add(lMesh);

}

function createBezierCurve(s, m, e){
    let p = 30;
    
    let points = new THREE.QuadraticBezierCurve(s, m, e).getPoints(p);
    let geo = new THREE.BufferGeometry();
    let pos = [];
    let posAttr = new Float32Array((p+1)*3);
    
    for (let i = 0; i <= p; i++){
        pos.push(points[i].x);
        pos.push(points[i].y);
        pos.push(0);
    }
    
    posAttr.set(pos);
    
    geo.addAttribute('position', new THREE.BufferAttribute(posAttr, 3));
    let cLine = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({color: 0x666666, linewidth: 1})
        );
        
    return cLine;
}

function createArcCurve(s0, s1) {
    let p = 30;

    let geo = new THREE.BufferGeometry();
    let pos = [];
    let posAttr = new Float32Array((p+1)*3);

    for (let i = 0; i <= p; i++) {

        let sCoord = new THREE.Spherical(
            s0.radius,
            s0.phi + i/p * (s1.phi - s0.phi),
            s0.theta
        );
        let vCoord = new THREE.Vector3().setFromSpherical(sCoord);

        pos.push(vCoord.x);
        pos.push(vCoord.y);
        pos.push(0);
    }

    posAttr.set(pos);
    
    geo.addAttribute('position', new THREE.BufferAttribute(posAttr, 3));
    let cLine = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({color: 0x666666, linewidth: 1})
    );

    return cLine;

}
    
function setScaleIndex(newIndex, animate = true) {
    if (typeof newIndex !== 'number' || !Number.isFinite(dataLength) || dataLength === 0) {
        return;
    }

    let normalizedIndex = ((newIndex % dataLength) + dataLength) % dataLength;

    if (normalizedIndex === scaleshift) {
        updateScaleSelectorValue();
        return;
    }

    scaleshift = normalizedIndex;

    animateCarouselToCurrentScale(animate);

    updateLabels(masterGroup.children[scaleshift].userData.notes, animate);
    displayKeyboard();
    updateScaleSelectorValue();
}

function animateCarouselToCurrentScale(animate) {
    const targetRotation = - scaleshift * Math.PI * 2 / dataLength;

    if (!animate) {
        carouselRot.amount = targetRotation;
        return;
    }

    let t = new TWEEN.Tween(carouselRot);

    t.to({amount: targetRotation}, 300)
        .easing(TWEEN.Easing.Cubic.In)
        .onStart(() => {
            flagUpdate = true;
        })
        .onComplete(() => {
            // remove the tween from the array when finished to lessen
            // the load on the render loop
            flagUpdate = false;
            tweens.delete(t);
        })
        .start();

    tweens.add(t);
}

function rotateCarousel(dir){

    let newIndex = scaleshift;

    if(dir == 'left'){

        newIndex = scaleshift - 1 < 0 ? dataLength - 1 : scaleshift - 1;

    } else if(dir == 'right') {
        
        newIndex = scaleshift + 1 == dataLength ? 0 : scaleshift + 1;

    }

    setScaleIndex(newIndex, true);

}

function getRotation(n) {
    // returns the radians associated with the nth segment of a 
    // circle dived into twelve pieces
    return - n * Math.PI*2 / 12;
}

function screenPosition(obj, camera){
  
    let v = obj.position.clone();
    v.project(camera);
    
    let s = new THREE.Vector3();
    s.x = width/2 * ( 1 + v.x );
    s.y = height/2 * ( 1 - v.y )
    s.z = 0;

    return s;
  
};

function playNote(obj, pitchshift) {
    if(!flagUpdate){ // prevent notes from playing during certain animations

        let n = obj.userData.note;
        triggerNoteAudio(n);

        // 'spin' the geometries associated with the note
        let ring = obj.userData.ring

        let rand1 = Math.random() >= 0.5 ? 1 : -1;
        let rand2 = Math.random() >= 0.5 ? 1 : -1;

        let t = new TWEEN.Tween(ring.rotation);
            t.to({x: rand1 * Math.PI * 2, y: rand2 * Math.PI * 2}, 350)
            .easing(TWEEN.Easing.Exponential.Out)
            .onComplete((obj) => {
                obj.x = 0;
                obj.y = 0;
                tweens.delete(t);
            })
            .start();

        tweens.add(t);

    }

}

function triggerNoteAudio(noteIndex) {
    const bufferIndex = noteIndex + pitchshift;
    const buffer = audioBuffers[bufferIndex];

    if (!buffer) {
        return;
    }

    let source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);

    // register the note on the keyboard as well
    playKeyboardNote(noteIndex);
}

function resize(){
    width = window.innerWidth;
    height = window.innerHeight;
    
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    updateLabelPositions();
}

function onMouseMove(event) {
    event.preventDefault();
    mouse.x = ( event.clientX / width ) * 2 - 1;
    mouse.y = - ( event.clientY / height ) * 2 + 1;
}

function onMouseDown(event) {
    if (event.target.closest('#scale-select')) {
        return;
    }

    if (event.button === 0) {
        isMouseDown = true;
    }

    if (tryPlayKeyboardNote(event)) {
        event.preventDefault();
        return;
    }

    event.preventDefault();
    if(activePanel != null) {
        rotateCarousel(activePanel.userData.direction);
        activePanel = null;
    }
}

function onMouseUp(event) {
    if (event.button === 0) {
        isMouseDown = false;
        if(activeHighlight){
            activeHighlight.material.opacity = 0.0;
            activeHighlight = null;
        }
    }
}

function onMouseLeave(event) {
    isMouseDown = false;
    if(activeHighlight){
        activeHighlight.material.opacity = 0.0;
        activeHighlight = null;
    }
}

function tryPlayKeyboardNote(event) {
    if (!keyboardInteractives.length || !keyboardGroup || !masterGroup || !masterGroup.children.length) {
        return false;
    }

    let pointer = new THREE.Vector2();
    pointer.x = ( event.clientX / width ) * 2 - 1;
    pointer.y = - ( event.clientY / height ) * 2 + 1;

    let clickRaycaster = new THREE.Raycaster();
    clickRaycaster.setFromCamera(pointer, camera);

    let intersects = clickRaycaster.intersectObjects(keyboardInteractives, false);

    if (!intersects.length) {
        return false;
    }

    let noteIndex = intersects[0].object.userData.noteIndex;

    if (typeof noteIndex !== 'number') {
        return false;
    }

    const currentScaleNotes = masterGroup.children[scaleshift].userData.notes;
    const relativeIndex = ((noteIndex - pitchshift) % 12 + 12) % 12;

    if (!currentScaleNotes[relativeIndex]) {
        return false;
    }

    triggerNoteAudio(relativeIndex);
    return true;
}

function setupMIDISupport() {
    midiButtonEl = document.getElementById('midi-btn');
    midiStatusEl = document.getElementById('midi-status');
    midiFilterEl = document.getElementById('midi-filter');

    if (!midiButtonEl || !midiStatusEl) {
        return;
    }

    if (midiFilterEl) {
        midiFilterScaleOnly = midiFilterEl.checked;
        midiFilterEl.onchange = () => {
            midiFilterScaleOnly = midiFilterEl.checked;
        };
    }

    if (!navigator.requestMIDIAccess) {
        midiButtonEl.disabled = true;
        midiButtonEl.innerText = 'MIDI není podporováno';
        midiStatusEl.innerText = 'Prohlížeč nepodporuje Web MIDI API.';
        return;
    }

    midiButtonEl.onclick = () => {
        if (midiEnabled) {
            rescanMIDIInputs();
        } else {
            requestMIDIAccess();
        }
    };

    setupScalesLibrary();
}

function setupScalesLibrary() {
    const libraryBtn = document.getElementById('scales-library-btn');
    const modal = document.getElementById('scales-library-modal');
    const closeBtn = document.querySelector('.scales-library-close');
    const listContainer = document.getElementById('scales-library-list');

    if (!libraryBtn || !modal || !closeBtn || !listContainer) {
        return;
    }

    libraryBtn.onclick = () => {
        if (scalesData) {
            renderScalesLibrary(scalesData, listContainer);
            modal.style.display = 'block';
        }
    };

    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
}

function renderScalesLibrary(data, container) {
    const categories = {};
    
    data.forEach((scale, index) => {
        if (!categories[scale.category]) {
            categories[scale.category] = [];
        }
        categories[scale.category].push({ scale, index });
    });

    container.innerHTML = '';

    const categoryOrder = ['Běžné', 'Blues', 'Modal', 'Jazzové', 'Exotické', 'Neobvyklé'];
    
    categoryOrder.forEach(categoryName => {
        if (categories[categoryName]) {
            const section = document.createElement('div');
            section.className = 'scale-category-section';

            const title = document.createElement('h2');
            title.className = 'scale-category-title';
            title.textContent = categoryName;
            section.appendChild(title);

            categories[categoryName].forEach(({ scale, index }) => {
                const item = document.createElement('div');
                item.className = 'scale-item';
                item.style.cursor = 'pointer';

                const name = document.createElement('div');
                name.className = 'scale-item-name';
                name.textContent = scale.name;
                item.appendChild(name);

                const details = document.createElement('div');
                details.className = 'scale-item-details';
                
                const intervalCount = scale.intervals.length;
                const intervalPattern = scale.intervals.join(' - ');

                details.innerHTML = `
                    <strong>Počet tónů:</strong> ${intervalCount}<br>
                    <strong>Vzorec intervalů:</strong> ${intervalPattern}<br>
                    <strong>Pocit:</strong> ${scale.feelings}<br>
                    <strong>Žánr:</strong> ${scale.genre}<br>
                    <strong>Použití:</strong> ${scale.usage}
                `;
                
                item.appendChild(details);
                
                // Add click handler to select the scale
                item.onclick = () => {
                    setScaleIndex(index, true);
                    document.getElementById('scales-library-modal').style.display = 'none';
                };
                
                section.appendChild(item);
            });

            container.appendChild(section);
        }
    });
}

function requestMIDIAccess() {
    if (!navigator.requestMIDIAccess || midiEnabled) {
        return;
    }

    if (midiButtonEl) {
        midiButtonEl.disabled = true;
        midiButtonEl.innerText = 'Připojuji…';
    }
    updateMIDIStatus('Žádám o přístup k MIDI zařízením…');

    navigator.requestMIDIAccess({sysex: false}).then(onMIDISuccess, onMIDIFailure);
}

function onMIDISuccess(access) {
    midiAccess = access;
    midiEnabled = true;

    midiAccess.onstatechange = handleMIDIStateChange;

    midiInputs.clear();
    access.inputs.forEach(attachMIDIInput);

    if (midiButtonEl) {
        midiButtonEl.disabled = false;
        midiButtonEl.innerText = 'Znovu načíst MIDI';
    }

    updateMIDIStatus();
    resumeAudioContextIfNeeded();
}

function onMIDIFailure(err) {
    console.error('Nelze získat přístup k MIDI zařízením', err);
    midiEnabled = false;
    if (midiButtonEl) {
        midiButtonEl.disabled = false;
        midiButtonEl.innerText = 'Povolit MIDI';
    }
    updateMIDIStatus('Nepodařilo se získat přístup k MIDI zařízením. Zkontrolujte oprávnění prohlížeče.');
}

function handleMIDIStateChange(event) {
    if (!event || !event.port || event.port.type !== 'input') {
        return;
    }

    if (event.port.state === 'connected') {
        attachMIDIInput(event.port);
    } else if (event.port.state === 'disconnected') {
        detachMIDIInput(event.port.id);
    }

    updateMIDIStatus();
}

function attachMIDIInput(input) {
    if (!input) {
        return;
    }

    midiInputs.set(input.id, input);
    input.onmidimessage = handleMIDIMessage;
}

function detachMIDIInput(id) {
    if (!id || !midiInputs.has(id)) {
        return;
    }

    let input = midiInputs.get(id);
    if (input) {
        input.onmidimessage = null;
    }
    midiInputs.delete(id);
}

function rescanMIDIInputs() {
    if (!midiAccess) {
        requestMIDIAccess();
        return;
    }

    midiInputs.clear();
    midiAccess.inputs.forEach(attachMIDIInput);
    updateMIDIStatus();
}

function updateMIDIStatus(message) {
    if (!midiStatusEl) {
        return;
    }

    if (message) {
        midiStatusEl.innerText = message;
        return;
    }

    if (!midiEnabled) {
        midiStatusEl.innerText = 'Nepřipojeno';
        return;
    }

    if (!midiInputs.size) {
        midiStatusEl.innerText = 'Nebyla zjištěna žádná MIDI zařízení.';
        return;
    }

    let names = Array.from(midiInputs.values()).map((input) => input.name || 'Neznámé zařízení');
    midiStatusEl.innerText = `Naslouchám: ${names.join(', ')}`;
}

function handleMIDIMessage(message) {
    if (!message || !message.data || message.data.length < 3) {
        return;
    }

    const [status, noteNumber, velocity] = message.data;
    const command = status & 0xf0;

    if (command === 0x90 && velocity > 0) {
        handleMIDINoteOn(noteNumber);
    }
    // note-off events are ignored for now but could power visual feedback later
}

function handleMIDINoteOn(noteNumber) {
    if (typeof noteNumber !== 'number' || !masterGroup || !masterGroup.children.length) {
        return;
    }

    resumeAudioContextIfNeeded();

    const relativeIndex = ((noteNumber % 12) - pitchshift + 12) % 12;

    if (midiFilterScaleOnly) {
        const currentScaleNotes = masterGroup.children[scaleshift].userData.notes;
        if (!currentScaleNotes || !currentScaleNotes[relativeIndex]) {
            return;
        }
    }

    triggerNoteAudio(relativeIndex);
}

function resumeAudioContextIfNeeded() {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

const KEYBOARD_SIZE_MULTIPLIER = 0.7;
const KEYBOARD_VERTICAL_OFFSET = 6.2;

initKeyboard();

function initKeyboard() {

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