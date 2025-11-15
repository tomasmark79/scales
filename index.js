if ( WEBGL.isWebGLAvailable() ) {

    // Auto-start the application
    audioCtx.resume();
    animate();
    flagUpdate = false;
    document.getElementById('overlay').style.display = 'none';

} else {

	var warning = WEBGL.getWebGLErrorMessage();
	document.getElementById( 'overlay-content' ).appendChild( warning );

}