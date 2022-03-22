

let programInp = document.getElementById("programInp"),
	exportButton = document.getElementById("exportButton"),
	backButton = document.getElementById("backButton"),
	backAmountInp = document.getElementById("backAmountInp"),
	stepButton = document.getElementById("stepButton"),
	runButton = document.getElementById("runButton"),
	stepSizeInp = document.getElementById("stepSizeInp"),
	delayInp = document.getElementById("delayInp"),
	frameIndexElem = document.getElementById("frameIndexElem"),
	scaleInp = document.getElementById("scaleInp"),
	ctx = document.getElementById("canvas").getContext("2d");

let program,
	history,
	x, y, dir,
	runInterval = null,
	frame;


programInp.addEventListener("change", () => {
	if (programInp.value) {
		program = programInp.value.split(/\r\n|[\r\n]/);
		programInp.value = "";
		program = program.map(line => [...(line.length < program[0].length ? line.padEnd(program[0].length, " ") : line.substring(0, program[0].length))]);
		history = [];
		x = 0;
		y = 0;
		dir = "right";
		frame = 0;
		ctx.canvas.width = program[0].length * 5;
		ctx.canvas.height = program.length * 5;
		ctx.canvas.style.width = (ctx.canvas.width * scaleInp.value) + "px";
		for (let y = 0; y < program.length; y++) {
			for (let x = 0; x < program[0].length; x++) {
				renderChar(x, y);
			}
		}
	}
});

exportButton.addEventListener("click", () => {
	programInp.value = program.map(l => l.join("")).join("\n");
	programInp.focus();
	programInp.select();
});

backButton.addEventListener("click", () => {
	let amount = parseInt(backAmountInp.value);
	for (let i = 0; i < amount && history.length; i++) {
		let info = history.pop();
		let prevX = x, prevY = y;
		if (info.x !== undefined) x = info.x;
		if (info.y !== undefined) y = info.y;
		if (info.dir !== undefined) dir = info.dir;
		if (info.char !== undefined) {
			program[info.charPos[1]][info.charPos[0]] = info.char;
		}
		if (inProgram(prevX, prevY)) renderChar(prevX, prevY);
		if (!(x === prevX && y === prevY)) renderChar(x, y);
		frameIndexElem.textContent = --frame;
	}
});

stepButton.addEventListener("click", () => {
	if (runInterval !== null) {
		stopRunning();
	}
	doBigStep();
});

runButton.addEventListener("click", () => {
	if (runInterval === null) {
		runButton.textContent = "Stop";
		runInterval = setInterval(() => {
			doBigStep();
			if (!inProgram()) {
				stopRunning();
			}
		}, parseFloat(delayInp.value));
	} else {
		stopRunning();
	}
});

scaleInp.addEventListener("change", () => {
	ctx.canvas.style.width = (ctx.canvas.width * scaleInp.value) + "px";
});


function stopRunning() {
	clearInterval(runInterval);
	runInterval = null;
	runButton.textContent = "Run";
}

function doBigStep() {
	let amount = parseInt(stepSizeInp.value);
	for (let i = 0; i < amount && inProgram(); i++) {
		step();
	}
}

function step() {
	let prevX = x, prevY = y;
	
	let c = program[y][x].toLowerCase(),
		op = {};
	
	if ("\\/".includes(c)) {
		op.char = c;
		op.charPos = [x, y];
		program[y][x] = c === "\\" ? "/" : "\\";
		let cdir = dir === "left" || dir === "up" ? (c === "\\" ? -1 : 1) : (c === "\\" ? 1 : -1),
			newDir = dir === "left" || dir === "right" ? (cdir === 1 ? "down" : "up") : (cdir === 1 ? "right" : "left");
		if (newDir === "left" || newDir === "right") {
			op.x = x;
			x += cdir;
		} else {
			op.y = y;
			y += cdir;
		}
		op.dir = dir;
		dir = newDir;
	} else if (">v<^".includes(c)) {
		op.char = c;
		op.charPos = [x, y];
		program[y][x] = ({right: "<", down: "^", left: ">", up: "V"})[dir];
		if (c === ">") {
			op.x = x;
			x += 1;
		} else if (c === "v") {
			op.y = y;
			y += 1;
		} else if (c === "<") {
			op.x = x;
			x -= 1;
		} else if (c === "^") {
			op.y = y;
			y -= 1;
		}
		op.dir = dir;
		dir = ({">": "right", "v": "down", "<": "left", "^": "up"})[c];
	} else {
		if (dir === "right") {
			op.x = x;
			x += 1;
		} else if (dir === "down") {
			op.y = y;
			y += 1;
		} else if (dir === "left") {
			op.x = x;
			x -= 1;
		} else if (dir === "up") {
			op.y = y;
			y -= 1;
		}
	}
	
	renderChar(prevX, prevY);
	if (inProgram() && !(prevX === x && prevY === y)) renderChar(x, y);
	
	frameIndexElem.textContent = ++frame;
	
	history.push(op);
}

function inProgram(qx = x, qy = y) {
	return 0 <= qx && qx < program[0].length && 0 <= qy && qy < program.length;
}

function renderChar(cx, cy) {
	let px = cx * 5,
		py = cy * 5,
		bg, fg;
	
	if (cx === x && cy === y) {
		ctx.fillStyle = "black";
		ctx.fillRect(px, py, 5, 5);
		ctx.fillStyle = "white";
		if (dir === "right" || dir === "down") ctx.fillRect(px + 4, py + 4, 1, 1);
		if (dir === "left" || dir === "down") ctx.fillRect(px, py + 4, 1, 1);
		if (dir === "left" || dir === "up") ctx.fillRect(px, py, 1, 1);
		if (dir === "right" || dir === "up") ctx.fillRect(px + 4, py, 1, 1);
		bg = "black";
		fg = "white";
	} else {
		ctx.fillStyle = "white";
		ctx.fillRect(px, py, 5, 5);
		bg = "white";
		fg = "black";
	}
	
	let c = program[cy][cx].toUpperCase();
	
	ctx.fillStyle = fg;
	
	if (c === "\\") {
		ctx.fillRect(px + 1, py + 1, 1, 1);
		ctx.fillRect(px + 2, py + 2, 1, 1);
		ctx.fillRect(px + 3, py + 3, 1, 1);
	} else if (c === "/") {
		ctx.fillRect(px + 3, py + 1, 1, 1);
		ctx.fillRect(px + 2, py + 2, 1, 1);
		ctx.fillRect(px + 1, py + 3, 1, 1);
	} else if (c === ">") {
		ctx.fillRect(px + 2, py + 1, 1, 1);
		ctx.fillRect(px + 3, py + 2, 1, 1);
		ctx.fillRect(px + 2, py + 3, 1, 1);
	} else if (c === "V") {
		ctx.fillRect(px + 1, py + 2, 1, 1);
		ctx.fillRect(px + 2, py + 3, 1, 1);
		ctx.fillRect(px + 3, py + 2, 1, 1);
	} else if (c === "<") {
		ctx.fillRect(px + 2, py + 1, 1, 1);
		ctx.fillRect(px + 1, py + 2, 1, 1);
		ctx.fillRect(px + 2, py + 3, 1, 1);
	} else if (c === "^") {
		ctx.fillRect(px + 1, py + 2, 1, 1);
		ctx.fillRect(px + 2, py + 1, 1, 1);
		ctx.fillRect(px + 3, py + 2, 1, 1);
	} else if (c !== " ") {
		ctx.fillRect(px + 1, py + 1, 3, 3);
		ctx.fillStyle = bg;
		ctx.fillRect(px + 2, py + 2, 1, 1);
	}
}



