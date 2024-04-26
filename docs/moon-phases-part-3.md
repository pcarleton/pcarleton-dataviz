---
title: Moon Phases Part 3, Corrections competition
---

# Moon Phases Part 3, Corrections competition
In the last post, I got that the Astronomical Algorithms code working. That code starts from a similar (ish) model to the "anchor on a known new moon & extrapolate", but then it adds a bunch of periodic correction terms based on other factors that affect the moons position.

While it's great that it gives me the correct answer, I'd like to understand more about _how_ it does that. I could try to wade through a bunch of papers, but they're not really tailored for a casual observer, so instead, I'll start by treating the correctinos as a kind of "black box", find what terms matter the most, focus on their inputs, and that should give me an idea of what influences the moon's position most.

## Example corrections

Let's look at the corrections for a single lunation:

```js
import * as luxon from "npm:luxon";

import {
    calculateJDEcorrected,
    calculateCorrections,
    fullMoonCorrectionsRaw,
    newMoonCorrectionsRaw,
    calculateCorrectionInputs,
    planetaryCorrections, jdeToTimestamp, simplePhaseChar, simpleLunForDate, nearestK, MEAN_LUNATION
} from './components/moonCalculator.js';

import {violinPlot} from "./components/violin.js";

```

```js echo 

const jan2023 = luxon.DateTime.fromISO("2023-01-31");
const jan2023k = nearestK(jan2023);

const nmci1 = calculateCorrectionInputs(jan2023k);
const nmc1 = newMoonCorrectionsRaw(nmci1);
const fmci1 = calculateCorrectionInputs(jan2023k + 0.5);
const fmc1 = fullMoonCorrectionsRaw(fmci1);
```


```js
const plottableCorrections = (vs) => {
    return vs.map(
        (v, i) => ({v: v*24, term: i})
    ).sort(
        (a, b) => b.v - a.v
    ).map(
        (d, i) => ({...d, i})
    );
}

const plotCorrections = (vs, options) => {
    display(Plot.plot({
    y: { label: "Hours" },
    height: 150,
    color: { legend: false, scheme: "Observable10" },
  marks: [
    Plot.frame({ strokeOpacity: 0.1 }),
    Plot.barY(
      plottableCorrections(vs),
      {x: "term", y: "v", fill: "term"}
    ),
    Plot.ruleY([0])
  ],
      ...options,

}))
}

plotCorrections(nmc1, {title: "New Moon Corrections"});
plotCorrections(fmc1, {title: "Full Moon Corrections"});
```


So the biggest corrections for this _particular_ lunation is 1.2 hours for the new moon and about 4 hours for the full moon.

Below, there's graphs for all phases with a selector for 50 different lunations.

```js
const lunations = 50;
const all2023 = d3.range(jan2023k, jan2023k + lunations).map(k0 => {
    return ['🌑', '🌓', '🌕', '🌗'].map((e, j) => {
        const k = k0 + j*0.25;
        const ci = calculateCorrectionInputs(k);
        const c = calculateCorrections(k, ci);
        const plottable = plottableCorrections(c);
        return plottable.map(d => ({...d, k, phase: e, date: jdeToTimestamp(calculateJDEcorrected(k))}));
    });
})

const lunselector1 = view(Inputs.range([0, all2023.length-1], {label: "Which lunation to view", step: 1, value: 0}));

```

```js
const selectedLunation = all2023[lunselector1].flat();
display(Plot.plot({
    y: { label: "Hours", domain: [-17, 17] },
    x: {axis: false},
    // facet: {y: "phase", data: all2023},
    height: 200,
    color: { legend: false, scheme: "Observable10" },
  marks: [
    Plot.frame({ strokeOpacity: 0.1 }),
    Plot.barY(
      selectedLunation,
      {x: "term", y: "v", fill: "term", fx: "phase"}
    ),
    Plot.ruleY([0])
  ],
}))
```

## Corrections over time

Let's see what these corrections look like over time.  Below are those same 50 lunations corrections plotted over time

```js

display(Plot.plot({
    y: { label: "Hours" },
    // height: 150,
    color: { legend: false, scheme: "Observable10" },
  marks: [
    Plot.frame({ strokeOpacity: 0.1 }),
    Plot.rectY([all2023[lunselector1]], {x1: d => d[0][0].date, x2: d => d[3][0].date, y1: -15, y2: 15, fill: "#ddd"}),
    Plot.line(
      all2023.map(d => d.flat()).flat(),
      {x: d => d.date.toJSDate(), y: "v", stroke: "term", fy: "phase"}
    ),
    Plot.ruleY([0])
  ],
    //   ...options,
}))
```

It's clear that the first 2 terms dominate. It's also interesting to note that for term 1,  the corrections move similarly for all phases (the golden line), but for term 0, the adjustments per phase are very differently (the blue line).  This is more clear if you scroll back up to see the individual corrections for a selected lunation and see all gold bars moving up and down together, but blue bars being positive or negative depending on the phase.

### Dominating Terms

To get a sense of just how much they dominate, we can compare the distribution of the 2 top terms over 2023 with the sum of all of the other terms.
```js
// // [
//   {points: [1, 2, ...], label: "a"},
//   {points: [1.2, 3.4, ...], label: "b"},
//   ...
// ]//
//display(fmc2023)
const groupByTopTerm = (d0) => {
    let [t0, t1, both, rest, all] = [0, 0, 0, 0, 0];
    d0.forEach(d => {
        if (d.term === 0) {
            t0 = d.v;
            both += d.v;
        } else if (d.term === 1) {
            t1 = d.v;
            both += d.v;
        } else {
            rest += d.v;
        }
        all += d.v;
    })
    return [{v: t0, term: "0"}, {v: t1, term: "1"}, {v: rest, term: "other"}, {v: both, term: "both"}, {v: all, term: "all"}];
}

const g2023 = Object.groupBy(all2023.flat().map(groupByTopTerm).flat(), d => d.term);
const violinData = Object.entries(g2023).map(([k, v]) => ({label: k, points: v.map(d => d.v)}));
display(violinPlot(violinData, {marks: [Plot.gridY({interval: 1, stroke: "#ddd", strokeOpacity: 0.5})]}))
```

We see about ${tex`\pm 15c\text{ hours}`} for term 0 and ${tex`\pm 4\text{ hours}`} for term 1.  We can also see that the sum of the other terms is ${tex`\pm 1\text{ hour}`}.  Interestingly, together, the top 2 terms extend to ${tex`\pm 19\text{ hours}`}, and all together, it looks pretty similar to just the top 2 terms.

We could have also gotten these numbers by peeling back our "black box" a little bit a looking at the coefficients on the correction terms.  Here are the top 2 terms:

```
// New Moon
-0.40720 * Math.sin(Mprime)
+0.17241 * E * Math.sin(M)

// Full Moon
-0.40614 * Math.sin(Mprime)
+0.17302 * E * Math.sin(M)

// Quarters
-0.62801 * Math.sin(Mprime)
+0.17172 * E * Math.sin(M)
```

Notice that ${tex`0.62801 * 24 = 15.07`} which is the extent of the distribution we see above. This makes sense because the `Math.sin` is going to fluctuate between 0 and 1.

### Mean Anomaly

To understand what these terms correspond to, remember that ${tex`M'`} (`MPrime`) is the Moon's mean anomaly and that ${tex`M`} is the Sun's mean anomaly. [Mean anomaly](https://en.wikipedia.org/wiki/Mean_anomaly) is how far along an object is in its orbit expressed as an angle, where 0 is its closest point (periapsis/pericenter), and 180° or ${tex`\pi`} radians is its furthest apoapsis. What was not intuitive to me is that mean anomaly advances smoothly over time (hence mean).  The actual angle from the focus of the elliptical orbit is the "true anomaly".

What orbit would the Sun be travelling on to have a mean anomaly? These formula are geocentric, meaning that they "pretend" that the sun orbits the earth. Otherwise the Sun's mean anomaly wouldn't make sense. So what the mean anomaly is describing is how far along from perigree the Sun or Moon is in its orbit.

```js
const anoms = d3.range(jan2023k, jan2023k + lunations, 0.05).map(k => {
    const ci = calculateCorrectionInputs(k);
    const terms = [{v: ci.M, term: 'M'}, {v: ci.Mprime, term: 'M\''}]
    return terms.map(d => ({...d, k, date: jdeToTimestamp(calculateJDEcorrected(k))}));
})

display(Plot.plot({
    y: { label: "Radians" },
    height: 150,
    color: { legend: true, scheme: "Observable10" },
  marks: [
    Plot.frame({ strokeOpacity: 0.1 }),
    Plot.line(
      anoms.flat(),
      {x: d => d.date.toJSDate(), y: "v", stroke: "term"}
    ),
    Plot.ruleY([0])
  ],
    //   ...options,
}))
```

If we plot them, we see that the Moon's mean anomaly oscillates much more quickly since it's orbiting on average once every 29.5 days, meanwhile the Sun "orbits" the earth once per year.  Put it in "heliocentric" terms, it takes a year between the Earth starting at its closest point and then travelling back to that same point.

This explains what we saw earlier with the term1 (Sun's mean anomaly) moving together across all phases, but the Moon's mean anomaly not. This is because the Sun's mean anomaly doesn't change as much over the course of a single lunation, but the Moon's mean anomaly goes through its full 0° to 360° cycle.


## Conclusion

Taking this "black box" approach makes it clear that the 2 most influential pieces are the Moon's relative distance from pergiee and the Earth's relative distance from its perihelion points in that order. I'd like to get a better intution about what direction (sooner or later) these 2 mean anomalies push the phases.  But I'll tackle that in another post!


# Bonus

A neat fun fact from the Mean Anomaly chart is that the Earth is closest to the sun in January which is in the winter (Northen Hemisphere). It's funny because the most often incorrect answer folks give about why winter is colder is related to distance to the sun, but the distance is reverse what it would be if that were the case (we're closer in winter, and further in summer).