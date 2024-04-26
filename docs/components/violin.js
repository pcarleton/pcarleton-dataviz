import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";


// Heavily inspired by https://observablehq.com/@jonhelfman/plot-violin-chart-with-facet
const bwEstimate = data => {
    const A = Math.min(
        d3.deviation(data),
        (d3.quantile(data, 0.75) - d3.quantile(data, 0.25)) / 1.34
    );
    return 0.9 * A * Math.pow(data.length, -1 / 5);
}

const kde = (kernel, thds) => V => thds.map(t => [t, d3.mean(V, d => kernel(t - d))]);

const epanechnikov = bandwidth => x =>
  Math.abs((x /= bandwidth)) <= 1 ? (0.75 * (1 - x * x)) / bandwidth : 0;

export const calculateDensities = (groups, {bandwidth = 0} = {}) => {
    const a = [];
    groups.map((d, i) => {
      const raw = d.points.sort((a, b) => a - b);
      if (!bandwidth) bandwidth = bwEstimate(raw);
    //   const bandwidth = bwEstimate(raw);
      const data2 = kde(epanechnikov(bandwidth), raw)(raw);
      data2.forEach(f => a.push({ y: f[0], x: f[1], i: i, m: d3.median(raw), label: d.label }));
    });
    return a;
}

// Data is assumed to be in the shape:
// [
//   {points: [1, 2, ...], label: "a"},
//   {points: [1.2, 3.4, ...], label: "b"},
//   ...
// ]
export const violinPlot = (data, {gap = 0, bandwidth = 0, options = {}, marks = []} = {}) => {
    const densities = calculateDensities(data, {bandwidth});
    const r = gap;
    marks = marks || [];
    return Plot.plot({
        // grid: true,
        ...options,
        marks: [
          Plot.ruleY([0], { strokeOpacity: 0.6 }),
          Plot.areaX(densities, {
            x: d => d.x + r * d.i,
            x1: d => r * d.i,
            // x1: d => d.label,
            // z: "i",
            y: "y",
            fx: "label",
            fillOpacity: 0.2
          }),
        //   Plot.dot(densities, {
        //     x: d => d.x + r * d.i,
        //     y: "y",
        //     z: "i",
        //     strokeOpacity: showSamples ? 1 : 0
        //   }),
          Plot.lineX(densities, {
            x: d => d.x + r * d.i,
            z: "i",
            y: "y",
            fx: "label",

          }),
          Plot.areaX(densities, {
            x: d => -d.x + r * d.i,
            x1: d => r * d.i,
            y: "y",
            z: "i",
            fx: "label",

            fillOpacity: 0.2
          }),
          Plot.lineX(densities, {
            x: d => -d.x + r * d.i,
            z: "i",
            fx: "label",

            y: "y"
          }),
          Plot.dot(
            densities,
            Plot.selectFirst({
              y: d => d.m,
              stroke: "#000",
              x: d => r * d.i,
              z: "i",
              fx: "label",
            })
          ),
          ...marks
        ]
      });
}