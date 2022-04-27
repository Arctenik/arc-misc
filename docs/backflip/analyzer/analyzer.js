

let codeInp = document.getElementById("codeInp"),
	randomButton = document.getElementById("randomButton"),
	randomWidthInp = document.getElementById("randomWidthInp"),
	randomHeightInp = document.getElementById("randomHeightInp"),
	randomChannelsInp = document.getElementById("randomChannelsInp"),
	numInputsInp = document.getElementById("numInputsInp"),
	numOutputsInp = document.getElementById("numOutputsInp"),
	randomWeightsInp = document.getElementById("randomWeightsInp"),
	canvas = document.getElementById("canvas"),
	ctx = canvas.getContext("2d"),
	showInteractionsInp = document.getElementById("showInteractionsInp"),
	tableElem = document.getElementById("tableElem");

let edgeDirColors = [[253, 219, 251], [224, 45, 213]],
	edgeFullColors = [[255, 231, 193], [232, 147, 13]];

let randomPrev = [],
	showInteractionsCb;


codeInp.addEventListener("change", () => {
	let code = codeInp.value;
	if (code) {
		analyzeDevice(code);
	}
});

randomButton.addEventListener("click", () => {
	let width = +randomWidthInp.value,
		height = +randomHeightInp.value,
		perim = (width + height) * 2,
		weights = randomWeightsInp.value.trim().split(/[\s,]+/).map(s => +s);
	
	let d = randomDevice(width, height, +randomChannelsInp.value, +numInputsInp.value, +numOutputsInp.value, weights);
	
	randomPrev.push(d);
	if (randomPrev.length > 5) randomPrev.shift();
	
	codeInp.value = d;
	
	analyzeDevice(d);
});

showInteractionsInp.addEventListener("change", () => {
	if (showInteractionsCb) showInteractionsCb();
});


function randomDevice(width, height, numChannels, numInputs, numOutputs, weights) {
	let perim = (width + height) * 2,
		s = "";
	for (let y = 0; y < height + 2; y++) {
		if (s) s += "\n";
		for (let x = 0; x < width + 2; x++) {
			let c = " ",
				onVertEdge = x === 0 || x === width + 1,
				onHorizEdge = y === 0 || y === height + 1;
			
			if (onVertEdge || onHorizEdge) {
				if (!(onVertEdge && onHorizEdge)) {
					if (numChannels && Math.random() * perim < numChannels) {
						numChannels--;
						if (numInputs) {
							numInputs--;
							c = onVertEdge ? (x ? "<" : ">") : (y ? "^" : "V");
						} else if (numOutputs) {
							numOutputs--;
							c = onVertEdge ? (x ? ">" : "<") : (y ? "V" : "^");
						}
					} else c = "#";
					perim--;
				} else {
					c = "#";
				}
			} else {
				let n = Math.random() * (weights[0] + weights[1] + weights[2]);
				if (n < weights[2]) c = ">V<^"[Math.floor(Math.random() * 4)];
				else if (n < weights[2] + weights[1]) c = "/\\"[Math.floor(Math.random() * 1)];
			}
			
			s += c;
		}
	}
	return s;
}

function analyzeDevice(code) {
	code = code.replace(/v/g, "V"); // otherwise it never returns to the initial state
	
	let p = new BackFlip(code, {unknownSymbolMode: "rebound"});
	
	p.program = p.program.map(l => [" ", " "].concat(l, [" ", " "]));
	p.program.unshift((new Array(p.program[0].length)).fill(" "));
	p.program.unshift((new Array(p.program[0].length)).fill(" "));
	p.program.push((new Array(p.program[0].length)).fill(" "));
	p.program.push((new Array(p.program[0].length)).fill(" "));
	
	let channels = [];
	
	for (let y = 2; y < p.program.length - 2; y++) {
		for (let [x, dx, arrow] of [[0, 1, ">"], [p.program[0].length - 1, -1, "<"]]) {
			if (scanForDevice(x, y, dx, 0)) {
				channels.push({x, y, arrow});
			}
		}
	}
	
	for (let x = 2; x < p.program[0].length - 2; x++) {
		for (let [y, dy, arrow] of [[0, 1, "V"], [p.program.length - 1, -1, "^"]]) {
			if (scanForDevice(x, y, 0, dy)) {
				channels.push({x, y, arrow});
			}
		}
	}
	
	channels.sort((a, b) => a.y - b.y || a.x - b.x);
	
	channels.forEach(({x, y, arrow}) => {
		p.program[y][x] = arrow;
	});
	
	let maxDim = Math.max(p.program[0].length, p.program.length);
	let stateIds = {},
		statesById = {},
		nextStateId = 0,
		transitions = {},
		maxEdgeFrequency = -Infinity,
		interactions = {};
	
	getCurrentState();
	
	while (true) {
		let foundNew = false;
		for (let c = 0; c < channels.length; c++) {
			if (!transitions[c] || Object.keys(transitions[c]).length < Object.keys(statesById).length) {
				for (let s of Object.values(stateIds)) {
					if (!transitions[c]?.[s]) {
						findTransitions(c, s);
						foundNew = true;
					}
				}
			}
		}
		if (!foundNew) break;
	}
	
	p.x = -1;
	
	loadState(0);
	
	p.padding = [
		0,
		Math.max(0, (maxEdgeFrequency * 2) - (p.program[0].length * 5)),
		6,
		0
	];
	
	p.render(ctx, maxDim > 30 ? 1 : maxDim > 15 ? 2 : 3);
	
	showInteractionsCb = () => {
		if (showInteractionsInp.checked) {
			showInteractions();
		} else {
			hideInteractions();
		}
	};
	
	if (showInteractionsInp.checked) showInteractions();
	
	//collapseStates();
	
	showTransitions();
	
	showTransitionsGraph();
	
	
	function showTransitionsGraph() {
		let g = new dagreD3.graphlib.Graph({multigraph: true}).setGraph({});
		
		for (let s in statesById) {
			g.setNode("S" + s, {label: "S" + s});
		}
		
		for (let [c, ts] of Object.entries(transitions)) {
			for (let [s, t] of Object.entries(ts)) {
				if (t.state != s || t.events.length) g.setEdge("S" + s, "S" + t.state, {label: "C" + c + (t.events.length ? " : C " + t.events.join(", ") : "")}, "S" + s + " C" + c);
			}
		}
		
		let svgElem = document.querySelector("#svg");
		
		svgElem.innerHTML = "<g></g>";
		
		let padding = 5,
			inner = d3.select("#svg").select("g"),
			chartGroup = svgElem.querySelector("g");

		(new dagreD3.render())(inner, g);

		let {left: svgX, top: svgY} = svgElem.getBoundingClientRect(),
			{left: chartX, top: chartY, width: chartWidth, height: chartHeight} = chartGroup.getBoundingClientRect();

		chartGroup.style.transform = `translate(${svgX - chartX + padding}px, ${svgY - chartY + padding}px)`;
		svgElem.setAttribute("width", chartWidth + padding * 2);
		svgElem.setAttribute("height", chartHeight + padding * 2);
	}
	
	function showTransitions() {
		let table = document.createElement("table"),
			thead = document.createElement("thead"),
			theadTr = document.createElement("tr"),
			tbody = document.createElement("tbody");
		
		theadTr.innerHTML = "<th></th>";
		
		thead.appendChild(theadTr);
		table.appendChild(thead);
		table.appendChild(tbody);
		
		for (let [i, {x, y}] of channels.entries()) {
			let th = document.createElement("th"),
				coordsElem = document.createElement("span");
			
			coordsElem.classList.add("normalWeight");
			
			th.textContent = "C" + i + " ";
			coordsElem.textContent = "(" + x + ", " + y + ")";
			th.appendChild(coordsElem);
			theadTr.appendChild(th);
		}
		
		let rows = Object.values(stateIds).sort((a, b) => a - b).map(s => {
			let tr = document.createElement("tr"),
				th = document.createElement("th");
			
			th.textContent = "S" + s;
			tr.appendChild(th);
			tbody.appendChild(tr);
			
			return tr;
		});
		
		for (let c of channels.keys()) {
			for (let s in transitions[c]) {
				let t = transitions[c][s],
					td = document.createElement("td");
				
				td.textContent = "S" + t.state + (t.events.length ? " | C " + t.events.join(", ") : "");
				
				td.addEventListener("click", () => {
					if (td.classList.contains("selected")) {
						td.classList.remove("selected");
						hideTransitionInfo();
					} else {
						let prev = table.querySelector(".selected");
						if (prev) prev.classList.remove("selected");
						td.classList.add("selected");
						showTransitionInfo(c, s);
					}
				});
				
				rows[s].appendChild(td);
			}
		}
		
		table.border = "";
		
		tableElem.replaceWith(table);
		tableElem = table;
	}
	
	function showTransitionInfo(c, s) {
		clearEdges();
		showEdges(transitions[c][s].vEdges, 1);
		showEdges(transitions[c][s].hEdges, 0);
	}
	
	function hideTransitionInfo() {
		clearEdges();
	}
	
	function showEdges(edges, axis) {
		for (let i = 1; i <= maxEdgeFrequency; i++) {
			ctx.fillStyle = getColor(i, edgeDirColors);
			ctx.fillRect((i - 1) * 2, ctx.canvas.height - 5, 2, 2);
			ctx.fillStyle = getColor(i, edgeFullColors);
			ctx.fillRect((i - 1) * 2, ctx.canvas.height - 2, 2, 2);
		}
		
		for (let y in edges) {
			for (let x in edges[y]) {
				let coords = [+x, +y],
					e = edges[y][x];
				
				for (let [side, sv] of e.entries()) {
					if (sv) {
						let colors = e[0] && e[1] ? edgeFullColors : edgeDirColors;
						ctx.fillStyle = getColor(sv, colors);
						let params = [x * 5, y * 5, 1, 1];
						params[axis]++;
						if (side) params[1 - axis]--;
						ctx.fillRect(...params);
						params[axis] += 2;
						ctx.fillRect(...params);
						params[axis]--;
						if (!(e[0] && e[1])) ctx.fillRect(...params);
						params[1 - axis] += side * 2 - 1;
						ctx.fillRect(...params);
					}
				}
			}
		}
		
		
		function getColor(freq, colors) {
			let fracMargin = maxEdgeFrequency <= 3 ? 0.2 : 0;
				frac = maxEdgeFrequency < 2 ? 0.5 : fracMargin + ((freq - 1)/(maxEdgeFrequency - 1) * (1 - fracMargin * 2));
			return "rgb(" + colors[0].map((v, i) => v + (colors[1][i] - v) * frac).join(", ") + ")";
		}
	}
	
	function clearEdges() {
		ctx.fillStyle = p.bgColor;
		ctx.fillRect(0, ctx.canvas.height - 5, ctx.canvas.width, 5);
		for (let x = 0; x <= canvas.width; x += 5) {
			ctx.fillRect(x - 1, 0, 2, canvas.height);
		}
		for (let y = 0; y <= canvas.height; y += 5) {
			ctx.fillRect(0, y - 1, canvas.width, 2);
		}
	}
	
	function showInteractions() {
		for (let y in interactions) {
			for (let x in interactions[y]) {
				p.renderPos(ctx, +x, +y, {color: "#96e3f6", edges: false});
			}
		}
	}
	
	function hideInteractions() {
		for (let y in interactions) {
			for (let x in interactions[y]) {
				p.renderPos(ctx, +x, +y, {edges: false});
			}
		}
	}
	
	/*
	function collapseStates() {
		let stateGroups = {};
		
		for (let c in transitions) {
			for (let s in transitions[c]) {
				let t = transitions[c][s],
					type = c + (t.events.length ? " | " + t.events.join(" ") : "");
				
				(stateGroups[type] || (stateGroups[type] = new Set())).add(+s);
			}
		}
		
		let minSize = Object.values(stateGroups).reduce((m, g) => Math.min(m, g.size), Infinity),
			startGroup;
		
		for (let g of Object.values(stateGroups)) {
			if (g.size === minSize) startGroup = g;
		}
		
		console.log(startGroup);
		
		let groupsByMember = {},
			currentGroups = [startGroup];
		
		
	}
	*/
	
	function scanForDevice(x, y, dx, dy) {
		while (p.inProgram(x, y) && p.program[y][x] === " ") {
			x += dx;
			y += dy;
		}
		return p.inProgram(x, y) && ">Vv<^/\\".includes(p.program[y][x]);
	}
	
	function findTransitions(channel, state) {
		let {x, y, arrow} = channels[channel];
		loadState(state);
		p.x = x;
		p.y = y;
		if (arrow === ">") p.x++;
		else if (arrow === "<") p.x--;
		else if (arrow === "V") p.y++;
		else if (arrow === "^") p.y--;
		p.dir = ({">": "right", "V": "down", "<": "left", "^": "up"})[arrow];
		let prevState = state,
			events = [],
			vEdges = {},
			hEdges = {};
		if ("<>".includes(arrow)) (vEdges[p.y] = {})[p.x + (arrow === "<" ? 1 : 0)] = [+(arrow === "<"), +(arrow === ">")];
		else (hEdges[p.y + (arrow === "^" ? 1 : 0)] = {})[p.x] = [+(arrow === "^"), +(arrow === "V")];
		while (true) {
			let prevX = p.x,
				prevY = p.y;
			p.step();
			if (prevX === p.x) {
				let ey = Math.max(prevY, p.y);
				if (!(hEdges[ey] || (hEdges[ey] = {}))[p.x]) hEdges[ey][p.x] = [0, 0];
				hEdges[ey][p.x][ey === prevY ? 0 : 1]++;
			} else {
				let ex = Math.max(prevX, p.x);
				if (!(vEdges[p.y] || (vEdges[p.y] = {}))[ex]) vEdges[p.y][ex] = [0, 0];
				vEdges[p.y][ex][ex === prevX ? 0 : 1]++;
			}
			let c = getCurrentChannel();
			if (c !== null) {
				if (c === channel) {
					let s = getCurrentState();
					maxEdgeFrequency = Math.max(maxEdgeFrequency, [vEdges, hEdges].map(es => Object.values(es).map(res => Object.values(res))).flat(3).reduce((max, f) => Math.max(max, f)));
					(transitions[channel] || (transitions[channel] = {}))[prevState] = {state: s, events, vEdges, hEdges};
					if (s === state) {
						return;
					} else {
						prevState = s;
						events = [];
						vEdges = {};
						hEdges = {};
					}
				} else {
					events.push(c);
				}
			} else if (p.program[p.y][p.x] !== " ") {
				(interactions[p.y] || (interactions[p.y] = {}))[p.x] = true;
			}
		}
	}
	
	function getCurrentChannel() {
		for (let [i, {x, y}] of channels.entries()) {
			if (p.x === x && p.y === y) return i;
		}
		return null;
	}
	
	function loadState(state) {
		p.program = statesById[state].map(l => l.slice());
	}
	
	function getCurrentState() {
		let programString = p.program.flat().join("");
		if (stateIds[programString] === undefined) {
			let id = nextStateId++;
			statesById[id] = p.program.map(l => l.slice());
			return stateIds[programString] = id;
		} else {
			return stateIds[programString];
		}
	}
}

