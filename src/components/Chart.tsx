import { onCleanup, onMount } from "solid-js";

type ChartOptions = {
    width?: number;
    height?: number;
};

export type Point = {
    x: string;
    y: number;
};

const CHART_CONSTANTS = {
    X_OFFSET: 60,
    Y_OFFSET_RATIO: 0.1,
    PADDING: 20,
    BORDER_RADIUS_RATIO: 0.2,
    MAX_BORDER_RADIUS: 4,
    Y_AXIS_STEP: 0.1,
    Y_RANGE_PADDING: 0.1,
    TOOLTIP_OFFSET: 30,
    LABEL_OFFSET: 35,
    Y_LABEL_OFFSET: 45,
    GRID_COLOR: "#dddddd10",
    AXIS_COLOR: "#dddddd10",
    FONT_SIZE: "0.7rem Noto Sans",
} as const;

const DEFAULT_CHART_OPTIONS: Required<ChartOptions> = {
    width: 400,
    height: 300,
};

const Chart = (props: {
    data: Point[];
    axesLabels?: { x: string; y: string };
    options?: ChartOptions;
}) => {
    let canvas!: HTMLCanvasElement;
    let tooltip!: HTMLDivElement;
    let container!: HTMLDivElement;
    let hoveredBar: number | null = null;
    let lastKnownSize: { width: number; height: number } | null = null;
    let resizeTimeout: number | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const styles = getComputedStyle(document.documentElement);

    const getDevicePixelRatio = () => window.devicePixelRatio || 1;

    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const getCanvasDimensions = () => {
        const dpr = getDevicePixelRatio();
        return {
            width: canvas.width / dpr,
            height: canvas.height / dpr,
        };
    };

    const getResponsiveDimensions = (options: Required<ChartOptions>) => {
        const rect = container.getBoundingClientRect();
        const containerWidth = Math.floor(rect.width);
        const containerHeight = Math.floor(rect.height);

        return {
            width: containerWidth > 0 ? containerWidth : options.width || 400,
            height:
                containerHeight > 0 ? containerHeight : options.height || 300,
        };
    };

    const updateChartSize = () => {
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }

        const options = { ...DEFAULT_CHART_OPTIONS, ...props.options };

        resizeTimeout = window.setTimeout(() => {
            const dimensions = getResponsiveDimensions(options);

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
        const canvasDims = getCanvasDimensions();
        return {
            xOffset: CHART_CONSTANTS.X_OFFSET,
            yOffset: Math.floor(
                canvasDims.height * CHART_CONSTANTS.Y_OFFSET_RATIO,
            ),
        };
    };

    const getChartDimensions = () => {
        const offsets = getOffsets();
        const canvasDims = getCanvasDimensions();
        return {
            width: canvasDims.width - offsets.xOffset,
            height: canvasDims.height - offsets.yOffset,
            offsets: offsets,
        };
    };

    const getDataRanges = () => {
        const yValues = props.data.map((point) => point.y);
        const rawYMin = Math.min(...yValues);
        const rawYMax = Math.max(...yValues);
        const rawYRange = rawYMax - rawYMin;
        const padding = rawYRange * CHART_CONSTANTS.Y_RANGE_PADDING;

        return {
            yMin: rawYMin - padding,
            yMax: rawYMax + padding,
            yRange: rawYRange + padding * 2,
        };
    };

    const getYAxisValues = (ranges: { yMin: number; yMax: number }) => {
        const step = CHART_CONSTANTS.Y_AXIS_STEP;
        const minLabel = Math.floor(ranges.yMin / step) * step;
        const maxLabel = Math.ceil(ranges.yMax / step) * step;

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
        const availableWidth = chartWidth - CHART_CONSTANTS.PADDING * 2;
        const barSpacing = 2;
        const totalSpacing = (totalBars - 1) * barSpacing;
        const barWidth = (availableWidth - totalSpacing) / totalBars;
        const borderRadius = Math.min(
            barWidth * CHART_CONSTANTS.BORDER_RADIUS_RATIO,
            CHART_CONSTANTS.MAX_BORDER_RADIUS,
        );

        return {
            barWidth,
            borderRadius,
            padding: CHART_CONSTANTS.PADDING,
            barSpacing,
        };
    };

    const getBarPosition = (index: number) => {
        const dimensions = getChartDimensions();
        const layout = getBarLayout();
        return (
            dimensions.offsets.xOffset +
            layout.padding +
            index * (layout.barWidth + layout.barSpacing)
        );
    };

    const getYPosition = (
        value: number,
        ranges: { yMax: number; yRange: number },
        chartHeight: number,
    ) => {
        const dimensions = getChartDimensions();
        return (
            dimensions.offsets.yOffset +
            ((ranges.yMax - value) / ranges.yRange) * chartHeight
        );
    };

    const drawRoundedRect = (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        width: number,
        height: number,
        radius: number,
        isPositive: boolean,
    ) => {
        if (height <= 0) {
            return;
        }

        ctx.beginPath();

        // Rounding corners
        if (isPositive) {
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height);
            ctx.lineTo(x, y + height);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
        } else {
            ctx.moveTo(x, y);
            ctx.lineTo(x + width, y);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(
                x + width,
                y + height,
                x + width - radius,
                y + height,
            );
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.fill();
    };

    const drawData = (ctx: CanvasRenderingContext2D) => {
        const ranges = getDataRanges();
        const dimensions = getChartDimensions();
        const { height: chartHeight } = dimensions;
        const layout = getBarLayout();

        props.data.forEach((data, index) => {
            const barX = getBarPosition(index);
            const zeroYPosition = getYPosition(0, ranges, chartHeight);
            const dataYPosition = getYPosition(data.y, ranges, chartHeight);
            const barY = data.y >= 0 ? dataYPosition : zeroYPosition;
            const barHeight = Math.abs(dataYPosition - zeroYPosition);

            ctx.save();
            const baseColor = data.y < 0 ? "#10B772" : "#1D91BB";
            const glowColor = hexToRgba(baseColor, 0.25);

            ctx.fillStyle = glowColor;
            ctx.filter = "blur(8px)";

            drawRoundedRect(
                ctx,
                barX - 4,
                barY - 4,
                layout.barWidth + 8,
                barHeight + 8,
                layout.borderRadius,
                data.y >= 0,
            );
            ctx.restore();

            ctx.fillStyle = baseColor;
            drawRoundedRect(
                ctx,
                barX,
                barY,
                layout.barWidth,
                barHeight,
                layout.borderRadius,
                data.y >= 0,
            );
        });
    };

    const drawGrid = (ctx: CanvasRenderingContext2D) => {
        const ranges = getDataRanges();
        const dimensions = getChartDimensions();
        const { height: chartHeight } = dimensions;
        const canvasDims = getCanvasDimensions();

        ctx.strokeStyle = CHART_CONSTANTS.GRID_COLOR;
        const yAxisValues = getYAxisValues(ranges);

        yAxisValues.forEach((yValue) => {
            const yPosition = getYPosition(yValue, ranges, chartHeight);
            ctx.beginPath();
            ctx.moveTo(dimensions.offsets.xOffset, yPosition);
            ctx.lineTo(canvasDims.width, yPosition);
            ctx.stroke();
        });
    };

    // const drawAxisLabels = (ctx: CanvasRenderingContext2D) => {
    //     const dimensions = getChartDimensions();
    //     const { height: chartHeight } = dimensions;

    //     ctx.fillStyle = styles.getPropertyValue("--color-text");
    //     ctx.textAlign = "center";

    //     if (props.axesLabels.y) {
    //         ctx.save();
    //         ctx.translate(
    //             dimensions.offsets.xOffset - CHART_CONSTANTS.Y_LABEL_OFFSET,
    //             dimensions.offsets.yOffset + chartHeight / 2,
    //         );
    //         ctx.rotate(-Math.PI / 2);
    //         ctx.fillText(props.axesLabels.y, 0, 0);
    //         ctx.restore();
    //     }

    //     ctx.textAlign = "left";
    // };

    const drawLabels = (ctx: CanvasRenderingContext2D) => {
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
                dimensions.offsets.xOffset - CHART_CONSTANTS.LABEL_OFFSET,
                yPosition + 2,
            );
        });
    };

    const drawAxes = (ctx: CanvasRenderingContext2D) => {
        const ranges = getDataRanges();
        const dimensions = getChartDimensions();
        const { height: chartHeight } = dimensions;
        const canvasDims = getCanvasDimensions();

        ctx.strokeStyle = CHART_CONSTANTS.AXIS_COLOR;
        ctx.lineWidth = 1;

        const xAxisYPosition =
            ranges.yMin < 0 && ranges.yMax > 0
                ? getYPosition(0, ranges, chartHeight)
                : getYPosition(ranges.yMin, ranges, chartHeight);
        ctx.beginPath();
        ctx.moveTo(dimensions.offsets.xOffset, xAxisYPosition);
        ctx.lineTo(canvasDims.width, xAxisYPosition);
        ctx.stroke();

        const yAxisValues = getYAxisValues(ranges);
        const yAxisTop = getYPosition(yAxisValues[0], ranges, chartHeight);
        const yAxisBottom = getYPosition(
            yAxisValues[yAxisValues.length - 1],
            ranges,
            chartHeight,
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
        tooltip.innerHTML = `
            <div>${props.data[barIndex].y}%<br/>
                ${props.data[barIndex].x}
            </div>
        `;
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
        drawLabels(ctx);
        // drawAxisLabels(ctx);
        drawTooltipLine(ctx);
    };

    const setupCanvas = (width?: number, height?: number) => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const options = { ...DEFAULT_CHART_OPTIONS, ...props.options };
        const dimensions =
            width && height
                ? { width, height }
                : getResponsiveDimensions(options);

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
        ctx.font = CHART_CONSTANTS.FONT_SIZE;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        render(ctx);
    };

    onMount(() => {
        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener("mouseleave", handleMouseLeave);

        const cleanup = setupResponsive();

        onCleanup(() => {
            if (cleanup) cleanup();
        });
    });

    return (
        <div
            ref={container}
            style={{
                position: "relative",
                width: "100%",
                height: (() => {
                    const options = {
                        ...DEFAULT_CHART_OPTIONS,
                        ...props.options,
                    };
                    return options.height ? `${options.height}px` : "300px";
                })(),
                display: "flex",
                "flex-direction": "column",
            }}>
            <canvas ref={canvas} />
            <div
                ref={tooltip}
                style={{
                    position: "fixed",
                    background: "rgba(0, 0, 0)",
                    color: "var(--color-text)",
                    padding: "4px 8px",
                    "border-radius": "4px",
                    "font-size": "12px",
                    "pointer-events": "none",
                    "z-index": 1000,
                    display: "none",
                }}
            />
        </div>
    );
};

export default Chart;
