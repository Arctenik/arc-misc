

let {v3} = twgl;

let previewModeInp = document.getElementById("previewModeInp"),
	imageInp = document.getElementById("imageInp"),
	canvas = document.getElementById("canvas"),
	vsBasicScript = document.getElementById("vsBasicScript"),
	fsBasicScript = document.getElementById("fsBasicScript"),
	vsMagicScript = document.getElementById("vsMagicScript"),
	fsMagicScript = document.getElementById("fsMagicScript");

let moveSpeed = 0.002,
	turnSpeed = 0.05;

let eyesDist = 150,
	fov = 60,
	viewDist = 100,
	imageClip = 0.9,
	bgDist = 90,
	bgSize = 1.2,
	lightPos = [0, 10, 0],
	previewColor = [201, 105, 225, 255],
	camera = {
		pos: v3.create(0, 0, 0),
		dir: v3.create(0, 0, 1),
		up: v3.create(0, 1, 0),
		right: v3.create(1, 0, 0)
	},
	scene = [
		{
			type: "box",
			pos: [0, 0, 5],
			size: [2, 2, 2]
		}
	];

let sceneBufferInfo;

let gl = canvas.getContext("webgl"),
	basicProgramInfo = twgl.createProgramInfo(gl, [vsBasicScript.innerHTML, fsBasicScript.innerHTML]),
	magicProgramInfo = twgl.createProgramInfo(gl, [vsMagicScript.innerHTML, fsMagicScript.innerHTML]),
	renderMode = previewModeInp.checked ? "preview" : "magic",
	imageTexture, imageSize,
	newRenderSettings;

getPlaceholderTexture();
getSceneData();
gl.clearColor(0.9, 0.9, 0.9, 1);


imageInp.addEventListener("change", async () => {
	let image = await readPng(imageInp.files[0]),
		imageTexture = twgl.createTexture(gl, {width: image.width, height: image.height, src: image.data}),
		imageSize = [image.width, image.height];
	addRenderSettings({imageTexture, imageSize});
});

previewModeInp.addEventListener("change", () => {
	addRenderSettings({mode: previewModeInp.checked ? "preview" : "magic"});
});


function addRenderSettings(settings) {
	newRenderSettings = Object.assign(newRenderSettings || {}, settings);
}

function updateRenderSettings() {
	let settings = newRenderSettings;
	newRenderSettings = null;
	
	if (settings.mode) renderMode = settings.mode;
	if (settings.imageTexture) {
		gl.deleteTexture(imageTexture);
		imageTexture = settings.imageTexture;
		imageSize = settings.imageSize;
	}
	
	if (renderMode === "preview") prepareBasic();
	else prepareMagic();
}


function prepareBasic() {
	canvas.width = imageSize[0];
	canvas.height = imageSize[1];
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.enable(gl.CULL_FACE);
	gl.enable(gl.DEPTH_TEST);
	gl.disable(gl.SCISSOR_TEST);
}

function renderBasic() {
	let uniforms = makeUniforms({
		u_aspectRatio: canvas.width/canvas.height,
		u_lightPos: lightPos,
		u_color: previewColor.map(v => v/255)
	});
	
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(basicProgramInfo.program);
	twgl.setBuffersAndAttributes(gl, basicProgramInfo, sceneBufferInfo)
	twgl.setUniforms(basicProgramInfo, uniforms);
	twgl.drawBufferInfo(gl, sceneBufferInfo);
}


function prepareMagic() {
	canvas.width = imageSize[0] * 2;
	canvas.height = imageSize[1];
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.enable(gl.CULL_FACE);
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.SCISSOR_TEST);
}

function renderMagic() {
	let uniformsLeft = makeUniforms({
			u_aspectRatio: (canvas.width/2)/canvas.height,
			u_eyesOffset: eyesDist/canvas.width, // offset is half dist but that cancels with the clip space width
			u_image: imageTexture,
			u_imageClip: imageClip
		}),
		uniformsRight = {...uniformsLeft};
	
	uniformsLeft.u_side = -1;
	uniformsRight.u_side = 1;
	
	gl.scissor(0, 0, canvas.width, canvas.height);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(magicProgramInfo.program);
	
	let bgBufferInfo = makeBackgroundData(uniformsLeft.u_fovRatio);
	
	drawSides(bgBufferInfo);
	
	drawSides(sceneBufferInfo);
	
	
	function drawSides(bufferInfo) {
		twgl.setBuffersAndAttributes(gl, magicProgramInfo, bufferInfo);
		
		gl.scissor(0, 0, canvas.width/2, canvas.height);
		twgl.setUniforms(magicProgramInfo, uniformsLeft);
		twgl.drawBufferInfo(gl, bufferInfo);
		
		gl.scissor(canvas.width/2, 0, canvas.width/2, canvas.height);
		twgl.setUniforms(magicProgramInfo, uniformsRight);
		twgl.drawBufferInfo(gl, bufferInfo);
	}
}

function makeBackgroundData(fovRatio) {
	let xSize = bgSize/fovRatio * viewDist,
		ySize = xSize * canvas.height/(canvas.width/2),
		center = v3.add(camera.pos, v3.mulScalar(camera.dir, bgDist)),
		p1 = getVertex(-1, 1),
		p2 = getVertex(1, 1),
		p3 = getVertex(-1, -1),
		p4 = getVertex(1, -1),
		vertices = [];
	
	vertices.push(
		p1, p3, p4,
		p1, p4, p2
	);
	
	return twgl.createBufferInfoFromArrays(gl, {
		a_pos: vertices.map(v => [...v]).flat()
	});
	
	
	function getVertex(dirX, dirY) {
		return v3.add(v3.add(center, v3.mulScalar(camera.right, dirX * xSize)), v3.mulScalar(camera.up, dirY * ySize));
	}
}


function makeUniforms(extra) {
	return {
		u_viewDist: viewDist,
		u_fovRatio: 1/Math.tan(fov/2 * Math.PI/180),
		u_cameraPos: camera.pos,
		u_cameraDir: camera.dir,
		u_cameraUp: camera.up,
		u_cameraRight: camera.right,
		...extra
	};
}


function render() {
	if (newRenderSettings) updateRenderSettings();
	if (renderMode === "preview") {
		renderBasic();
	} else {
		renderMagic();
	}
}


function getPlaceholderTexture() {
	let width = 500,
		height = 400,
		cw = width/4,
		ch = height/4,
		numColors = cw * ch,
		colors = [];
	
	for (let i = 0; i < numColors; i++) {
		let c = [];
		for (let j = 0; j < 3; j++) {
			c.push(Math.floor(Math.random() * 256));
		}
		c.push(255);
		colors.push(c);
	}
	
	let data = [];
	
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let cx = Math.floor(x/4),
				cy = Math.floor(y/4);
			
			data.push(...colors[cy * cw + cx]);
		}
	}
	
	imageTexture = twgl.createTexture(gl, {width, height, src: data});
	imageSize = [width, height];
}

function getSceneData() {
	sceneVertices = [];
	sceneNormals = [];
	
	scene.forEach(shape => {
		for (let t of getShapeTriangles(shape)) {
			let norm = v3.normalize(v3.cross(v3.subtract(t[2], t[0]), v3.subtract(t[1], t[0])));
			t.forEach(v => {
				sceneVertices.push(...v);
				sceneNormals.push(...norm);
			});
		}
	});
	
	sceneBufferInfo = twgl.createBufferInfoFromArrays(gl, {
		a_pos: {
			numComponents: 3,
			data: sceneVertices
		},
		a_norm: {
			numComponents: 3,
			data: sceneNormals
		}
	});
}

function* getShapeTriangles(shape) {
	if (shape.type === "box") {
		for (let axis = 0; axis < 3; axis++) {
			for (let side = 0; side < 2; side++) {
				let axis2 = (axis + 2 - side /*((side + axis)%2)*/)%3,
					axis3 = (axis + 1 + side /*((side + axis)%2)*/)%3,
					p1 = shape.pos.slice();
				
				p1[axis] += side * shape.size[axis];
				
				let p2 = p1.slice(),
					p3 = p1.slice();
				
				p2[axis2] += shape.size[axis2];
				p3[axis3] += shape.size[axis3];
				
				let p4 = p2.slice();
				
				p4[axis3] += shape.size[axis3];
				
				yield [p1, p3, p4];
				yield [p1, p4, p2];
			}
		}
	} else {
		throw new Error("Unknown shape type: " + JSON.stringify(shape.type));
	}
}



let controls = {
		"w": "forward",
		"a": "left",
		"s": "backward",
		"d": "right",
		" ": "up",
		"shift": "down",
		"arrowleft": "turnLeft",
		"arrowup": "turnUp",
		"arrowright": "turnRight",
		"arrowdown": "turnDown"
	},
	pressedControls = {};

document.addEventListener("keydown", e => {
	let key = e.key.toLowerCase();
	if (controls[key]) {
		e.preventDefault();
		pressedControls[controls[key]] = true;
	}
});

document.addEventListener("keyup", e => {
	let key = e.key.toLowerCase();
	if (controls[key]) {
		e.preventDefault();
		pressedControls[controls[key]] = false;
	}
});


let prevTime;

function renderLoop(t) {
	if (prevTime) {
		
		let d = t - prevTime;
		
		
		if (pressedControls.forward) {
			camera.pos = v3.add(camera.pos, v3.mulScalar(camera.dir, d * moveSpeed));
		}
		if (pressedControls.backward) {
			camera.pos = v3.add(camera.pos, v3.mulScalar(camera.dir, -d * moveSpeed));
		}
		if (pressedControls.left) {
			camera.pos = v3.add(camera.pos, v3.mulScalar(camera.right, -d * moveSpeed));
		}
		if (pressedControls.right) {
			camera.pos = v3.add(camera.pos, v3.mulScalar(camera.right, d * moveSpeed));
		}
		if (pressedControls.up) {
			camera.pos = v3.add(camera.pos, v3.mulScalar(camera.up, d * moveSpeed));
		}
		if (pressedControls.down) {
			camera.pos = v3.add(camera.pos, v3.mulScalar(camera.up, -d * moveSpeed));
		}
		
		if (pressedControls.turnLeft) {
			camera.dir = rotateAround(camera.dir, [0, 1, 0], -d * turnSpeed);
			camera.right = rotateAround(camera.right, [0, 1, 0], -d * turnSpeed);
			camera.up = rotateAround(camera.up, [0, 1, 0], -d * turnSpeed);
		}
		if (pressedControls.turnRight) {
			camera.dir = rotateAround(camera.dir, [0, 1, 0], d * turnSpeed);
			camera.right = rotateAround(camera.right, [0, 1, 0], d * turnSpeed);
			camera.up = rotateAround(camera.up, [0, 1, 0], d * turnSpeed);
		}
		if (pressedControls.turnUp) {
			let [a, b] = rotateAxes(camera.up, camera.dir, -d * turnSpeed)
			camera.up = a;
			camera.dir = b;
		}
		if (pressedControls.turnDown) {
			let [a, b] = rotateAxes(camera.dir, camera.up, -d * turnSpeed)
			camera.dir = a;
			camera.up = b;
		}
		
		
		render();
		
	}
	
	prevTime = t;
	
	requestAnimationFrame(renderLoop);
}

function rotateAxes(a, b, angle) {
	angle *= Math.PI/180;
	return [
		v3.add(v3.mulScalar(a, Math.cos(angle)), v3.mulScalar(b, Math.sin(angle))),
		v3.add(v3.mulScalar(b, Math.cos(angle)), v3.mulScalar(a, -Math.sin(angle)))
	];
}

function rotateAround(v, axis, angle) {
	angle *= Math.PI/180;
	
	let alignedPart = vecProj(v, axis),
		rotatePart = v3.subtract(v, alignedPart),
		rotateTarget = v3.cross(axis, rotatePart);
	
	return v3.add(v3.add(alignedPart, v3.mulScalar(rotatePart, Math.cos(angle))), v3.mulScalar(rotateTarget, Math.sin(angle)));
}

function vecProj(a, b) {
	return v3.mulScalar(v3.normalize(b), vecProjS(a, b));
}

function vecProjS(a, b) {
	return v3.dot(a, b)/v3.length(b);
}



function readFile(file, type = "arrayBuffer") {
	return new Promise((resolve, reject) => {
		let r = new FileReader();
		r.addEventListener("load", () => resolve(r.result));
		r.addEventListener("error", () => reject(r.error));
		r["readAs" + type[0].toUpperCase() + type.substring(1)](file);
	});
}


// (requires the above readFile, and pngjs)
function readPng(file) {
	return new Promise((resolve, reject) => {
		readFile(file).then(buff => {
			new PNG().parse(buff, (err, image) => {
				if (err) reject(err);
				else resolve(image);
			});
		}).catch(reject);
	});
}



prepareBasic();

requestAnimationFrame(renderLoop);

