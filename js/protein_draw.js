function determineOverlaps(domains) {
    var domains = domains.sort(function (left, right) {
        var key;
        if (left['start'] == right['start']) {
            key = 'end';
        }
        else {
            key = 'start';
        }
        return left[key] - right[key];
    });

    var groupCounter = -1;
    var groupCounts = {};

    for (var i=0; i < domains.length; i++) {
        var overlapsPrevious = false;
        if ((i > 0) && (domains[i-1]['end'] > domains[i]['start'])) {
            overlapsPrevious = true;
        }

        if (!overlapsPrevious) {
            groupCounter++;
            domains[i]['overlapGroup'] = groupCounter;
            groupCounts[groupCounter] = 1;
            domains[i]['overlapGroupIndex'] = 0;
        }
        else {
            domains[i]['overlapGroup'] = domains[i-1]['overlapGroup'];
            domains[i]['overlapGroupIndex'] = domains[i-1]['overlapGroupIndex'] + 1;
            groupCounts[groupCounter] += 1;
        }
    }

    for (var i=0; i < domains.length; i++) {
        domains[i]['overlapGroupSize'] = groupCounts[domains[i]['overlapGroup']];
    }

    return domains;
}
function textWidth(text, fontsize) {
    return text.toString().length * fontsize;
}
function tickValues(domains) {
    var ticks = [];
    for (var i = 0; i < domains.length; i++){
        ticks.push(domains[i]['start']);
        ticks.push(domains[i]['end']);
    }

    ticks = ticks.sort(function (a, b) { return a - b; });

    var uniqueTicks = [];
    for (var i = 0; i < ticks.length; i++) {
        var unique = (i == 0) || (ticks[i-1] != ticks[i]);
        if (unique) uniqueTicks.push(ticks[i]);
    }

    return uniqueTicks;
}

function overlappingTicks(tickValues, xScale, fontSize) {

    var ticks = [];

    var lastWithVerticalIndex = {};

    for (var i=0; i<tickValues.length; i++) {
        var rawValue = tickValues[i];
        var xValue = xScale(rawValue);

        var width = textWidth(rawValue, fontSize);

        var v = 0;
        if (i > 0) {
            while (true) {
                var last = ticks[lastWithVerticalIndex[v]];
                if (last === undefined) break;
                if ( (last['xValue'] + last['width']) < xValue) {
                    break;
                }
                v += 1;
            }
        }

        ticks.push({'rawValue': rawValue,
                    'xValue': xValue,
                    'width': width,
                    'v': v});
        lastWithVerticalIndex[v] = i;
    }

    return ticks;
}
function drawProtein(container, width, proteinLength, domains) {
    domains = determineOverlaps(domains);
    console.log(domains);
    var left=0;
    var right=50;

    var barHeight = 40;
    var yPaddingBetweenBars = 5;

    var maxGroupSize = 0;
    for (var i = 0; i < domains.length; i++) {
        if (domains[i]['overlapGroupSize'] > maxGroupSize) maxGroupSize = domains[i]['overlapGroupSize'];
    }

    var xScale = d3.scale.linear()
                    .domain([1, proteinLength])
                    .range([left, width-right]);

    var ticks = tickValues(domains);
    var spacePerSymbol = 10;
    var tickOverlaps = overlappingTicks(ticks, xScale, spacePerSymbol);
    console.log(tickOverlaps);

    var maxTickV = 0;
    for (var i = 0; i < tickOverlaps.length; i++){
        if (tickOverlaps[i]['v'] > maxTickV) maxTickV = tickOverlaps[i]['v'];
    }
    console.log(maxTickV);
    var tickHeight = 10;
    var tickYPadding = 5;
    var paddingBetweenTicksAndSchematics = 15;
    var top = (maxTickV + 1) * tickHeight + (maxTickV-1) * tickYPadding + paddingBetweenTicksAndSchematics;

    var bottom = 0;

    var height = top + bottom + barHeight * maxGroupSize + yPaddingBetweenBars * maxGroupSize - 1;

    var svg = d3.select(container).append('svg')
                .attr('width', width)
                .attr('height', height);


    svg.selectAll('line.grid')
        .data(tickOverlaps)
        .enter()
        .append('line')
        .attr("x1", function(d) { return d['xValue'];})
        .attr("x2", function(d) { return d['xValue'];})
        .attr("y1", function(d) {
            return d['v'] * (tickHeight + tickYPadding);
        })
        .attr("y2", height)
        .attr("stroke", 'black')
        .attr('class', 'grid');

    ticks = svg.selectAll('text.ticks');

    ticks.data(tickOverlaps)
        .enter()
         .append('text')
         .attr("x", function(d) { return d['xValue'] + 1 })
         .attr("y", function(d) {
            return d['v'] * (tickHeight + tickYPadding) + tickHeight;
          })
         .text(function (d) { return d['rawValue'] })
         .attr("font-family", "sans-serif")
         .attr("font-size", "11px");

    console.log(ticks);

    var middleLineY = (height - top + bottom) / 2 + top;

    var barY = 0;

    svg.append('line')
        .attr("x1", xScale(0))
        .attr("y1", middleLineY)
        .attr("x2", xScale(proteinLength))
        .attr("y2", middleLineY)
        .attr('class', 'proteinAxis');

    var domainY = function(d) {
        var groupSize = d['overlapGroupSize'];
        var groupIndex = d['overlapGroupIndex'];

        var columnOffset = groupSize / 2;
        var paddingOffset = (groupSize - 1) / 2;

        var yFirstIndex = middleLineY
                          - columnOffset * barHeight
                          - paddingOffset * yPaddingBetweenBars;
        return yFirstIndex + groupIndex * (barHeight + yPaddingBetweenBars);
    };
    var fontSize = 10;

    svg.selectAll("rect")
        .data(domains)
        .enter()
        .append("rect")
        .attr('class', 'domain')
        .attr("x", function(d) {
            return xScale(d['start']);
        })
        .attr("y", domainY)
        .attr("width", function (d) {
            return xScale(d['end']) - xScale(d['start']);
        })
        .attr("height", barHeight)
        .attr("fill", function (d) {
            return d['color'];
        })
        .attr("rx", 2)
        .attr("ry", 2);

    svg.selectAll("text.domainLabel")
        .data(domains)
        .enter()
        .append("text")
        .attr('class', 'domainLabel')
        .attr("x", function(d) {
            var tw = textWidth(d['name'], fontSize);
            var w = xScale(d['end']) - xScale(d['start']);
            if (tw <= w) {
                return xScale(d['start']) + w/2;
            }
            else {
                return xScale(d['start']) + w/2;
            }
        })
        .attr("y", function (d) {
            var tw = textWidth(d['name'], fontSize);
            var w = xScale(d['end']) - xScale(d['start']);
            if (tw <= w) {
                return domainY(d) + barHeight / 2 + 5;
            }
            else {
                return domainY(d) + barHeight / 2;
            }
        })
        .classed('vertical', function (d) {
            var tw = textWidth(d['name'], fontSize);
            var w = xScale(d['end']) - xScale(d['start']);
            return tw > w;
        })
        .text(function (d) {
            return d['name'];
        });

}
$(document).ready(function () {
    var proteinLength = 1362;
    var colors = {0: '#a6cee3',
                  1: '#1f78b4',
                  2: '#b2df8a',
                  3: '#33a02c'};

    var domains = [
        {'start': 75, 'end': 147, 'name': 'BD1', 'color': colors[0]},
        {'start': 286, 'end': 297, 'name': 'NLS', 'color': colors[1]},

        {'start': 368, 'end': 440, 'name': 'BD2', 'color': colors[0]},
        {'start': 484, 'end': 503, 'name': 'NPS', 'color': colors[2]},

        {'start': 503, 'end': 547, 'name': 'BM', 'color': colors[3]},
        {'start': 524, 'end': 579, 'name': 'BID', 'color': colors[2]},

        {'start': 600, 'end': 682, 'name': 'ET', 'color': colors[0]},

        {'start': 1209, 'end': 1362, 'name': 'PID', 'color': colors[1]},
    ];

    var width  = 800    ;
    drawProtein('#resultingSvgContainer', width, proteinLength, domains);
});