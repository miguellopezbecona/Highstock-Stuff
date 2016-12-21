var availHeight = $(window).height();
var ecgHeight = 0.7*availHeight; // 70% for ECG and bands. ECG will use 66% from that 70% (46% from availHeight)
var width = screen.width;

var rawData = [];
rawData.push([7.0, 6.9, 9.5, 14.5, 18.2, 21.5, 25.2, 26.5, 23.3, 18.3, 13.9, 9.6]);
rawData.push([-0.2, 0.8, 5.7, 2.3, 5.0, 15.0, 24.8, 24.1, 20.1, 14.1, 8.6, 2.5]);
rawData.push([-0.9, 0.6, 3.5, 8.4, 13.5, 17.0, 18.6, 17.9, 14.3, 9.0, 3.9, 1.0]);

var numSignals = rawData.length;
var intervalID = -1;
var numBands = 0;

// Highstocks final objects
var ecgChart = {}
var bandCharts = []

// Common part to every highstock object we will build
var baseObject = {
	tooltip: { // No details box
		enabled: false
	},
	yAxis: { // No labels nor lines
		gridLineColor: 'transparent',
		labels: {
			enabled: false
		}
	},
	rangeSelector: { // No buttons
		enabled: false
	},
	scrollbar: { // No scrollbar
		enabled: false
	},
	credits: { // No link to web
		enabled: false
	}
};

// Separates lines without using different panels
function manualOffset(){
	var offset = 40;
	var localOffset;
	for(i=1;i<rawData.length;i++){ // Ignores first line because its offset would be 0
		for(j=0;j<rawData[i].length;j++){
			localOffset = i*offset;
			rawData[i][j] += localOffset;
		}
	}
}

// Builds series from data
function buildSeries(){
	var lines = [];
	for(i=0;i<numSignals;i++)
		lines.push({ data: rawData[i], name: "Signal " + (i+1)});
	return lines;
}

// Initializes ecgChart
function initECGChart(lines){
	var o = jQuery.extend({}, baseObject); // Copy from base
	o.chart = { height: ecgHeight, margin: 0};
	o.series = lines; // Data
	o.scrollbar = { enabled: false, liveRedraw: false }; // Fixes extremes update
	o.xAxis = {
		events: {
			afterSetExtremes: function(e) {
				if(!ecgChart.xAxis) return

				// Updates extremes in the band panels when they are changed in ECG
				var ext = ecgChart.xAxis[0].getExtremes()
				for(i=0;i<numBands;i++)
					bandCharts[i].xAxis[0].setExtremes(ext.min, ext.max)
			}
		}
	}

	// Obtains "good" object and updates dimensions
    $('#container').highcharts("StockChart", o);
	ecgChart = $('#container').highcharts();
	ecgChart.setSize(width, ecgHeight, false);
}

function initBandCharts(){
	var bandDivs = $(".band");
	numBands = bandDivs.length;
	var newHeight = ecgHeight / (numBands*2);

	var plotbandBase = jQuery.extend({}, baseObject); // Copy from base
	plotbandBase.xAxis = { // No line
		lineWidth: 0,
		tickLength: 0,
		labels: {
			enabled: false
		}
	}
	plotbandBase.chart = {height: newHeight, animation: false, margin: 0, backgroundColor: "#eeeeee"}; // No animation in setExtremes, no margin
	plotbandBase.series = [{}]
	plotbandBase.navigator = { enabled: false }; // No register
	
	for(i=0;i<numBands;i++){
		var o = jQuery.extend({}, plotbandBase); // Copy from plotband base
		$(bandDivs[i]).highcharts("StockChart", o);
		bandCharts[i] = $(bandDivs[i]).highcharts();
		bandCharts[i].setSize(width, newHeight, false);
	}
}

// Creates plotband with colour "c" from "min" to "max" for "num" band
function createPlotBand(num, c, min, max){
	var pb = {color: c,
		from: min,
		to: max,
		label: {text: min + "\t" + max}
	}
		
	// If you click the plotband, it will be added to the ECG chart
	pb.events = {
		click: function (evt) {
			clearInterval(intervalID); // Clears pending animations
			ecgChart.xAxis[0].removePlotBand();
			drawPlotBand(ecgChart, pb);
		}
	}
	
	// Draws pb in "num" band 
	drawPlotBand(bandCharts[num], pb);
}

// Auxiliar function for plotband animation
function fade(element, options) {
    options = Highcharts.extend({
        duration: 1000,
        prop: 'fill',
        color: Highcharts.Color('rgba(0,0,0,0)'),
        to: 1
    }, options);
    
    var color = Highcharts.Color(options.color),
        opacity = color.get('a'),
        fps = 16,        
        currentFrame = 1,
        frames = parseInt(options.duration / 1000 * fps, 10), // 16 steps per second
        step = (options.to - opacity) / frames,
        animLoop;
        
    function setColor(c) {
        element.attr(options.prop, c.get());
    }
    
    intervalID = setInterval(function(){
        color.setOpacity( opacity += step )
        
        if (currentFrame === frames) {
            color.setOpacity(opacity = options.to);
            clearInterval(intervalID);
        }

        setColor(color);
        currentFrame++;
    }, options.duration / fps);
}

// Draws "pb" in "chart"
function drawPlotBand(chart, pb){
	chart.xAxis[0].addPlotBand(pb);
	
	// Gets "good" object
	var a = chart.xAxis[0].plotLinesAndBands;
	var plotband = a[a.length - 1];
	
	// Animates plotband
	fade(plotband.svgElem, {
		duration: 1000,
		prop: 'fill',
		color: pb.color,
		to: 1.0
	});
}

// Draws one label per series in its half height
function drawSeriesLabels(){
	for(i=0;i<numSignals;i++){
		serie = ecgChart.series[i]
		center = serie.dataMin + ((serie.dataMax - serie.dataMin) / 2) // In the middle
		ecgChart.yAxis[0].addPlotLine({
		  value: center,
		  color: "transparent",
		  width: 1,
		  label: {
			text: serie.name
		  },
		  zIndex: 5
		});
	}
}

// Forces chart redraw
function update(chart){
	//chart.series[0].setData(chart.series[0].yData,true);
	var ext = chart.xAxis[0].getExtremes()
	chart.xAxis[0].setExtremes(ext.min+1, ext.max)
	chart.xAxis[0].setExtremes(ext.min, ext.max)
}

function expandPlotband(pb, value){
	pb.options.to = value; // Updates right limit
	update(ecgChart); // Forces redraw
}

// Toggles visibility of a line depending on checked checkbox
var checkboxPrefix = "chk";
function toggleSerie(v){
	var serie = parseInt(v.id.split(checkboxPrefix)[1])
	ecgChart.series[serie].setVisible(v.checked);
	
	// Visibility should also affects line's label
	serie += ecgChart.xAxis[0].plotLinesAndBands.length;
	$($("#container tspan")[serie]).toggle(v.checked)
}

// Adds checkboxes dynamically
function initializeCheckboxes(){
	for(i=0;i<numSignals;i++)
		$(".checkboxes").append("<p><input type='checkbox' checked='true' id='" + checkboxPrefix + i + "' onchange=toggleSerie(this)> " + ecgChart.series[i].name + "</p>")
}

// Plotband expansion test
function buttonAction(){	
	// New plotband definition
	var f = 1;
	var t = 5;
	var pb = {color: "yellow",
		from: f,
		to: t
	};
	
	var ax = ecgChart.xAxis[0];
	ax.removePlotBand(); // Removes existing plotband

	ax.addPlotBand(pb); // Adds new plotband
	pb = ax.plotLinesAndBands[0]; // Gets "good" object
	
	// Periodical update
	intervalID = setInterval(function(){
		t++;
		expandPlotband(pb, t);
		
		if(t==10) clearInterval(intervalID); // Stops period when "t" is 10
	}, 1 * 1000); // Every second
}

// Plotband expansion test
function expandButton(){	
	// New plotband definition
	var f = 1;
	var t = 5;
	var pb = {color: "yellow",
		from: f,
		to: t
	};
	
	var ax = ecgChart.xAxis[0];
	ax.removePlotBand(); // Removes existing plotband

	ax.addPlotBand(pb); // Adds new plotband
	pb = ax.plotLinesAndBands[0]; // Gets "good" object
	
	// Periodical update
	intervalID = setInterval(function(){
		t++;
		expandPlotband(pb, t);
		
		if(t==10) clearInterval(intervalID); // Stops period when "t" is 10
	}, 1 * 1000); // Every second
}

// Action for initBandsButton
function initBandsButton(){
	ecgHeight *= 0.66; // ECG will now use 66% from that 70% because plotbands will be activated
	ecgChart.setSize(width, ecgHeight, false) // Updates main chart height
	
	initBandCharts();
	
	// Necessary to plot bands at the beginning
	update(ecgChart);
		
	// Some example plotbands
	createPlotBand(0, "rgba(255, 0, 0, 0)", 1, 2);
	createPlotBand(0, "rgba(0, 255, 0, 0)", 4, 7);
	createPlotBand(1, "rgba(0, 0, 255, 0)", 3, 5);
	createPlotBand(2, "rgba(253, 184, 47, 0)", 6, 9); // Orange
	
	$("#initBandsButton").hide();
}

// When the page is ready, everything is initialized
$(document).ready(function () {
	manualOffset();
	var lines = buildSeries();
	initECGChart(lines);
	//initBandCharts();
	drawSeriesLabels();
	initializeCheckboxes();
	
	// Gives actions to the buttons
	$("#initBandsButton").click(initBandsButton);
	$("#expandButton").click(expandButton);
});
