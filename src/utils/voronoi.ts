import * as d3 from "d3";

class Voronoi {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    sites: any;
    nbParticles: number;
    speed: any;
    voronoi: any;
    width: number;
    height: number;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.sites = null;
        this.nbParticles = null;
        this.speed = null;
        this.voronoi = null;
    }

    init(nbParticle: number) {
        this.context = this.canvas.getContext("2d");
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        window.addEventListener("resize", this.onResize.bind(this), false);
        this.nbParticles = nbParticle;
        this.speed = [];
        for (let i = 0; i < this.nbParticles; i++) this.speed[i] = [];
        this.sites = d3.range(this.nbParticles).map(function (d) {
            return [
                Math.random() * window.innerWidth,
                Math.random() * window.innerHeight,
            ];
        });
        this.initRandomSpeed();
        this.redraw();
        this.draw();
    }
    initRandomSpeed() {
        const s = 0.1;
        for (let i = 0; i < this.nbParticles; i++) {
            if (i % 2) {
                this.speed[i].x = -Math.random() + 1;
                this.speed[i].y = -Math.random() + 1;
            } else {
                this.speed[i].x = Math.random() + 1;
                this.speed[i].y = Math.random() + 1;
            }
            this.speed[i].x *= s;
            this.speed[i].y *= s;
        }
    }
    rebondOnScreen() {
        for (let i = 0; i < this.sites.length; i++) {
            if (this.sites[i][0] < 0 || this.sites[i][0] > window.innerWidth) {
                this.speed[i].x *= -1;
            }
            if (this.sites[i][1] < 0 || this.sites[i][1] > window.innerHeight) {
                this.speed[i].y *= -1;
            }
            this.sites[i][0] += this.speed[i].x;
            this.sites[i][1] += this.speed[i].y;
        }
    }
    redraw() {
        let voronoi = d3.voronoi().extent([
            [-1, -1],
            [this.width + 1, this.height + 1],
        ]);
        let diagram = voronoi(this.sites);
        let polygons = diagram.polygons();
        this.context.clearRect(0, 0, this.width, this.height);
        this.context.beginPath();
        let h: number;
        for (h = 0; h < polygons.length; ++h) {
            this.drawCell(polygons[h]);
        }
        this.context.lineWidth = 2;
        this.context.stroke();
    }
    drawCell(cell: any) {
        if (!cell) return false;
        this.context.moveTo(cell[0][0], cell[0][1]);
        for (let j = 1, m = cell.length; j < m; ++j) {
            this.context.lineTo(cell[j][0], cell[j][1]);
        }
        this.context.closePath();
        return true;
    }
    draw() {
        requestAnimationFrame(this.draw.bind(this));
        this.rebondOnScreen();
        this.redraw();
    }
    onResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.sites = d3.range(this.nbParticles).map(function (d: any) {
            return [
                Math.random() * window.innerWidth,
                Math.random() * window.innerHeight,
            ];
        });
    }
}

export { Voronoi };
