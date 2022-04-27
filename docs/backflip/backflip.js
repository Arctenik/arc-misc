(function(cb) {
	
	let paddingSym = Symbol("padding"),
		transitionsSideA = [
			["right", "r"], ["right", "d"], ["right", "l"], ["right", "u"], ["right", "ru"], ["right", "rd"],
			["down", "r"],  ["down", "d"],  ["down", "l"],  ["down", "u"],  ["down", "ru"],  ["down", "rd"],
			["left", "r"],  ["left", "d"],  ["left", "l"],  ["left", "u"],  ["left", "ru"],  ["left", "rd"],
			["up", "r"],    ["up", "d"],    ["up", "l"],    ["up", "u"],    ["up", "ru"],    ["up", "rd"]
		],
		transitionsSideB = [
			["right", "l"], ["down", "l"],  ["left", "l"],  ["up", "l"],    ["up", "rd"],    ["down", "ru"],
			["right", "u"], ["down", "u"],  ["left", "u"],  ["up", "u"],    ["left", "rd"],  ["right", "ru"],
			["right", "r"], ["down", "r"],  ["left", "r"],  ["up", "r"],    ["down", "rd"],  ["up", "ru"],
			["right", "d"], ["down", "d"],  ["left", "d"],  ["up", "d"],    ["right", "rd"], ["left", "ru"]
		],
		transitionsA = {},
		transitionsB = {};
	
	transitionsSideA.forEach(([da, sa], i) => {
		let [db, sb] = transitionsSideB[i];
		(transitionsA[da] || (transitionsA[da] = {}))[sa] = [db, sb];
		(transitionsB[db] || (transitionsB[db] = {}))[sb] = [da, sa];
	});
	
	
	function BackFlip(text, opts) {
		Object.assign(this, applyDefaults(opts, {
			backSize: 1,
			stepSize: 1,
			delay: 100,
			padding: 0, // can also be an array, in a format modeled after the CSS "padding" property
			fgColor: "black",
			bgColor: "white",
			widthMode: "error", // "error", "truncate", "pad"
			doOutput: true,
			output: s => console.log(s),
			unoutput: null,
			unknownSymbolMode: "ignore", // "ignore", "rebound", "error"
			symbols: {
				r: ">",
				d: "Vv",
				l: "<",
				u: "^",
				ru: "/",
				rd: "\\",
				nop: " "
			},
			outputSymbols: {
				"0": "0",
				"1": "1",
				"2": "2",
				"3": "3",
				"4": "4",
				"5": "5",
				"6": "6",
				"7": "7",
				"8": "8",
				"9": "9",
				"N": "\n"
			},
			font: {
				">": " # "
				   + "  #"
				   + " # ",
				
				"V": "   "
				   + "# #"
				   + " # ",
				
				"v": "   "
				   + "# #"
				   + " # ",
				
				"<": " # "
				   + "#  "
				   + " # ",
				
				"^": " # "
				   + "# #"
				   + "   ",
				
				"/": "  #"
				   + " # "
				   + "#  ",
				
				"\\":"#  "
					+" # "
					+"  #",
				
				"0": "###"
				   + "# #"
				   + "###",
				
				"1": "## "
				   + " # "
				   + "###",
				
				"2": "## "
				   + " # "
				   + " ##",
				
				"3": "###"
				   + " ##"
				   + "###",
				
				"4": "# #"
				   + "###"
				   + "  #",
				
				"5": " ##"
				   + " # "
				   + "## ",
				
				"6": "#  "
				   + "## "
				   + "## ",
				
				"7": " ##"
				   + "  #"
				   + "  #",
				
				"8": " ##"
				   + " ##"
				   + " ##",
				
				"9": " ##"
				   + " ##"
				   + "  #",
				
				"N": "## "
				   + "# #"
				   + "# #",
				
				" ": "   "
				   + "   "
				   + "   ",
				
				"..":"###"
					+"###"
					+"###"
			}
		}));
		
		this.frame = 0;
		this.running = false;
		this.stopping = false;
		
		let lines = text.split(/\r\n|[\r\n]/),
			maxWidth = lines.reduce((max, line) => Math.max(max, line.length), -Infinity);
		
		if (this.widthMode === "error") {
			if (maxWidth > lines[0].length) throw new Error("First line shorter than subsequent lines");
		} else if (this.widthMode === "truncate") {
			lines = lines.map(l => l.substring(0, lines[0].length));
			maxWidth = lines[0].length;
		}
		
		this.program = lines.map(l => Array.from(l.padEnd(maxWidth, this.symbols.nop[0])));
		this.x = 0;
		this.y = 0;
		this.dir = "right";
		this.frame = 0;
	}
	
	BackFlip.prototype = {
		set padding(padding) {
			if (!(Array.isArray(padding) && padding.length >= 4)) {
				if (Array.isArray(padding)) {
					if (padding.length === 1) padding = (new Array(4)).fill(padding[0]);
					else if (padding.length === 2) padding = [padding[0], padding[1], padding[0], padding[1]];
					else if (padding.length === 3) padding = [padding[0], padding[1], padding[2], padding[1]];
					else padding = [0, 0, 0, 0];
				} else {
					padding = (new Array(4)).fill(padding);
				}
			}
			this[paddingSym] = padding;
		},
		get padding() {
			return this[paddingSym];
		},
		
		getText() {
			return this.program.map(l => l.join("")).join("\n");
		},
		stopRunning() {
			if (this.getRunning()) this.toggleRun();
		},
		getRunning() {
			return this.running && !this.stopping;
		},
		toggleRun(ctx, cbs) {
			if (this.running && !this.stopping) {
				this.stopping = true;
				return false;
			} else if (this.stopping) {
				this.stopping = false;
				return true;
			} else {
				let lastFrame,
					func = t => {
						if (this.stopping) {
							this.finishStop(cbs);
							return;
						}
						let updated = false,
							halted = false;
						
						if (lastFrame) {
							let d = t - lastFrame,
								changedCoords = new Set(),
								frameStart = Date.now();
							for (let i = this.delay; i <= d; i += this.delay) {
								let c = this.bigStep(1, ctx);
								if (c) {
									for (let v of c) changedCoords.add(v);
								} else {
									halted = true;
								}
								if (Date.now() - frameStart > d) break; // idk how good this is for managing framerate but it seems to kind of work?
							}
							if (d >= this.delay) updated = true;
							for (v of changedCoords) this.renderPos(ctx, v);
						} else {
							halted = !this.bigStep(1, ctx);
							updated = true;
						}
						if (updated) {
							if (cbs?.update) cbs.update();
							lastFrame = t;
						}
						if (halted) this.toggleRun();
						if (this.getRunning()) requestAnimationFrame(func);
						else this.finishStop(cbs);
					};
				
				this.running = true;
				
				requestAnimationFrame(func);
				
				return true;
			}
		},
		finishStop(cbs) {
			this.running = false;
			this.stopping = false;
			if (cbs?.stop) cbs.stop();
		},
		bigStep(stepDir = 1, ctx) {
			let size = stepDir > 0 ? this.stepSize : this.backSize,
				changedCoords = new Set();
			
			for (let i = 0; i < size; i++) {
				let c = this.step(stepDir);
				if (c) c.forEach(v => changedCoords.add(v));
				else break;
			};
			
			if (ctx) {
				for (let v of changedCoords) {
					this.renderPos(ctx, v);
				}
			}
			
			return changedCoords.size > 0 ? changedCoords : false;
		},
		step(stepDir = 1, ctx) {
			let moved = false,
				prevX = this.x,
				prevY = this.y;
			
			if (stepDir < 0 && (this.inProgram() || this.facingProgram(stepDir))) {
				this.move(stepDir);
				moved = true;
			}
			
			if (this.inProgram()) {
				let c = this.program[this.y][this.x],
					command,
					output = this.outputSymbols[c];
				
				for (let name in this.symbols) {
					if (this.symbols[name].includes(c)) {
						command = name;
						break;
					}
				}
				
				if (command === undefined && output === undefined) {
					if (this.unknownSymbolMode === "error") {
						throw new Error("Invalid character " + JSON.stringify(c));
					} else if (this.unknownSymbolMode === "rebound") {
						command = "rebound";
					}
				}
				
				let newState = (stepDir < 0 ? transitionsB : transitionsA)[this.dir]?.[command];
				
				if (newState) {
					this.program[this.y][this.x] = this.symbols[newState[1]][0];
					this.dir = newState[0];
				} else if (command === "rebound" || output !== undefined) {
					this.dir = ({"right": "left", "down": "up", "left": "right", "up": "down"})[this.dir];
					if (output !== undefined) {
						if (stepDir > 0) {
							if (this.output) this.output(output);
						} else {
							if (this.unoutput) this.unoutput(output);
						}
					}
				}
				
				if (stepDir > 0) {
					this.move(stepDir);
					moved = true;
				}
			} else if (this.facingProgram(stepDir) && stepDir > 0) {
				this.move(stepDir);
				moved = true;
			}
			
			if (moved) {
				if (ctx) {
					this.renderPos(ctx, prevX, prevY);
					this.renderPos(ctx, this.x, this.y);
				}
				
				this.frame += stepDir;
				
				let result = [];
				if (this.inProgram(prevX, prevY)) result.push(prevY * this.program[0].length + prevX);
				if (this.inProgram(this.x, this.y)) result.push(this.y * this.program[0].length + this.x);
				return result;
			} else {
				return false;
			}
		},
		move(stepDir) {
			if (this.dir === "right") this.x += stepDir;
			else if (this.dir === "down") this.y += stepDir;
			else if (this.dir === "left") this.x -= stepDir;
			else if (this.dir === "up") this.y -= stepDir;
		},
		inProgram(qx = this.x, qy = this.y) {
			return 0 <= qx && qx < this.program[0].length && 0 <= qy && qy < this.program.length;
		},
		facingProgram(stepDir = 1) {
			if (this.x < 0) return stepDir > 0 ? this.dir === "right" : this.dir === "left";
			if (this.x >= this.program[0].length) return stepDir > 0 ? this.dir === "left" : this.dir === "right";
			if (this.y < 0) return stepDir > 0 ? this.dir === "down" : this.dir === "up";
			if (this.y >= this.program.length) return stepDir > 0 ? this.dir === "up" : this.dir === "down";
		},
		render(ctx, scale) {
			ctx.canvas.width = this.program[0].length * 5 + this.padding[1] + this.padding[3];
			ctx.canvas.height = this.program.length * 5 + this.padding[0] + this.padding[2];
			if (scale !== undefined) {
				ctx.canvas.style.width = (ctx.canvas.width * scale) + "px";
			}
			ctx.fillStyle = this.bgColor;
			ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
			for (let y = 0; y < this.program.length; y++) {
				for (let x = 0; x < this.program[0].length; x++) {
					this.renderPos(ctx, x, y);
				}
			}
		},
		renderPos(ctx, x, y, {color: fg = this.fgColor, edges = true} = {}) {
			if (y === undefined) {
				let v = x;
				x = v%this.program[0].length;
				y = (v - x)/this.program[0].length;
			}
			if (this.inProgram(x, y)) {
				let glyph = this.font[this.program[y][x]] || this.font[".."],
					rx = x * 5 + this.padding[3],
					ry = y * 5 + this.padding[0];
				
				if (edges) {
					ctx.clearRect(rx, ry, 5, 5);
				} else {
					ctx.clearRect(rx + 1, ry + 1, 3, 3);
				}
				
				let inverse = false;
				
				if (this.x === x && this.y === y) {
					inverse = true;
					if (edges) {
						ctx.fillStyle = fg;
						ctx.fillRect(rx + 1, ry, 3, 1);
						ctx.fillRect(rx + 1, ry + 4, 3, 1);
						ctx.fillRect(rx, ry + 1, 1, 3);
						ctx.fillRect(rx + 4, ry + 1, 1, 3);
						ctx.fillStyle = this.bgColor;
						ctx.fillStyle = (this.dir === "left" || this.dir === "up") ? fg : this.bgColor;
						ctx.fillRect(rx + 4, ry + 4, 1, 1);
						ctx.fillStyle = (this.dir === "right" || this.dir === "up") ? fg : this.bgColor;
						ctx.fillRect(rx, ry + 4, 1, 1);
						ctx.fillStyle = (this.dir === "right" || this.dir === "down") ? fg : this.bgColor;
						ctx.fillRect(rx, ry, 1, 1);
						ctx.fillStyle = (this.dir === "left" || this.dir === "down") ? fg : this.bgColor;
						ctx.fillRect(rx + 4, ry, 1, 1);
					}
				} else {
					if (edges) {
						ctx.fillStyle = this.bgColor;
						ctx.fillRect(rx, ry, 5, 1);
						ctx.fillRect(rx, ry + 4, 5, 1);
						ctx.fillRect(rx, ry + 1, 1, 3);
						ctx.fillRect(rx + 4, ry + 1, 1, 3);
					}
				}
				
				for (let py = 0; py < 3; py++) {
					for (let px = 0; px < 3; px++) {
						if ((glyph[py * 3 + px] !== " ") ^ inverse) {
							ctx.fillStyle = fg;
						} else {
							ctx.fillStyle = this.bgColor;
						}
						ctx.fillRect(rx + 1 + px, ry + 1 + py, 1, 1);
					}
				}
			}
		}
	};
	
	
	function applyDefaults(obj, defaults) {
		let result = Object.assign({}, obj);
		for (let [k, d] of Object.entries(defaults)) {
			if (result[k] === undefined) {
				result[k] = d;
			} else if (d && typeof d === "object") {
				result[k] = applyDefaults(result[k], d);
			}
		}
		return result;
	}
	
	
	cb(BackFlip);
	
})(b => {
	if (typeof module === "undefined") BackFlip = b;
	else module.exports = b;
});