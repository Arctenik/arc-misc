

let programInp = document.getElementById("programInp"),
	exportButton = document.getElementById("exportButton"),
	outputElem = document.getElementById("outputElem"),
	backButton = document.getElementById("backButton"),
	backAmountInp = document.getElementById("backAmountInp"),
	stepButton = document.getElementById("stepButton"),
	runButton = document.getElementById("runButton"),
	stepSizeInp = document.getElementById("stepSizeInp"),
	delayInp = document.getElementById("delayInp"),
	frameIndexElem = document.getElementById("frameIndexElem"),
	scaleInp = document.getElementById("scaleInp"),
	ctx = document.getElementById("canvas").getContext("2d");

let program;


programInp.addEventListener("change", () => {
	if (programInp.value) {
		program = new BackFlip(programInp.value, {
			backSize: parseInt(backAmountInp.value),
			stepSize: parseInt(stepSizeInp.value),
			delay: parseFloat(delayInp.value),
			output(s) {
				outputElem.insertAdjacentText("beforeend", s);
			},
			unoutput(s) {
				let c = outputElem.textContent;
				outputElem.textContent = c.substring(0, c.length - s.length);
			}
		});
		programInp.value = "";
		frameIndexElem.textContent = program.frame;
		outputElem.innerHTML = "";
		program.render(ctx, parseFloat(scaleInp.value));
	}
});

exportButton.addEventListener("click", () => {
	programInp.value = program.getText();
	programInp.focus();
	programInp.select();
});

backButton.addEventListener("click", () => {
	program.stopRunning();
	program.bigStep(-1, ctx);
	frameIndexElem.textContent = program.frame;
});

stepButton.addEventListener("click", () => {
	program.stopRunning();
	program.bigStep(1, ctx);
	frameIndexElem.textContent = program.frame;
});

runButton.addEventListener("click", () => {
	let running = program.toggleRun(ctx, {
		stop() {
			runButton.textContent = "Run";
		},
		update() {
			frameIndexElem.textContent = program.frame;
		}
	});
	if (running) {
		runButton.textContent = "Stop";
	}
});

backAmountInp.addEventListener("change", () => {
	if (program) program.backSize = parseInt(backAmountInp.value);
});

stepSizeInp.addEventListener("change", () => {
	if (program) program.stepSize = parseInt(stepSizeInp.value);
});

delayInp.addEventListener("change", () => {
	if (program) program.delay = parseInt(delayInp.value);
});

scaleInp.addEventListener("change", () => {
	ctx.canvas.style.width = (ctx.canvas.width * scaleInp.value) + "px";
});

