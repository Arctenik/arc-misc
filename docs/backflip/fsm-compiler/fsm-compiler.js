

let machineInp = document.getElementById("machineInp"),
	inputInp = document.getElementById("inputInp"),
	inputSepInp = document.getElementById("inputSepInp"),
	labelSymbolsInp = document.getElementById("labelSymbolsInp"),
	compileButton = document.getElementById("compileButton"),
	errorElem = document.getElementById("errorElem"),
	resultInp = document.getElementById("resultInp");


compileButton.addEventListener("click", () => {
	errorElem.innerHTML = "";
	resultInp.value = "";
	try {
		resultInp.value = compile(machineInp.value, inputInp.value.split(inputSepInp.value), labelSymbolsInp.checked);
	} catch(e) {
		errorElem.textContent = e;
		console.error(e);
	}
	resultInp.focus();
	resultInp.select();
});


function compile(source, inputContent, includeSymbolLabels = true) {
	let [rules, states, inputSymbols, outputSymbols] = parseMachine(source),
		convertedOutputs = convertOutputs(outputSymbols),
		stateOffsets = new Set();
	
	for (let [indexA, stateA] of states.entries()) {
		for (let symbol of inputSymbols) {
			let stateB = rules[stateA]?.[symbol]?.target,
				indexB;
			
			if (stateB === undefined) {
				indexB = indexA;
			} else {
				indexB = states.indexOf(stateB);
			}
			
			let offset = (indexB - indexA + states.length)%states.length;
			stateOffsets.add(offset);
		}
	}
	
	stateOffsets = Array.from(stateOffsets).sort((a, b) => a - b);
	
	let inputTape = makeInputTape(),
		transitionModule = makeTransitionModule(inputTape);
	
	let result = inputTape.appendLeft(new Device(">", {start: [0, 0]}), inputTape.channels.in[1], "tape");
	
	result = result.appendLeft(transitionModule, result.channels.tape.pathToTrans[1] - transitionModule.channels.trans[1], null, false);
	
	result = result.appendTop("V", result.channels.start[0]);
	
	return result.toString();
	
	
	function makeInputTape() {
		let cellSymDevice = new Device(
			[
				"V ",
				"> ",
				"  "
			],
			{
				in1: [0, 1],
				out: []
			}
		);
		
		inputSymbols.forEach(name => {
			name = includeSymbolLabels ? formatString(name, false) : "";
			cellSymDevice.channels.out.push([cellSymDevice.width, 1]);
			cellSymDevice = cellSymDevice.appendRight([
				" ".repeat(name.length + 1),
				">" + " ".repeat(name.length),
				name + " "
			]);
		});
		
		cellSymDevice = cellSymDevice.appendRight([
			"<",
			"^",
			" "
		]);
		
		cellSymDevice.channels.in2 = [cellSymDevice.width - 1, 1];
		
		let cellStateDevice = makeDisposableRegister(stateOffsets.length, 6);
		
		let cell = cellSymDevice.appendLeft(
			new Device(
				[
					">\\",
					"  ",
					">\\",
					" ^",
					"  ",
					"^ "
				],
				{
					in: [0, 5],
					toTrans: [1, 0]
				}
			),
			cellSymDevice.channels.in1[1] - 2,
			"symbol"
		);
		
		cell = cell.appendRight(
			new Device(
				[
					" V",
					"V ",
					"\\\\",
					" ^"
				],
				{
					toSwap: [0, 2]
				}
			),
			cell.channels.symbol.in2[1] - 2
		);
		
		cell = cell.appendRight(cellStateDevice, 1, cell.channels.toSwap[1] - cellStateDevice.channels.read[1], null, "stateOffset");
		
		let pathSwitchModule = makePathSwitch(stateOffsets.length);
		
		cell = cell.appendBottom(pathSwitchModule, cell.channels.stateOffset.set[0][0] - pathSwitchModule.channels.a[0][0], -1, null, "pathSwitch");
		
		cell = cell.merge(new Device("<", {pathToTrans: [0, 0]}), cell.channels.toTrans[0], -1);
		
		let symbolCorner = makeMultiArrow(cell.channels.symbol.out, "<", null, 1),
			stateCorner = makeMultiArrow(stateOffsets.length, "<", 6, 1);
		
		cell = cell.appendTop(symbolCorner, cell.channels.symbol.out[0][0] - symbolCorner.channels[0][0], null, "symbolCorner");
		cell = cell.appendTop(stateCorner, cell.channels.stateOffset.out[0][0] - stateCorner.channels[0][0], null, "stateCorner");
		
		cell = addBoundary(
			cell,
			[
				[cell.channels.in],
				[cell.channels.pathToTrans],
				cell.channels.symbolCorner,
				cell.channels.stateCorner,
				cell.channels.pathSwitch.in
			],
			1
		);
		
		let cellChannels = cell.channels;
		
		cell.channels = {};
		
		let tape = new Device();
		
		for (let s of inputContent) {
			let index = inputSymbols.indexOf(s);
			if (index === -1) throw new Error("Invalid input symbol " + JSON.stringify(s));
			tape = tape.appendRight(cell.merge("^", ...cellChannels.symbol.out[index]), -1, 0);
		}
		
		tape.channels = cellChannels;
		
		return tape;
	}
	
	function makeDisposableRegister(n, spacing = 3) {
		let alternator = new Device([
				" V<",
				"^ /",
				" >^",
			]),
			result = new Device(
				[],
				{
					set: [],
					read: [0, 1],
					out: []
				}
			);
		
		for (let i = 0; i < n; i++) {
			result = result.appendRight(alternator, i ? spacing - 3 : 0, 1 - i%2);
			result.channels.set.push([result.width - 2, 3]);
			result.channels.out.push([result.width - 3, 0]);
		}
		
		result = result.appendRight("<", 1 + n%2);
		
		return result;
	}
	
	function makePathSwitch(n) {
		let switchDevice = new Device(
				[
					"   >\\<",
					"   ^< ",
					"      ",
					" VV V ",
					">// \\<",
					"  >  V",
					"^ ^  /",
					"     ^",
					">\\ \\/<",
					" ^ ^^ "
				]
			),
			result = new Device(
				[
					"> \\   ",
					"   >\\<",
					"   ^< ",
					" VV V ",
					">// \\<",
					"  >  V",
					"^ ^  /",
					"     ^",
					">\\ \\/<",
					" ^ ^^ "
				],
				{
					switch: [2, 0],
					in: [[0, 6]],
					a: [[4, 0]]
				}
			);
		
		for (let i = 1; i < n; i++) {
			result = result.appendRight(switchDevice, result.height - 6);
			result = result.appendRight("\\", -4, 0);
			result.channels.in.push([0, result.height - 4]);
			result.channels.a.push([result.width - 2, 0]);
		}
		
		return result;
	}
	
	
	function makeTransitionModule(inputTape) {
		let filterArray = new Device([], {filter: []});
		
		for (let state of states) {
			let filter = makeSymbolFilter(state);
			filterArray = filterArray.appendRight(filter, null, "filter");
		}
		
		filterArray = filterArray.appendLeft(" ");
		
		for (let [, y] of filterArray.channels.filter[0].toggle) {
			filterArray = filterArray.appendLeft(">", 1, y);
		}
		
		let stateModule = makeStateModule(filterArray);
		
		let result = stateModule.appendBottom(filterArray, stateModule.channels.out[0][0] - filterArray.channels.filter[0].in[0], "state");
		
		let replicatorArray = new Device([], {io: []});
		
		for (let offset of stateOffsets) {
			replicatorArray = replicatorArray.appendRight(makeOffsetReplicator(offset));
		}
		
		result = result.appendRight(replicatorArray, result.channels.state.in[1] - replicatorArray.channels.io[0][1], null, "update");
		
		result = result.appendRight(makeMultiArrow(inputSymbols.length, "<", 1, 2), result.channels.filter[0].toggle[0][1], null, "symbolCornerB");
		
		result = result.appendTop(new Device("V", {trans: [0, 0]}), result.channels.state.in[0]);
		
		result = result.appendTop(makeMultiArrow(inputSymbols.length, "V"), result.channels.symbolCornerB[0][0], null, "symbolCornerA");
		
		result = result.appendTop(makeMultiArrow(stateOffsets.length, "V", 3), result.channels.update.io[0][0], null, "updateCorner");
		
		let outCornerA = makeMultiArrow(stateOffsets.length, "^"),
			outCornerB = makeMultiArrow(stateOffsets.length, ">", 1, (inputTape.channels.pathSwitch.in[1]?.[1] || 0) - inputTape.channels.pathSwitch.in[0][1]);
		
		result = result.appendRight(outCornerB, result.channels.trans[1] + (inputTape.channels.pathSwitch.in[0][1] - inputTape.channels.pathToTrans[1]), null, "outCornerB");
		
		result = result.appendBottom(outCornerA, result.channels.outCornerB[0][0], null, "outCornerA");
		
		for (let f of result.channels.filter) {
			for (let [i, [x]] of f.out.entries()) {
				let offset = f.outOffset[i].value,
					y = result.channels.outCornerA[stateOffsets.indexOf(offset)][1];
				
				result = result.merge(">", x, y);
			}
		}
		
		result = addBoundary(
			result,
			[
				[result.channels.trans],
				result.channels.symbolCornerA,
				result.channels.updateCorner,
				result.channels.outCornerB
			],
			1,
			false
		);
		
		return result;
	}
	
	function makeSymbolFilter(state) {
		let toggleUnit = new Device(
				[
					"V    ",
					"\\    ",
					" VVV ",
					">//\\<",
					">\\ /<",
					" ^ ^ ",
					"  >V ",
					" >\\< "
				]
			),
			result = new Device([], {out: [], outOffset: []});
		
		for (let symbol of inputSymbols) {
			result = result.appendRight(toggleUnit);
			let outputDevice = makeOutputDevice(state, symbol);
			result = result.merge(outputDevice, result.width - 3 - outputDevice.channels.out[0], toggleUnit.height - 1)
		}
		
		result = result.appendRight("<", -4, 1);
		result = result.appendLeft(">", 1);
		
		result.channels.in = [0, 1];
		
		let toggleArray = new Device([], {toggle: []});
		
		for (let i = 0; i < inputSymbols.length; i++) {
			toggleArray = toggleArray.merge(new Device(["V", "/"], {toggle: [0, 1]}), i * toggleUnit.width, i * 2);
		}
		
		result = result.appendTop(toggleArray, 3);
		
		return result;
	}
	
	function makeOutputDevice(state, symbol) {
		let {target, output} = rules[state]?.[symbol] || {target: state};
		output = output ? convertedOutputs[outputSymbols.indexOf(output)] : [];
		
		let result = new Device("   ", {outOffset: {value: (states.length + states.indexOf(target) - states.indexOf(state))%states.length}});
		
		if (output.length) {
			for (let c of output) {
				result = result.appendBottom(">\\" + c);
			}
		}
		
		result.channels.out = [1, result.height - 1];
		
		return result;
	}
	
	function makeStateModule(filterArray) {
		let unit = new Device(
				[
					"<     ",
					"/\\    ",
					"      ",
					"      ",
					"   V  ",
					"   \\  ",
					"  VVV ",
					" >//\\<",
					" >\\ /<",
					"  ^ ^ ",
					"   >V ",
					"  >\\< "
				],
				{
					out: [3, 11]
				}
			),
			result = new Device([], {out: []});
		
		let prevX;
		
		for (let {in: [x]} of filterArray.channels.filter) {
			let d = prevX === undefined ? unit.width : x - prevX;
			result = result.merge(unit, result.width - unit.width + d, 0);
			prevX = x;
		}
		
		result = result.merge(["V", "\\"], 0, 0);
		
		result = result.appendRight("<", -2, 5);
		
		result = result.appendRight(
			[
				"V ",
				"\\<",
				"/<",
				"^ "
			],
			-4, 0
		);
		
		result = result.appendLeft(
			new Device(
				[
					"V  /<",
					"V  \\<",
					"   V ",
					"  V  ",
					" >/  ",
					" >\\  ",
					"  ^  ",
					"     ",
					">    "
				],
				{
					in: [3, 2]
				}
			),
			2, -3
		);
		
		return result;
	}
	
	function makeOffsetReplicator(offset) {
		offset = (states.length + offset - 1)%states.length; // counter has already been advanced once by the read
		if (offset === 0) return new Device(["   ", " ^ "], {io: [1, 0]});
		if (offset === 1) return new Device(" < ", {io: [1, 0]});
		let result = new Device("<  ", {io: [1, 0]});
		for (let i = 1; i < offset; i += 2) {
			result = result.appendBottom("^/V");
		}
		result = result.appendBottom("^<<");
		if (offset%2 === 0) result = result.merge("<", 2, 1);
		return result;
	}
	
	
	function addBoundary(device, hChannelArrays, topPadding = 0, includeChannelsLeft = true) {
		let result = new Device(device.width + 2, device.height + 2 + topPadding, "#");
		if (topPadding) result = result.merge(new Device(device.width, topPadding), false, 1, 1);
		result = result.merge(device, false, 1, 2);
		
		hChannelArrays.forEach(channels => {
			channels.forEach(([, y]) => {
				y += topPadding + 1;
				if (includeChannelsLeft) result = result.merge(" ", false, 0, y);
				result = result.merge(" ", false, result.width - 1, y);
			});
		});
		
		return result;
	}
	
	function makeMultiArrow(basis, arrow, hSpacing, vSpacing) {
		arrow = arrow.toUpperCase();
		
		let n;
		
		if (typeof basis === "number") {
			n = basis;
			if (typeof hSpacing !== "number") hSpacing = 1;
			if (typeof vSpacing !== "number") vSpacing = 1;
		} else {
			n = basis.length;
		}
		
		let xIntervals;
		if (typeof hSpacing === "number") xIntervals = (new Array(n - 1)).fill(hSpacing);
		else {
			xIntervals = [];
			for (let i = 1; i < n; i++) {
				xIntervals.push(basis[i][0] - basis[i - 1][0]);
			}
		}
		
		let yIntervals;
		if (typeof vSpacing === "number") yIntervals = (new Array(n - 1)).fill(vSpacing);
		else {
			yIntervals = [];
			for (let i = 1; i < n; i++) {
				yIntervals.push(basis[i][1] - basis[i - 1][1]);
			}
		}
		
		let result = new Device([], []);
		
		for (let i = 0, x = 0, y = 0; i < n; x += xIntervals[i], y += yIntervals[i], i++) {
			result = result.merge(arrow, x, y);
			result.channels.push([result.width - 1, result.height - 1]);
		}
		
		return result;
	}
}

function convertOutputs(symbols) {
	if (symbols.every(s => /^[\d\n]*$/.test(s))) {
		return symbols.map(s => Array.from(s, c => c === "\n" ? "N" : c));
	} else {
		return symbols.map(s => Array.from(s, c => [Array.from(c.codePointAt(0).toString()), "N"]).flat(2));
	}
}


function Device(...args) {
	if (typeof args[0] === "number") {
		let [width, height] = args,
			fillChar = " ",
			channels;
		
		if (typeof args[2] === "string") {
			fillChar = args[2];
			channels = args[3];
		} else {
			channels = args[2];
		}
		
		this.pattern = (new Array(height)).fill(fillChar.repeat(width));
		this.channels = channels || {};
	} else {
		let [pattern = [], channels = {}] = args;
		if (typeof pattern === "string") pattern = [pattern];
		let width = pattern.reduce((w, l) => Math.max(w, l.length), 0);
		pattern = pattern.map(l => l.padEnd(width, " "));
		this.pattern = pattern;
		this.channels = channels;
	}
}

Device.prototype = {
	get width() {
		return this.pattern[0]?.length || 0;
	},
	get height() {
		return this.pattern.length;
	},
	ref(x, y) {
		return this.pattern[y][x];
	},
	appendLeft(other, ...restArgs) {
		return this.merge(
			other,
			(offsets, other) => [(offsets[offsets.length - 2] || 0) - other.width, ...offsets.slice(offsets.length - 1)],
			...restArgs
		);
	},
	appendRight(other, ...restArgs) {
		return this.merge(
			other,
			offsets => [(offsets[offsets.length - 2] || 0) + this.width, ...offsets.slice(offsets.length - 1)],
			...restArgs
		);
	},
	appendTop(other, ...restArgs) {
		return this.merge(
			other,
			(offsets, other) => [offsets[0] || 0, (offsets[1] || 0) - other.height],
			...restArgs
		);
	},
	appendBottom(other, ...restArgs) {
		return this.merge(
			other,
			offsets => [offsets[0] || 0, (offsets[1] || 0) + this.height],
			...restArgs
		);
	},
	merge(other, ...restArgs) { // merges other on top
		if (!(other instanceof Device)) other = new Device(other);
		
		let spaceIsEmpty = true,
			processOffsets,
			offsetArgs = [],
			nameArgs,
			i = 0;
		
		if (typeof restArgs[i] === "boolean") {
			spaceIsEmpty = restArgs[i++];
		}
		
		if (typeof restArgs[i] === "function") {
			processOffsets = restArgs[i++];
		}
		
		while (typeof restArgs[i] === "number") {
			offsetArgs.push(restArgs[i++]);
		}
		
		nameArgs = restArgs.slice(i);
		
		if (processOffsets) offsetArgs = processOffsets(offsetArgs, other);
		
		let [xOffset = 0, yOffset = 0] = offsetArgs,
			[thisName, otherName] = nameArgs,
			minX = Math.min(xOffset, 0),
			minY = Math.min(yOffset, 0),
			maxX = Math.max(xOffset + other.width, this.width),
			maxY = Math.max(yOffset + other.height, this.height),
			overlapDivisions = getOverlapDivisions.call(this),
			resultPattern = [];
		
		for (let y = minY; y < maxY; y++) {
			let thisLine = this.pattern[y],
				otherLine = other.pattern[y - yOffset];
			
			if (thisLine === undefined && otherLine === undefined) {
				resultPattern.push(" ".repeat(maxX - minX));
			} else if (thisLine !== undefined && otherLine !== undefined) {
				resultPattern.push(overlapDivisions.map(d => {
					if (d.line === "both") {
						return mergeSections(thisLine.substring(...d.thisBounds), otherLine.substring(...d.otherBounds));
					} else if (d.line === "none") {
						return " ".repeat(d.length);
					} else {
						let line = d.line === "this" ? thisLine : otherLine;
						return line.substring(...d.bounds);
					}
				}).join(""));
			} else {
				let line, lineLeft;
				if (otherLine === undefined) {
					line = thisLine;
					lineLeft = 0;
				} else {
					line = otherLine;
					lineLeft = xOffset;
				}
				resultPattern.push(" ".repeat(lineLeft - minX) + line + " ".repeat(maxX - (lineLeft + line.length)));
			}
		}
		
		let thisResultChannels = thisName !== false && this.mapChannels(([x, y]) => [x - minX, y - minY]),
			otherResultChannels = otherName !== false && other.mapChannels(([x, y]) => [x + xOffset - minX, y + yOffset - minY]);
		
		if (thisName) thisResultChannels = {[thisName]: thisResultChannels};
		if (otherName) otherResultChannels = {[otherName]: otherResultChannels};
		
		let resultChannels = thisName === false ? (otherName === false ? {} : otherResultChannels) : (otherName === false ? thisResultChannels : mergeChannels(thisResultChannels, otherResultChannels));
		
		return new Device(resultPattern, resultChannels);
		
		
		function getOverlapDivisions() {
			if ((yOffset <= 0 && 0 <= yOffset + other.height) || (0 <= yOffset && yOffset <= this.height)) {
				let thisLeft = 0,
					thisRight = this.width,
					otherLeft = xOffset,
					otherRight = xOffset + other.width,
					bothBounds = new Set();
				
				if (otherLeft <= thisLeft && thisLeft <= otherRight) {
					bothBounds.add(thisLeft);
				}
				if (otherLeft <= thisRight && thisRight <= otherRight) {
					bothBounds.add(thisRight);
				}
				if (thisLeft <= otherLeft && otherLeft <= thisRight) {
					bothBounds.add(otherLeft);
				}
				if (thisLeft <= otherRight && otherRight <= thisRight) {
					bothBounds.add(otherRight);
				}
				
				bothBounds = Array.from(bothBounds).sort((a, b) => a - b);
				
				let allBounds = [];
				
				if (bothBounds.length === 2) {
					allBounds.push(["both", bothBounds]);
					if (thisLeft < bothBounds[0]) {
						allBounds.push(["this", [thisLeft, bothBounds[0]]]);
					}
					if (thisRight > bothBounds[1]) {
						allBounds.push(["this", [bothBounds[1], thisRight]]);
					}
					if (otherLeft < bothBounds[0]) {
						allBounds.push(["other", [otherLeft, bothBounds[0]]]);
					}
					if (otherRight > bothBounds[1]) {
						allBounds.push(["other", [bothBounds[1], otherRight]]);
					}
				} else {
					allBounds.push(
						["this", [thisLeft, thisRight]],
						["other", [otherLeft, otherRight]]
					);
				}
				
				let result = [],
					prevEnd = minX;
				
				for (let [type, [start, end]] of allBounds.sort(([, [a]], [, [b]]) => a - b)) {
					if (start !== prevEnd) result.push({line: "none", length: start - prevEnd});
					if (start !== end) {
						if (type === "this") result.push({line: "this", bounds: [start, end]});
						else if (type === "other") result.push({line: "other", bounds: [start - xOffset, end - xOffset]});
						else result.push({line: "both", thisBounds: [start, end], otherBounds: [start - xOffset, end - xOffset]});
					}
					prevEnd = end;
				}
				
				return result;
			}
		}
		
		function mergeSections(a, b) {
			if (spaceIsEmpty) return (Array.from(b, (c, i) => c === " " ? a[i] : c)).join("");
			else return b;
		}
		
		function mergeChannels(a, b) {
			if (isEmptyChannel(a)) return b;
			if (isEmptyChannel(b)) return a;
			if (Array.isArray(a) && typeof a[0] !== "number") {
				return a.concat([b]);
			}
			if ((a && typeof a === "object" && !Array.isArray(a)) && (b && typeof b === "object" && !Array.isArray(b))) {
				let result = {};
				for (let key of new Set(Object.keys(a).concat(Object.keys(b)))) {
					result[key] = mergeChannels(a[key], b[key]);
				}
				return result;
			}
			return b;
		}
		
		function isEmptyChannel(v) {
			return v === undefined || (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);
		}
	},
	mapChannels(f) {
		return map(this.channels);
		
		function map(obj) {
			if (Array.isArray(obj)) {
				if (typeof obj[0] === "number") {
					return f(obj);
				} else {
					return obj.map(item => map(item));
				}
			} else if (obj && typeof obj === "object") {
				let result = {};
				for (let k in obj) {
					result[k] = map(obj[k]);
				}
				return result;
			} else {
				return obj;
			}
		}
	},
	logInfo(f = (...args) => console.log(...args)) {
		f(this.channels);
		f(this.pattern.join("\n"));
	},
	toString(lineEnding = "\n") {
		return this.pattern.join(lineEnding);
	}
};


function formatString(s, requireQuotes = true) {
	let result = Array.from(s).map(c => {
		if (c === "\\") return "\\\\";
		else if (c === "\"") return "\\\"";
		else if (c === "\n") return "\\n";
		else if (c === "\r") return "\\r";
		else if (c === "\t") return "\\t";
		else {
			let code = c.codePointAt(0);
			if ((0 <= code && code <= 31) || (127 <= code && code <= 159)) {
				return "\\u" + code.toString(16) + ";";
			} else {
				return c;
			}
		}
	}).join("");
	if (requireQuotes || /["\\\s\x00-\x1f\x7f-\x9f]/.test(s)) {
		result = "\"" + result + "\"";
	}
	return result;
}

function parseMachine(def) {
	let rules = {},
		states = [],
		targetStates = [],
		inputSymbols = [],
		outputSymbols = [];
	
	def.split(/\r\n|[\r\n]/).map((line, i) => {
		let trimmed = line.trim();
		if (trimmed && trimmed[0] !== "#") {
			let values = [];
			for (let i = 0, val; i < trimmed.length; ) {
				[val, i] = parseString(trimmed, i);
				values.push(val);
			}
			if (values.length === 3 || values.length === 4) {
				let [st, sym, st2, out] = values;
				
				if (!states.includes(st)) states.push(st);
				if (!targetStates.includes(st2)) targetStates.push(st2);
				if (!inputSymbols.includes(sym)) inputSymbols.push(sym);
				if (out !== undefined && !outputSymbols.includes(out)) outputSymbols.push(out);
				
				(rules[st] || (rules[st] = {}))[sym] = {target: st2, output: out};
			} else {
				throw new Error("Invalid line " + (i + 1) + " in machine");
			}
		}
	});
	
	targetStates.forEach(st => {
		if (!states.includes(st)) states.push(st);
	});
	
	return [rules, states, inputSymbols, outputSymbols];
	
	
	function parseString(text, i) {
		let expr = /\s*(?:"((?:\\.|[^\\"])*)"|([^\s]+))/g;
		expr.lastIndex = i;
		
		let match = expr.exec(text),
			content = match[2] || match[1],
			result = content.replace(/\\(?:([^u])|(u)([0-9a-fA-F]+;)?)/, (s, code, u, hex) => {
				if (hex) {
					return String.fromCodePoint(parseInt(hex, 16));
				} else {
					code = code || u;
					if (code === "n") return "\n";
					else if (code === "r") return "\r";
					else if (code === "t") return "\t";
					else return code;
				}
			});
		
		return [result, i + match[0].length];
	}
}

