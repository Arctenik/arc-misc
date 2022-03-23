let fs = require("fs");

let startY = 19,
	startX = 18,
	spacingY = 17,
	spacingX = 18;

(function() {
	
	let [, , fileName] = process.argv;
	
	if (!fileName) {
		console.log("Needs file name parameter");
		return;
	}
	
	fs.readFile(fileName, "utf8", (err, data) => {
		if (err) throw err;
		else {
			let rows = data.split(/\r\n|[\r\n]/),
				result = "";
			
			for (let y = startY; y < rows.length; y += spacingY) {
				let row = rows[y];
				if (result) result += "\n";
				for (let x = startX; x < row.length; x += spacingX) {
					result += row[x] === "^" ? "#" : " ";
				}
			}
			
			fs.writeFile(fileName.replace(/(?:\.[^.\/]*)*$/, "_pattern$&"), result, err => {
				if (err) throw err;
			});
		}
	});
	
})();