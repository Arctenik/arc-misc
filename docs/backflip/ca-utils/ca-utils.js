

let programInp = document.getElementById("programInp"),
	patternInp = document.getElementById("patternInp"),
	toPatternButton = document.getElementById("toPatternButton"),
	includeVerticesInp = document.getElementById("includeVerticesInp"),
	includePointerInp = document.getElementById("includePointerInp"),
	toProgramButton = document.getElementById("toProgramButton");

let stateCodes = {
		0: ".",
		1: "A",
		2: "B",
		3: "C",
		4: "D",
		5: "E"
	},
	symbols = {
		"/": [
			3, 0, 4,
			0, 4, 0,
			4, 0, 3,
		],
		"\\": [
			4, 0, 3,
			0, 4, 0,
			3, 0, 4,
		],
		">": [
			3, 3, 4,
			3, 3, 4,
			3, 3, 4,
		],
		"<": [
			4, 3, 3,
			4, 3, 3,
			4, 3, 3,
		],
		"^": [
			4, 4, 4,
			3, 3, 3,
			3, 3, 3,
		],
		"V": [
			3, 3, 3,
			3, 3, 3,
			4, 4, 4,
		],
		"v": [
			3, 3, 3,
			3, 3, 3,
			4, 4, 4,
		],
		other: [
			4, 4, 4,
			4, 0, 4,
			4, 4, 4,
		]
	};


toPatternButton.addEventListener("click", () => {
	if (programInp.value) {
		patternInp.value = toPattern(programInp.value);
		patternInp.focus();
		patternInp.select();
	}
});

toProgramButton.addEventListener("click", () => {
	if (patternInp.value) {
		programInp.value = toProgram(patternInp.value);
		programInp.focus();
		programInp.select();
	}
});


function toPattern(text) {
	let program = text.split(/\r\n|\r|\n/).map(l => Array.from(l)),
		width = program.reduce((max, line) => Math.max(max, line.length), -Infinity),
		height = program.length,
		cw, ch,
		xOffset, yOffset;
	
	if (includeVerticesInp.checked) {
		cw = width * 5 + 12;
		ch = height * 5 + 12;
		xOffset = 7;
		yOffset = 7;
	} else {
		cw = width * 5 - 2;
		ch = height * 5 - 2;
		xOffset = 0;
		yOffset = 0;
		if (includePointerInp.checked) {
			cw += 4;
			xOffset += 4;
		}
	}
	
	let cells = (new Array(ch)).fill(0).map(() => (new Array(cw).fill(0)));
	
	if (includeVerticesInp.checked) {
		for (let y = 0; y < ch; y += 5) {
			for (let x = 0; x < cw; x += 5) {
				cells[y][x] = 5;
				cells[y + 1][x] = 5;
				cells[y + 1][x + 1] = 5;
				cells[y][x + 1] = 5;
			}
		}
	}
	
	if (includePointerInp.checked) {
		cells[yOffset + 1][xOffset - 3] = 1;
		cells[yOffset + 1][xOffset - 4] = 2;
	}
	
	for (let [y, line] of program.entries()) {
		let cy = yOffset + y * 5;
		for (let [x, c] of line.entries()) {
			let cx = xOffset + x * 5;
			if (c !== " ") {
				let p = symbols[c] || symbols.other;
				for (let py = 0; py < 3; py++) {
					for (let px = 0; px < 3; px++) {
						cells[cy + py][cx + px] = p[py * 3 + px];
					}
				}
			}
		}
	}
	
	let result = `x = ${cw}, y = ${ch}, rule = BackFlip5S\n`;
	
	let adjustedCells = cells.map(line => {
		line = line.slice();
		while (line[line.length - 1] === 0) line.pop();
		return line;
	});
	
	for (let i = 0; i < adjustedCells.length; ) {
		let endCount = 0;
		if (adjustedCells[i].length) {
			let line = adjustedCells[i],
				runCounts = [],
				runStates = [];
			
			for (let s of line) {
				if (s === runStates[runStates.length - 1]) {
					runCounts[runCounts.length - 1]++;
				} else {
					runStates.push(s);
					runCounts.push(1);
				}
			}
			
			result += runStates.map((s, j) => (runCounts[j] === 1 ? "" : runCounts[j]) + stateCodes[s]);
			
			endCount++;
			i++;
		}
		while (i < adjustedCells.length && adjustedCells[i].length === 0) {
			endCount++;
			i++;
		}
		result += "$".repeat(endCount);
	}
	
	return result;
}

function toProgram(text) {
	let pattern = parseRle(text),
		startX, startY;
	
	for (let [y, row] of pattern.entries()) {
		let threeIndex = row.indexOf(3),
			fourIndex = row.indexOf(4),
			x = null;
		
		if (threeIndex === -1) {
			if (fourIndex !== -1) x = fourIndex;
		} else if (fourIndex === -1) {
			x = threeIndex;
		} else {
			x = Math.min(threeIndex, fourIndex);
		}
		
		if (x !== null) {
			startX = x;
			startY = y;
			break;
		}
	}
	
	startX = startX%5;
	startY = startY%5;
	
	let width = Math.floor((pattern[0].length - startX + 2)/5),
		height = Math.floor((pattern.length - startY + 2)/5),
		resultRows = [];
	
	for (let ry = 0; ry < height; ry++) {
		let row = "";
		for (let rx = 0; rx < width; rx++) {
			row += matchSymbol(startX + rx * 5, startY + ry * 5);
		}
		resultRows.push(row);
	}
	
	return resultRows.join("\n");
	
	
	function matchSymbol(x, y) {
		for (let [s, cells] of Object.entries(symbols)) {
			let isMatch = true,
				hasSymbol = false;
			for (let sy = 0; sy < 3 && isMatch; sy++) {
				for (let sx = 0; sx < 3; sx++) {
					let matchState = cells[sy * 3 + sx],
						sourceState = pattern[y + sy][x + sx];
					
					if (sourceState === 3 || sourceState === 4) {
						hasSymbol = true;
						if (sourceState !== matchState) {
							isMatch = false;
							break;
						}
					}
				}
			}
			if (isMatch && hasSymbol) return s === "other" ? "0" : s;
		}
		return " ";
	}
}

function parseRle(text) {
	let lines = text.split(/\r\n|[\r\n]/).filter(line => line && line[0] !== "#"),
		dimensionsMatch = /^x=(\d+),y=(\d+)/.exec((lines[0] || "").replace(/\s+/g, ""));
	
	if (!dimensionsMatch) throw new Error("Invalid first line in RLE");
	
	let width = +dimensionsMatch[1],
		height = +dimensionsMatch[2],
		cellData = lines.slice(1).join(""),
		pattern = [[]];
	
	for (let i = 0; i < cellData.length; ) {
		let n = "";
		while (/\d/.test(cellData[i])) {
			n += cellData[i++];
		}
		n = +(n || 1);
		if (i < cellData.length) {
			let stateOffset = 1,
				v = cellData.codePointAt(i) - 111;
			if (1 <= v && v <= 10) {
				stateOffset += 24 * v;
				i++;
			}
			if (i < cellData.length) {
				if (cellData[i] === "$") {
					for (let j = 0; j < n; j++) {
						pattern.push([]);
					}
				} else {
					let state;
					if (cellData[i] === "b" || cellData[i] === ".") state = 0;
					else if (cellData[i] === "o") state = 1;
					else state = cellData.codePointAt(i) - 65 + stateOffset;
					for (let j = 0; j < n; j++) {
						pattern[pattern.length - 1].push(state);
					}
				}
				i++;
			}
		}
	}
	
	if (pattern[pattern.length - 1].length === 0) pattern.pop();
	
	while (pattern.length < height) pattern.push([]);
	
	let resultWidth = pattern.reduce((max, row) => Math.max(max, row.length), width);
	
	pattern = pattern.map(row => row.concat((new Array(resultWidth - row.length)).fill(0)));
	
	return pattern;
}

