class boxPlot {
    constructor(container, id, properties) {
        this.container = container;
        this.props = properties;
        this.id = id;

        this.props.width = 400;
        this.props.height = 300;

        this.container.style.height = this.props.height + "px";
        this.container.style.width = this.props.width + "px";
        this.container.insertAdjacentHTML('beforeend', '<svg id="svg-' + id + `" class="visualization" width="${this.props.width}" height="${this.props.height}"><style type="text/css"></style><defs></defs></svg>,`);
        this.svg = d3.select('#svg-' + id);

        this.chartContent = this.svg.append('g').attr('class', 'chart-content');
        this.legend = this.svg.append('g').attr('class', 'chart-legend');

        this.threshold = 0;
    }

    draw(data, key, dimx, dimy, threshold) {
        var self = this;
        var circleRadius = 0.3;
        var gap = 0.001;
        var gridSquareSize = Math.max(Math.floor(circleRadius), 1);

        var margins = {
            top: 10,
            right: 10,
            bottom: 30,
            left: 60
        };

        var width = this.props.width - 50;
        var height = this.props.height - 50;

        var minYdata = data[dimy][0];
        var maxYdata = data[dimy][0];

        data[dimy].forEach(function (m) {
            if (m < minYdata) {
                minYdata = m;
            }
            if (m > maxYdata) {
                maxYdata = m;
            }
        });

        var minY = minYdata - 1;
        var maxY = maxYdata + 1;
        var minX = 1;
        var maxX = 1;

        var allValues = []
        data[dimy].forEach(function (m) { allValues.push(data[dimx]); });

        var uniqueValues = [];
        allValues.forEach(function (m) {
            if (uniqueValues.indexOf(m) == -1) {
                uniqueValues.push(m);
            }
        });

        this.xTickValues = uniqueValues;
        data["_xVal"] = [];
        allValues.forEach(function (n, i) {
            var index = uniqueValues.indexOf(n);
            data["_xVal"].push(index + 1);
        });

        var count = 0;
        var plotData = [];
        uniqueValues.forEach(function (m) {
            plotData[count] = [];
            plotData[count][0] = count;
            plotData[count][1] = [];
            count++;
        });

        allValues.forEach(function (d) {
            var ind = uniqueValues.indexOf(d);
            plotData[ind][1].push(data[dimy][ind]);
        });

        minX = 0;
        maxX = uniqueValues.length + 1;

        var xScale = d3.scaleLinear()
            .domain([0, maxX])
            .range([0, width - margins.left - margins.right])
            .nice();
        var yScale = d3.scaleLinear()
            .domain([0, maxY])
            .range([height - margins.top - margins.bottom, 0])
            .nice();

        this.svg.selectAll('.xAxis').remove();
        this.svg.selectAll('.yAxis').remove();

        var xLabelsPadded = [""];
        uniqueValues.forEach(function (n) { xLabelsPadded.push(n); });
        this.drawAxes(xScale, yScale, xLabelsPadded.length, 7, this.chartContent, width, height, margins, undefined, undefined, xLabelsPadded, undefined, undefined)

        var grid = {};
        var items = [];
        var maxGroupItems = 1;
        var gridYCount = {};
        var gridYCountFinished = {};
        var seriesIndex = 0;
        for (var i = 0; i < data[dimy].length; ++i) {

            var cellX = data["_xVal"][i];
            var cellY = data[dimy][i];
            if (!cellX || !cellY) {
                continue;
            }

            var classes = `item data-series-${seriesIndex}`;

            var x = xScale(cellX);
            var y = yScale(cellY);

            var gridX = Math.floor(x / gridSquareSize) * gridSquareSize;
            var gridY = Math.floor(y / gridSquareSize) * gridSquareSize;

            var uiObj = null;

            if (grid[gridY] && grid[gridY][gridX]) {
                gridYCount[gridY][gridX]++;
            }

            // id, start, end, values, seriesIndex, valueItems, measurements, cssClasses
            uiObj = {
                "id:": `scatter_${cellX}_${cellY}_${seriesIndex}_${allValues[i]}`,
                "start": [key],
                "end": allValues[i],
                "values": [cellX, cellY],
                "seriesIndex": [
                    [allValues[i]],
                    [allValues[i]]
                ], // valueItems one for each measurement
                "valueItems": ["_xVal", dimy], // measurements
                "measurements": seriesIndex,
                "classes": classes
            };

            if (!grid[gridY]) {
                grid[gridY] = {};
                gridYCount[gridY] = {};

                gridYCountFinished[gridY] = {};
            }

            if (!grid[gridY][gridX]) {
                gridYCount[gridY][gridX] = 0;
                gridYCountFinished[gridY][gridX] = 0;
            }
            grid[gridY][gridX] = uiObj;
            gridYCount[gridY][gridX]++;
            items.push(uiObj);
        }

        var itemsGroup = this.chartContent.select('.items');

        if (itemsGroup.empty()) {
            itemsGroup = this.chartContent.append('g').attr('class', 'items');
            var selectedGroup = itemsGroup.append('g').attr('class', 'selected');
            itemsGroup.append('g').attr('class', 'hovered');
            selectedGroup.append('g').attr('class', 'hovered');
        }

        var selection = itemsGroup.selectAll('circle').data(items, function (d) {
            return d.id;
        });

        selection
            .enter()
            .insert('circle', ':first-child')
            .attr('id', function (d) {
                return `${self.id}-item-${d.seriesIndex}`;
            })
            // .style('opacity', 0)
            .style('fill-opacity', 0.7)
            .attr('r', circleRadius)
            .each(
                function (d) {
                    var circle = d3.select(this);

                    var cellX = d.values[0];
                    var cellY = d.values[1];

                    var x = xScale(cellX);
                    var y = yScale(cellY);

                    var gridX = Math.floor(x / gridSquareSize) * gridSquareSize;
                    var gridY = Math.floor(y / gridSquareSize) * gridSquareSize

                    var finished = gridYCountFinished[gridY][gridX];

                    var cx = (margins.left + (cellX - minX) * (width - margins.left - margins.right) / (maxX - minX));
                    if (finished % 2 == 0) {
                        cx += (finished / 2) * xScale(gap);
                    } else {
                        cx -= Math.ceil(finished / 2) * xScale(gap);
                    }

                    gridYCountFinished[gridY][gridX]++;

                    var fill = "blue";
                    circle
                        .attr('cx', cx)
                        .attr('cy', 
                        // height - margins.top - margins.bottom - ((cellY - minY) * (height - margins.top - margins.bottom) / (maxY - minY))
                        y)
                        .attr('class', d.cssClasses)
                        .style('fill', fill);
                });


        selection
            .transition()
            .duration(1000)
            .style('fill-opacity', function (d) {
                return Math.max(0.6, d.valueItems[0].length / maxGroupItems);
            })
            .style('opacity', null)
            .attr('r', circleRadius);

        selection
            .exit()
            .transition()
            .duration(1000)
            .style('opacity', 0)
            .attr('r', 0)
            .remove();

        var rectBox = itemsGroup;

        // rectBox.selectAll('.iqr-range').remove();
        // rectBox.selectAll('.whisker').remove();
        // for (i = 0; i < plotData.length; i++) {
        //     var findIQR = plotData[i][1];
        //     var lower_upper = [];
        //     lower_upper = quartiles(findIQR);

        //     var iqr_result = lower_upper[1] - lower_upper[0];
        //     var iqr_15 = iqr_result * 1.5;

        //     var whisker_lower_index = 0;
        //     var whisker_upper_index = findIQR.length - 1;
        //     for (var j = 0; j < findIQR.length; j++) {
        //         if (findIQR[j] < lower_upper[0] - iqr_15) {
        //             whisker_lower_index = j;
        //         }
        //         else {
        //             break;
        //         }
        //     }
        //     for (var k = findIQR.length - 1; k > 0; k--) {
        //         if (findIQR[k] > (lower_upper[1] + iqr_15)) {
        //             whisker_upper_index = k;
        //         }
        //         else {
        //             break;
        //         }
        //     }
        //     rectBox.append("rect")
        //         .attr('id', "0")
        //         .attr('class', 'iqr-range')
        //         .style('opacity', 1)
        //         .style('fill-opacity', 0.2)
        //         .attr('x', margins.left + (0.6 + plotData[i][0] - minX) * (width - margins.left - margins.right) / (maxX - minX))
        //         .attr('y', height - margins.bottom - ((lower_upper[1] - minY) * (height - margins.top - margins.bottom) / (maxY - minY)))
        //         .attr('width', xScale(.8))
        //         .attr('height', Math.abs((yScale(lower_upper[1]) - yScale(lower_upper[0]))))
        //         .attr('fill', '#1E90FF');

        //     rectBox.append("line")
        //         .style("stroke", "gray")
        //         .attr('class', 'whisker')
        //         .attr("x1", margins.left + (1 + plotData[i][0] - minX) * (width - margins.left - margins.right) / (maxX - minX))
        //         .attr('y1', height - margins.bottom - ((lower_upper[1] - minY) * (height - margins.top - margins.right) / (maxY - minY)))
        //         .attr("x2", margins.left + (1 + plotData[i][0] - minX) * (width - margins.left - margins.right) / (maxX - minX))
        //         .attr('y2', (height - margins.bottom - ((findIQR[whisker_upper_index] - minY) * (height - margins.top - margins.bottom) / (maxY - minY))));

        //     rectBox.append("line")
        //         .style("stroke", "gray")
        //         .attr('class', 'whisker')
        //         .attr("x1", margins.left + (1 + plotData[i][0] - minX) * (width - margins.left - margins.right) / (maxX - minX))
        //         .attr('y1', height - margins.bottom - ((lower_upper[0] - minY) * (height - margins.top - margins.right) / (maxY - minY)))
        //         .attr("x2", margins.left + (1 + plotData[i][0] - minX) * (width - margins.left - margins.right) / (maxX - minX))
        //         .attr('y2', (height - margins.bottom - ((findIQR[whisker_lower_index] - minY) * (height - margins.top - margins.right) / (maxY - minY))));

        //     rectBox.append("line")
        //         .style("stroke", "gray")
        //         .attr('class', 'whisker')
        //         .attr("x1", margins.left + (0.6 + plotData[i][0] - minX) * (width - margins.left - margins.right) / (maxX - minX))
        //         .attr('y1', height - margins.bottom - ((findIQR[whisker_upper_index] - minY) * (height - margins.top - margins.bottom) / (maxY - minY)))
        //         .attr("x2", margins.left + (1.4 + plotData[i][0] - minX) * (width - margins.left - margins.right) / (maxX - minX))
        //         .attr('y2', (height - margins.bottom - ((findIQR[whisker_upper_index] - minY) * (height - margins.top - margins.bottom) / (maxY - minY))));

        //     rectBox.append("line")
        //         .style("stroke", "gray")
        //         .attr('class', 'whisker')
        //         .attr("x1", margins.left + (0.6 + plotData[i][0] - minX) * (width - margins.left - margins.right) / (maxX - minX))
        //         .attr('y1', height - margins.bottom - ((findIQR[whisker_lower_index] - minY) * (height - margins.top - margins.bottom) / (maxY - minY)))
        //         .attr("x2", margins.left + (1.4 + plotData[i][0] - minX) * (width - margins.left - margins.right) / (maxX - minX))
        //         .attr('y2', (height - margins.bottom - ((findIQR[whisker_lower_index] - minY) * (height - margins.top - margins.bottom) / (maxY - minY))));

        // }

        // function quartiles(d) {
        //     d.sort(d3.ascending);
        //     var q1 = d3.quantile(d, .25);
        //     var q3 = d3.quantile(d, .75);
        //     return [q1, q3];
        // };

        function dragstarted(event) {
            const line = d3.select(this).classed("dragging", true);

            event.on("drag", dragged).on("end", ended);

            function dragged(event, d) {
                line.attr("y1", event.y).attr("y2", event.y);
            }

            function ended() {
                line.classed("dragging", false);
                self.threshold = yScale.invert(parseInt(line.attr("y1")));

                const event = new CustomEvent('threshold',
                    {
                        bubbles: true,
                        detail: {
                            "threshold": yScale.invert(parseInt(line.attr("y1")))
                        }
                    });

                self.container.dispatchEvent(event);
            }
        }

        //drag line;
        var drag = d3.drag()
            .on('start', dragstarted);

        itemsGroup
            .selectAll(".threshold").remove();

        var line = itemsGroup
            .append("line")
            .attr("class", "threshold")
            .attr("x1", margins.left + xScale(minX))
            .attr("y1", margins.top + yScale(threshold))
            .attr("x2", margins.left + xScale(maxX))
            .attr("y2", margins.top + yScale(threshold))
            .attr("stroke-width", 5)
            .attr("stroke", "Orange")
            .on("mouseover", function () {
                var lines = d3.select(this);
                line.attr("stroke", "black");
                lines.attr("stroke-width", "8");
            })
            .on("mouseout", function () {
                var lines = d3.select(this);
                line.attr("stroke", "Orange");
                lines.attr("stroke-width", "5");
            })
            .call(drag);

        return items;
    }

    drawAxes(xScale, yScale, xTicks, yTicks, svg, width, height, margins, xAxisFormat, yAxisFormat, xLabels, yLabels, xLabelsBtTicks, yLabelsBtTicks) {
        var axesGroup = svg.select('.axes'),
            xAxisGrid = axesGroup.select('.xAxis-grid'),
            yAxisGrid = axesGroup.select('.yAxis-grid'),
            xAxisLine = axesGroup.select('.xAxis-line'),
            yAxisLine = axesGroup.select('.yAxis-line');

        if (axesGroup.empty()) { axesGroup = svg.append('g').attr('class', 'axes'); }

        if (xAxisGrid.empty()) { xAxisGrid = axesGroup.append('g').attr('class', 'xAxis xAxis-grid'); }
        if (yAxisGrid.empty()) { yAxisGrid = axesGroup.append('g').attr('class', 'yAxis yAxis-grid'); }
        if (xAxisLine.empty()) { xAxisLine = axesGroup.append('g').attr('class', 'xAxis xAxis-line'); }
        if (yAxisLine.empty()) { yAxisLine = axesGroup.append('g').attr('class', 'yAxis yAxis-line'); }

        if (xScale) {
            // Draw X-axis grid lines
            xAxisGrid
                .attr('transform', 'translate(' + margins.left + ', ' + margins.top + ')')
                .selectAll('line.x')
                .data(xScale.ticks(xTicks))
                .enter().append('line')
                .attr('x1', xScale)
                .attr('x2', xScale)
                .attr('y1', 0)
                .attr('y2', height - margins.top - margins.bottom)
                .style('stroke', '#eeeeee')
                .style('shape-rendering', 'crispEdges');

            var xAxisTickFormat = xAxisFormat ||
                ((xLabels) ?
                    function (i) { return xLabels[i]; } :
                    function (x) {
                        var format = d3.format('s');
                        var rounded = Math.round(x * 1000) / 1000;
                        return format(rounded);
                    });

            var xAxis = d3.axisBottom(xScale)
                .ticks(xTicks)
                .tickFormat(xAxisTickFormat);

            xAxisLine
                .attr('transform', 'translate(' + margins.left + ', ' + (height - margins.bottom) + ')')
                .call(xAxis);

            if (xLabels) {
                var xTransform = 'rotate(-90)';
                if (xLabelsBtTicks) { xTransform += 'translate(0,' + (xScale(0.5) - xScale(0)) + ')'; }
                xAxisLine
                    .selectAll('text')
                    .style('text-anchor', 'end')
                    .attr('dx', '-.8em')
                    .attr('dy', '-0.5em')
                    .attr('transform', xTransform);
            }
        }

        if (yScale) {
            // Draw Y-axis grid lines
            yAxisGrid
                .attr('transform', 'translate(' + margins.left + ', ' + margins.top + ')')
                .selectAll('line.y')
                .data(yScale.ticks(yTicks - 1))
                .enter().append('line')
                .attr('x1', 0)
                .attr('x2', width - margins.left - margins.right)
                .attr('y1', yScale)
                .attr('y2', yScale)
                .style('stroke', '#eeeeee')
                .style('shape-rendering', 'crispEdges');

            var yAxisTickFormat = (yLabels) ? function (i) { return yLabels[i]; } :
                function (y) {
                    var format = d3.format('s');
                    var rounded = Math.round(y * 1000) / 1000;
                    return format(rounded);
                };

            var yAxis = d3.axisLeft(yScale)
                .ticks(yTicks - 1);
            // .tickFormat(yAxisTickFormat);

            yAxisLine
                .attr('transform', 'translate(' + margins.left + ', ' + margins.top + ')')
                .call(yAxis);
        }
    }
}