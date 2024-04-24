---
title: Moon Phases Corrections competition
---

# Moon Phase Corrections Investigation
In the last post, I got that the Astronomical Algorithms code working. That code starts from a similar (ish) model to the "anchor on a known new moon & extrapolate", but then it adds a bunch of periodic correction terms based on other factors that affect the moons position.

While it's great that it gives me the correct answer, I'd like to understand more about _how_ it does that. I could try to wade through a bunch of papers, but they're not really tailored for a casual observer, so instead, I'll use the data I get from the Astronomical Algorithms to zero in on what terms matter the most, focus on their inputs, and that should give me an idea of what influences the moon's position most.

## Example corrections

Let's look at the corrections for a single lunation:

```js
import * as luxon from "npm:luxon";

import {calculateJDEcorrected,
fullMoonCorrectionsRaw, newMoonCorrectionsRaw, calculateCorrectionInputs, planetaryCorrections, jdeToTimestamp, simplePhaseChar, simpleLunForDate, nearestK, MEAN_LUNATION} from './components/moonCalculator.js';
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


So the biggest corrections we're getting for this _particular_ lunation is 1.2 hours for the new moon and about 4 hours for the full moon.

## Corrections over time

Let's see what these corrections look like over time.  Below are 50 lunations corrections for full moon and new moon plotted

```js
const lunations = 50;
const nmc2023 = d3.range(jan2023k, jan2023k + lunations).map(k => {
    const nmci = calculateCorrectionInputs(k);
    const nmc = newMoonCorrectionsRaw(nmci);
    const plottable = plottableCorrections(nmc);
    return plottable.map(d => ({...d, k, date: jdeToTimestamp(calculateJDEcorrected(k))}));
})

const fmc2023 = d3.range(jan2023k, jan2023k + lunations).map(j => {
    const k = j + 0.5;
    const ci = calculateCorrectionInputs(k);
    const c = fullMoonCorrectionsRaw(ci);
    const plottable = plottableCorrections(c); //.concat([{v: ci.M, term: 'M'}, {v: ci.Mprime, term: 'M\''}]);
    return plottable.map(d => ({...d, k, date: jdeToTimestamp(calculateJDEcorrected(k))}));
})

// display(nmc2023);

display(Plot.plot({
    y: { label: "Hours" },
    height: 150,
    color: { legend: false, scheme: "Observable10" },
  marks: [
    Plot.frame({ strokeOpacity: 0.1 }),
    Plot.line(
      nmc2023.flat(),
      {x: d => d.date.toJSDate(), y: "v", stroke: "term"}
    ),
    Plot.ruleY([0])
  ],
    //   ...options,
}))

display(Plot.plot({
    y: { label: "Hours" },
    height: 150,
    color: { legend: false, scheme: "Observable10" },
  marks: [
    Plot.frame({ strokeOpacity: 0.1 }),
    Plot.line(
      fmc2023.flat(),
      {x: d => d.date.toJSDate(), y: "v", stroke: "term"}
    ),
    Plot.ruleY([0])
  ],
    //   ...options,
}))
```

It's clear that the first 2 terms dominate at least for Full moon and New moon.

### Dominating Terms
These 2 terms are:

```
// New Moon
-0.40720 * Math.sin(Mprime)
+0.17241 * E * Math.sin(M)

// Full Moon
-0.40614 * Math.sin(Mprime),
+0.17302 * E * Math.sin(M),
```

Remember that ${tex`M`} is the Sun's mean anomaly, and that ${tex`M'`} (`MPrime`) is the Moon's mean anomaly. Let's look quickly at what [mean anomaly](https://en.wikipedia.org/wiki/Mean_anomaly) means in this context.

### Mean Anomaly
What's important to note here is that these formula are geocentric, meaning that we're "pretending" that the sun orbits the earth. Otherwise the Sun's mean anomaly wouldn't make sense. So what the mean anomaly is describing is how far along from perigree the Sun or Moon is in its orbit.


If we plot them, we see that the Moon's mean anomaly oscillates much more quickly since it's orbiting on average once every 29.5 days, meanwhile the Sun "orbits" the earth once per year.  Put in more relatable terms, it takes a year between the Earth starting at its closest point and then travelling back.

A neat fun fact is that the Earth is closest to the sun in January which is in the winter (Northen Hemisphere). It's funny because the most often incorrect answer folks give about why winter is colder is related to distance to the sun, but the distance is reverse what it would be if that were the case (we're closer in winter, and further in summer).

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

There's still some more digging to do for First Quarter / Last Quarter, and to get a better intution about what direction (sooner or later) the 2 mean anomalies influence the phases.  But I'll tackle that in another post!