

var canvas = document.querySelector("canvas"),
	ctx = canvas.getContext("2d"),
	width, height;
function resize() {
	width = window.innerWidth;
	height = window.innerHeight;
	canvas.width = width;
	canvas.height = height;
	
	if (focusNode) draw();
}
window.addEventListener("resize", function() {
	resize();
});
resize();



var numa = document.getElementById("numa"),
	numb = document.getElementById("numb"),
	numc = document.getElementById("numc"),
	drawButton = document.getElementById("drawButton");

var thresh = 4,
	initLen = 200,
	initFont = 50,
	fitVert = 2, // (multiplied by font size)
	textOffsetX = 30,
	textOffsetY = 10,
	scale = 0.7,
	waterColor = "dodgerblue",
	circleRad = 10,
	circleColor = "darkgray",
	lineWidth = 1,
	riverLineWidth = 2;

var focusNode,
	ox = 0, oy = 0,
	visibleNodes = [],
	hoverNode = false;





drawButton.onclick = () => {
	start(parseFloat(numc.value), parseFloat(numa.value), parseFloat(numb.value)); 
}



canvas.onclick = e => {
	if (hoverNode) focusNode = hoverNode;
	hoverNode = false;
	update();
}

canvas.onmousemove = e => {
	var x = nx(e.clientX),
		y = ny(e.clientY);
	
	if (hoverNode) {
		if (!onNode(hoverNode, x, y)) hoverNode = false;
		draw();
	} else {
		for (var n of visibleNodes) {
			if (onNode(n, x, y)) {
				hoverNode = n;
				break;
			}
		}
		if (hoverNode) draw();
	}
}

function onNode(node, x, y) {
	x -= node.x;
	y -= node.y;
	return Math.sqrt(x*x + y*y) <= circleRad;
}



function start(v0, v1, v2) {
	
	focusNode = new Node(v0, v1, v2, 0);
	
	display();
	
}


function display() {
	update();
	deltaSpan.textContent = calcDelta();
	deltaDiv.classList.remove("hidden");
}


function update() {
	focusNode.update();
	draw();
}


function draw() {
	ctx.clearRect(0, 0, width, height);
	focusNode.draw();
	if (hoverNode) fillCircle(mx(hoverNode.x), my(hoverNode.y), circleRad, circleColor);
}




function Node(v0, v1, v2, rot, initConn) {
	this.v = [v0, v1, v2];
	this.rot = rot || 0;
	this.c = [initConn, undefined, undefined];
}
Node.prototype = {
	addConn(idx) {
		this.c[idx] = new Node(...this.getConnVals(idx), this.getConnRot(idx), this);
	},
	getConnVals(idx) {
		var [ai, bi] = restIdxs(idx),
			a = this.v[ai],
			b = this.v[bi],
			c = this.v[idx],
			x = (2 * (a + b)) - c;
		return [x, b, a];
	},
	getConnRot(idx) {
		return (this.rot + (idx * 2) + 3)%6;
	},
	draw(step = 0, fromNode = false) {
		this.c.forEach((c, i) => {
			if (c && c !== fromNode) {
				var [vai, vbi] = restIdxs(i);
				if (diffSigns(this.v[vai], this.v[vbi]))
					ctx.strokeStyle = waterColor, ctx.lineWidth = riverLineWidth;
				else ctx.strokeStyle = "black", ctx.lineWidth = lineWidth;
				ctx.beginPath();
				ctx.moveTo(mx(this.x), my(this.y));
				ctx.lineTo(mx(c.x), my(c.y));
				ctx.stroke();
				c.draw(step + 1, this);
			}
		});
		
		if (step < thresh) {
			if (step) this.drawV(step, this.v[0], 0);
			else this.v.forEach((...args)=>this.drawV(step, ...args));
		}
	},
	drawV(step, v, i) {
		var stepScale = Math.pow(scale, step),
			fontSize = initFont * stepScale;
		ctx.font = fontSize + "px sans-serif";
		var angle = (this.rot + (i * 2) + 3)%6,
			textW = ctx.measureText(v).width,
			offsetX = textOffsetX * stepScale,
			offsetY = textOffsetY * stepScale,
			dx, dy;
		
		if (angle%3 === 0) {
			var yOffset = ((fitVert * fontSize)/2) / Math.sqrt(3);
			if (angle === 0) dy = -yOffset;
			else dy = fontSize + yOffset;
			dx = -textW/2;
			//if (!step) console.log(dx, dy);
		} else {
			if (angle === 5 || angle === 1)
				dy = -offsetY;
			else dy = fontSize + offsetY;
			if (angle === 1 || angle === 2)
				dx = offsetX;
			else dx = -textW - offsetX;
		}
		
		if (v === 0) ctx.fillStyle = waterColor;
		else ctx.fillStyle = "black";
		ctx.fillText(v, mx(this.x + dx), my(this.y + dy));
	},
	update(step = 0, fromNode = false, fromX = 0, fromY = 0, fromAngle = false) {
		// (fromAngle should be 0-5, basically gets multiplied by 60)
		//this.fromAngle = fromAngle;
		
		if (step === 0) visibleNodes.splice(0, visibleNodes.length);
		visibleNodes.push(this);
		
		var len = initLen * Math.pow(scale, step),
			dx = 0, dy = 0;
		
		if (fromNode !== false) {
			var dx, dy;
			if (fromAngle%3 === 0) {
				dx = 0;
				dy = len;
				if (fromAngle === 0) dy *= -1;
			} else {
				dy = len/2;
				dx = dy * Math.sqrt(3);
				if (fromAngle%4 === 1) dy *= -1;
				if (fromAngle === 4 || fromAngle === 5)
					dx *= -1;
			}
		}
		
		this.x = fromX + dx;
		this.y = fromY + dy;
		
		this.c.forEach((c, i) => {
			if ((c || step < thresh) && c !== fromNode) {
				if (step < thresh)
					c = this.c[i] = new Node(...this.getConnVals(i), this.getConnRot(i), this);
				
				c.update(step + 1, this, this.x, this.y, (this.rot + (i * 2))%6);
			}
		});
	}
};

function restIdxs(idx) {
	return [(idx + 1)%3, (idx + 2)%3];
}


function calcDelta() {
	var [l, t, b] = focusNode.v,
		r = focusNode.c[0].v[0];
	return ((t - b) ** 2) - (l * r);
}


/*
function forVisible(callback) {
	iter();
	
	function iter(step = 0, node = focusNode, fromNode = false, fromIdx = false) {
		callback(node, step, fromNode, fromIdx);
		if (step < thresh) node.c.forEach((c, i) => {
			if (c) iter(step + 1, c, node, i));
		}
	}
}
*/


function diffSigns(a, b) {
	return (a < 0 && b > 0) || (a > 0 && b < 0);
}


function mx(v) {
	return width/2 + ox + v;
}

function my(v) {
	return height/2 + oy + v;
}

function nx(v) {
	return v - (width/2) - ox;
}

function ny(v) {
	return v - (height/2) - oy;
}


function fillCircle(x, y, r, color) {
	drawCircle(x, y, r);
	ctx.fillStyle = color;
	ctx.fill();
}

function drawCircle(x, y, r) {
	ctx.beginPath();
	ctx.arc(x, y, r, 0, 2 * Math.PI, false);
}


/*
canvas.onclick = e => {
	console.log(e.clientX - (width/2) - ox, e.clientY - (height/2) - oy);
}
*/

