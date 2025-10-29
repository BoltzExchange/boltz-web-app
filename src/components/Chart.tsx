import { type JSX, Show, createSignal, onCleanup, onMount } from "solid-js";

type ChartOptions = {
    width?: string;
    height?: string;
};

export type Point = {
    x: number | string;
    y: number;
};

const ChartConstants = {
    chartPadding: 20,
    barSpacing: 0,

    xOffset: 80,
    yOffset: 60,

    borderRadiusRatio: 0.2,
    maxBorderRadius: 4,

    xAxisLabelOffset: 10,
    xDataLabelOffset: 30,

    yRangePadding: 0.1,
    yDataLabelOffset: 45,
    yAxisLabelOffset: 20,
    yAxisStep: 0.1,

    tooltipOffset: 30,

    gridColor: "#dddddd10",

    fontSize: "0.8rem Noto Sans",

    animationDuration: 1000,
    animationEasing: (t: number) => 1 - Math.pow(1 - t, 3),
} as const;

const defaultChartOptions: Required<ChartOptions> = {
    width: "100%",
    height: "250px",
};

const Chart = (props: {
    data: Point[];
    axesLabels?: { x?: string; y?: string };
    options?: ChartOptions;
    tooltip?: (point: Point) => JSX.Element;
}) => {
    let canvas!: HTMLCanvasElement;
    let tooltip!: HTMLDivElement;
    let container!: HTMLDivElement;
    let hoveredBar: number | null = null;
    let lastKnownSize: { width: number; height: number } | null = null;
    let resizeTimeout: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let animationStartTime: number | null = null;
    let animationProgress: number = 0;
    let isAnimating: boolean = false;

    const [hoveredData, setHoveredData] = createSignal<Point | null>(null);

    const styles = getComputedStyle(document.documentElement);

    const getDevicePixelRatio = () => window.devicePixelRatio || 1;

    const startAnimation = () => {
        if (isAnimating) return;

        isAnimating = true;
        animationStartTime = performance.now();
        animationProgress = 0;

        const animate = (currentTime: number) => {
            if (!animationStartTime) return;

            const elapsed = currentTime - animationStartTime;
            const progress = Math.min(
                elapsed / ChartConstants.animationDuration,
                1,
            );
            animationProgress = ChartConstants.animationEasing(progress);

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            render(ctx);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                isAnimating = false;
                animationStartTime = null;
            }
        };

        requestAnimationFrame(animate);
    };

    const getCanvasDimensions = () => {
        const dpr = getDevicePixelRatio();
        return {
            width: canvas.width / dpr,
            height: canvas.height / dpr,
        };
    };

    const getResponsiveDimensions = () => {
        const rect = container.getBoundingClientRect();
        const containerWidth = Math.floor(rect.width);
        const containerHeight = Math.floor(rect.height);

        return {
            width: containerWidth,
            height: containerHeight,
        };
    };

    const updateChartSize = () => {
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }

        resizeTimeout = window.setTimeout(() => {
            const dimensions = getResponsiveDimensions();

            if (
                lastKnownSize &&
                lastKnownSize.width === dimensions.width &&
                lastKnownSize.height === dimensions.height
            ) {
                return;
            }

            lastKnownSize = { ...dimensions };
            setupCanvas(dimensions.width, dimensions.height);
        }, 16);
    };

    const setupResponsive = () => {
        setTimeout(() => {
            updateChartSize();
        }, 100);

        const handleResize = () => {
            updateChartSize();
        };
        window.addEventListener("resize", handleResize);

        const parentContainer = container.parentElement;
        if (parentContainer) {
            resizeObserver = new ResizeObserver(() => {
                updateChartSize();
            });
            resizeObserver.observe(parentContainer);
        }

        return () => {
            window.removeEventListener("resize", handleResize);
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
        };
    };

    const getOffsets = () => {
        return {
            xOffset: ChartConstants.xOffset,
            yOffset: ChartConstants.yOffset,
        };
    };

    const getChartDimensions = () => {
        const offsets = getOffsets();
        const canvasDims = getCanvasDimensions();
        return {
            width: canvasDims.width - offsets.xOffset,
            height: canvasDims.height - offsets.yOffset,
            offsets: {
                xOffset: offsets.xOffset,
                yOffset: 0,
            },
        };
    };

    const getDataRanges = () => {
        const yValues = props.data.map((point) => point.y);
        const rawYMin = Math.min(...yValues);
        const rawYMax = Math.max(...yValues);
        const rawYRange = rawYMax - rawYMin;
        const padding = rawYRange * ChartConstants.yRangePadding;

        const step = ChartConstants.yAxisStep;
        const axisMinLabel = Math.floor((rawYMin - padding) / step) * step;
        const axisMaxLabel = Math.ceil((rawYMax + padding) / step) * step;

        return {
            yMin: axisMinLabel,
            yMax: axisMaxLabel,
            yRange: axisMaxLabel - axisMinLabel,
        };
    };

    const getYAxisValues = (ranges: { yMin: number; yMax: number }) => {
        const step = ChartConstants.yAxisStep;

        const minLabel = ranges.yMin;
        const maxLabel = ranges.yMax + step;

        const yValues: number[] = [];
        for (let value = maxLabel; value >= minLabel; value -= step) {
            yValues.push(Math.round(value * 10) / 10);
        }

        return yValues;
    };

    const getBarLayout = () => {
        const dimensions = getChartDimensions();
        const { width: chartWidth } = dimensions;
        const totalBars = props.data.length;
        const availableWidth = chartWidth - ChartConstants.chartPadding * 2;
        const barWidth = Math.floor(availableWidth / totalBars);
        const borderRadius = Math.min(
            barWidth * ChartConstants.borderRadiusRatio,
            ChartConstants.maxBorderRadius,
        );

        return {
            barWidth,
            borderRadius,
        };
    };

    const getBarPosition = (index: number) => {
        const dimensions = getChartDimensions();
        const layout = getBarLayout();
        return Math.floor(
            dimensions.offsets.xOffset +
                ChartConstants.chartPadding +
                index * layout.barWidth,
        );
    };

    const getYPosition = (
        value: number,
        ranges: { yMax: number; yRange: number },
        chartHeight: number,
    ) => {
        const dimensions = getChartDimensions();

        const topPadding = 20;
        const yPos =
            dimensions.offsets.yOffset +
            topPadding +
            ((ranges.yMax - value) / ranges.yRange) *
                (chartHeight - topPadding);

        return yPos;
    };

    // Helper function to get color for a value
    const getColorForValue = (value: number) => {
        if (Math.abs(value) === 0.1) {
            return styles.getPropertyValue("--color-chart-purple");
        } else if (value < 0) {
            return styles.getPropertyValue("--color-chart-green");
        } else {
            return styles.getPropertyValue("--color-chart-blue");
        }
    };

    // Helper function to get color for a segment based on its value range
    const getColorForSegment = (startValue: number, endValue: number) => {
        // If both values are the same, use that value's color
        if (startValue === endValue) {
            return getColorForValue(startValue);
        }

        // If segment crosses zero line, use the dominant value
        if (
            (startValue < 0 && endValue > 0) ||
            (startValue > 0 && endValue < 0)
        ) {
            // For crossing segments, use the color of the larger absolute value
            return Math.abs(startValue) > Math.abs(endValue)
                ? getColorForValue(startValue)
                : getColorForValue(endValue);
        }

        // If segment crosses 0.1% line, use purple
        if (
            (startValue < 0.1 && endValue > 0.1) ||
            (startValue > 0.1 && endValue < 0.1)
        ) {
            return styles.getPropertyValue("--color-chart-purple");
        }

        // For segments within the same range, use the average value
        const avgValue = (startValue + endValue) / 2;
        return getColorForValue(avgValue);
    };

    // Helper function to find intersection point with zero line or 0.1% line
    const findIntersection = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        targetY: number,
    ) => {
        if (y1 === y2) return null; // No intersection if line is horizontal
        const t = (targetY - y1) / (y2 - y1);
        if (t < 0 || t > 1) return null; // Intersection is outside the segment
        return { x: x1 + t * (x2 - x1), y: targetY };
    };

    // Helper function to draw a simple line segment
    const drawSimpleSegment = (
        ctx: CanvasRenderingContext2D,
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        startValue: number,
        endValue: number,
    ) => {
        ctx.strokeStyle = getColorForSegment(startValue, endValue);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    };

    const drawComplexSegment = (
        ctx: CanvasRenderingContext2D,
        currentData: Point,
        nextData: Point,
        currentX: number,
        currentY: number,
        nextX: number,
        nextY: number,
        zeroIntersection: Point,
        point1Intersection: Point,
    ) => {
        const segments = [];

        // Start segment
        segments.push({
            x: currentX,
            y: currentY,
            color: getColorForValue(currentData.y),
        });

        // Add intersection points
        if (zeroIntersection) {
            segments.push({
                x: zeroIntersection.x,
                y: zeroIntersection.y,
                color: getColorForValue(0),
            });
        }
        if (point1Intersection) {
            segments.push({
                x: point1Intersection.x,
                y: point1Intersection.y,
                color: getColorForValue(0.1),
            });
        }

        // End segment
        segments.push({
            x: nextX,
            y: nextY,
            color: getColorForValue(nextData.y),
        });

        // Sort segments by x position
        segments.sort((a, b) => a.x - b.x);

        // Draw each segment with proper color logic
        for (let j = 0; j < segments.length - 1; j++) {
            const current = segments[j];
            const next = segments[j + 1];

            // Determine the actual values for this sub-segment
            let startValue: number, endValue: number;

            if (j === 0) {
                startValue = currentData.y;
                endValue = zeroIntersection
                    ? 0
                    : point1Intersection
                      ? 0.1
                      : nextData.y;
            } else if (j === segments.length - 2) {
                startValue = zeroIntersection
                    ? 0
                    : point1Intersection
                      ? 0.1
                      : currentData.y;
                endValue = nextData.y;
            } else {
                // Middle segments (between intersections)
                startValue = zeroIntersection ? 0 : 0.1;
                endValue = point1Intersection ? 0.1 : 0;
            }

            drawSimpleSegment(
                ctx,
                current.x,
                current.y,
                next.x,
                next.y,
                startValue,
                endValue,
            );
        }
    };

    const drawData = (ctx: CanvasRenderingContext2D) => {
        const ranges = getDataRanges();
        const dimensions = getChartDimensions();
        const { height: chartHeight } = dimensions;
        const layout = getBarLayout();

        ctx.lineWidth = 2;
        ctx.lineCap = "butt";
        ctx.lineJoin = "miter";

        // Draw line segments with proper color transitions
        for (let i = 0; i < props.data.length - 1; i++) {
            const currentData = props.data[i];
            const nextData = props.data[i + 1];

            const currentBarX = getBarPosition(i);
            const nextBarX = getBarPosition(i + 1);
            const zeroYPosition = getYPosition(0, ranges, chartHeight);

            const currentY = getYPosition(currentData.y, ranges, chartHeight);
            const nextY = getYPosition(nextData.y, ranges, chartHeight);

            const currentX = currentBarX + layout.barWidth / 2;
            const nextX = nextBarX + layout.barWidth / 2;

            const animatedCurrentY =
                zeroYPosition + (currentY - zeroYPosition) * animationProgress;
            const animatedNextY =
                zeroYPosition + (nextY - zeroYPosition) * animationProgress;

            // Check if segment crosses zero line or 0.1% line
            const zeroIntersection = findIntersection(
                currentX,
                animatedCurrentY,
                nextX,
                animatedNextY,
                zeroYPosition,
            );
            const targetY = getYPosition(0.1, ranges, chartHeight);
            const animatedTargetY =
                zeroYPosition + (targetY - zeroYPosition) * animationProgress;
            const point1Intersection = findIntersection(
                currentX,
                animatedCurrentY,
                nextX,
                animatedNextY,
                animatedTargetY,
            );

            // If no intersections, draw the entire segment with one color
            if (!zeroIntersection && !point1Intersection) {
                drawSimpleSegment(
                    ctx,
                    currentX,
                    animatedCurrentY,
                    nextX,
                    animatedNextY,
                    currentData.y,
                    nextData.y,
                );
            } else {
                drawComplexSegment(
                    ctx,
                    currentData,
                    nextData,
                    currentX,
                    animatedCurrentY,
                    nextX,
                    animatedNextY,
                    zeroIntersection,
                    point1Intersection,
                );
            }
        }
    };

    const drawGrid = (ctx: CanvasRenderingContext2D) => {
        const ranges = getDataRanges();
        const dimensions = getChartDimensions();
        const { height: chartHeight } = dimensions;
        const canvasDims = getCanvasDimensions();

        ctx.strokeStyle = ChartConstants.gridColor;
        const yAxisValues = getYAxisValues(ranges);

        // Horizontal grid lines
        yAxisValues.forEach((yValue) => {
            const yPosition = getYPosition(yValue, ranges, chartHeight);
            ctx.beginPath();
            ctx.moveTo(dimensions.offsets.xOffset, yPosition);
            ctx.lineTo(canvasDims.width, yPosition);
            ctx.stroke();
        });
    };

    const drawAxesLabels = (ctx: CanvasRenderingContext2D) => {
        const dimensions = getChartDimensions();
        const { height: chartHeight } = dimensions;

        ctx.fillStyle = styles.getPropertyValue("--color-white-50");
        ctx.textAlign = "center";

        // Y-axis label
        if (props.axesLabels && props.axesLabels.y) {
            ctx.save();
            ctx.translate(
                dimensions.offsets.xOffset -
                    ChartConstants.yDataLabelOffset -
                    ChartConstants.yAxisLabelOffset,
                dimensions.offsets.yOffset + chartHeight / 2,
            );
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(props.axesLabels.y, 0, 0);
            ctx.restore();
        }

        ctx.textAlign = "left"; // Reset to default
    };

    const drawDataLabels = (ctx: CanvasRenderingContext2D) => {
        const ranges = getDataRanges();
        const dimensions = getChartDimensions();
        const { height: chartHeight } = dimensions;

        ctx.fillStyle = styles.getPropertyValue("--color-white-50");

        const yAxisValues = getYAxisValues(ranges);
        yAxisValues.forEach((yValue) => {
            const yPosition = getYPosition(yValue, ranges, chartHeight);
            const formattedYValue =
                Math.abs(yValue) < 0.01 ? "0.0%" : `${yValue.toString()}%`;

            ctx.fillText(
                formattedYValue,
                dimensions.offsets.xOffset - ChartConstants.yDataLabelOffset,
                yPosition + 2,
            );
        });

        ctx.textAlign = "left";
    };

    const drawAxes = (ctx: CanvasRenderingContext2D) => {
        const ranges = getDataRanges();
        const dimensions = getChartDimensions();
        const { height: chartHeight } = dimensions;
        const canvasDims = getCanvasDimensions();

        ctx.strokeStyle = ChartConstants.gridColor;
        ctx.lineWidth = 1;

        const xAxisYPosition =
            ranges.yMin < 0 && ranges.yMax > 0
                ? Math.floor(getYPosition(0, ranges, chartHeight))
                : Math.floor(getYPosition(ranges.yMin, ranges, chartHeight));
        ctx.beginPath();
        ctx.moveTo(dimensions.offsets.xOffset, xAxisYPosition);
        ctx.lineTo(canvasDims.width, xAxisYPosition);
        ctx.stroke();

        const yAxisValues = getYAxisValues(ranges);
        const yAxisTop = getYPosition(yAxisValues[0], ranges, chartHeight);
        const yAxisBottom = getYPosition(
            yAxisValues[yAxisValues.length - 1],
            ranges,
            chartHeight + 25,
        );
        ctx.beginPath();
        ctx.moveTo(dimensions.offsets.xOffset, yAxisTop);
        ctx.lineTo(dimensions.offsets.xOffset, yAxisBottom);
        ctx.stroke();
    };

    const getMousePosition = (event: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const dpr = getDevicePixelRatio();
        const scaleX = canvas.width / dpr / rect.width;
        const scaleY = canvas.height / dpr / rect.height;
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY,
            rect,
        };
    };

    const findHoveredBar = (x: number, y: number) => {
        const dimensions = getChartDimensions();
        const { height: chartHeight } = dimensions;
        const layout = getBarLayout();

        return props.data.findIndex((_, index) => {
            const barX = getBarPosition(index);
            const barRight = barX + layout.barWidth;
            return (
                x >= barX &&
                x <= barRight &&
                y >= dimensions.offsets.yOffset &&
                y <= dimensions.offsets.yOffset + chartHeight
            );
        });
    };

    const updateTooltip = (barIndex: number, rect: DOMRect) => {
        const layout = getBarLayout();
        const ranges = getDataRanges();
        const dimensions = getChartDimensions();
        const { height: chartHeight } = dimensions;
        const barX = getBarPosition(barIndex);
        const barCenterX = barX + layout.barWidth / 2;

        const maxYPosition = getYPosition(ranges.yMax, ranges, chartHeight);

        tooltip.style.display = "block";
        tooltip.style.left = `${rect.left + barCenterX - 28}px`;
        tooltip.style.top = `${rect.top + maxYPosition - 40}px`;
        setHoveredData(props.data[barIndex]);
    };

    const handleMouseMove = (event: MouseEvent) => {
        const { x, y, rect } = getMousePosition(event);
        const barIndex = findHoveredBar(x, y);
        const newHoveredBar = barIndex !== -1 ? barIndex : null;

        if (newHoveredBar !== hoveredBar) {
            hoveredBar = newHoveredBar;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            render(ctx);

            if (hoveredBar !== null) {
                updateTooltip(hoveredBar, rect);
            } else {
                tooltip.style.display = "none";
            }
        }
    };

    const handleMouseLeave = () => {
        hoveredBar = null;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        render(ctx);

        tooltip.style.display = "none";
        setHoveredData(null);
    };

    const drawTooltipLine = (ctx: CanvasRenderingContext2D) => {
        if (hoveredBar === null) return;

        const dimensions = getChartDimensions();
        const { height: chartHeight } = dimensions;
        const layout = getBarLayout();
        const ranges = getDataRanges();
        const data = props.data[hoveredBar];

        const barX = getBarPosition(hoveredBar);
        const barCenterX = barX + layout.barWidth / 2;

        const zeroYPosition = getYPosition(0, ranges, chartHeight);
        const dataYPosition = getYPosition(data.y, ranges, chartHeight);
        const barTop = data.y >= 0 ? dataYPosition : zeroYPosition;
        const maxYPosition = getYPosition(ranges.yMax, ranges, chartHeight);

        ctx.strokeStyle = styles.getPropertyValue("--color-white-15");
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(barCenterX, maxYPosition);
        ctx.lineTo(barCenterX, barTop);
        ctx.stroke();
    };

    const render = (ctx: CanvasRenderingContext2D) => {
        drawAxes(ctx);
        drawGrid(ctx);
        drawData(ctx);
        // drawThresholdLine(ctx);
        drawDataLabels(ctx);
        drawAxesLabels(ctx);
        drawTooltipLine(ctx);
    };

    const setupCanvas = (width?: number, height?: number) => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dimensions =
            width && height ? { width, height } : getResponsiveDimensions();

        const dpr = getDevicePixelRatio();

        canvas.width = dimensions.width * dpr;
        canvas.height = dimensions.height * dpr;

        canvas.style.cssText = `
            width: ${dimensions.width}px;
            height: ${dimensions.height}px;
            display: block;
            max-width: 100%;
            max-height: 100%;
        `;

        ctx.scale(dpr, dpr);
        ctx.font = ChartConstants.fontSize;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        animationProgress = 0;
        render(ctx);
        startAnimation();
    };

    onMount(() => {
        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener("mouseleave", handleMouseLeave);

        const cleanup = setupResponsive();

        onCleanup(() => {
            canvas.removeEventListener("mousemove", handleMouseMove);
            canvas.removeEventListener("mouseleave", handleMouseLeave);
            cleanup();
        });
    });

    return (
        <div
            ref={container}
            style={{
                position: "relative",
                width: (() =>
                    props.options?.width
                        ? props.options.width
                        : defaultChartOptions.width)(),
                height: (() =>
                    props.options?.height
                        ? props.options.height
                        : defaultChartOptions.height)(),
                display: "flex",
                "flex-direction": "column",
            }}>
            <canvas ref={canvas} />
            <div
                ref={tooltip}
                style={{
                    position: "fixed",
                    background: "rgba(0, 0, 0)",
                    padding: "4px 8px",
                    "border-radius": "4px",
                    "z-index": 1000,
                    display: "none",
                }}>
                <Show when={hoveredData()}>{props.tooltip(hoveredData())}</Show>
            </div>
        </div>
    );
};

export default Chart;
