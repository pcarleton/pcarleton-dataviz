---
title: Moon Phases Part 2, Introducing Meeus
---

# Moon Phases Part 2, Introducing Meeus

In the last post, I was investigating the accuracy of a super simple moon phase calculation. It was "good enough" in most situations given when to declare a primary phase is a bit subjective.  A similar date truncation approach chose the same calendar day phase as the USNO data >90% of the time. 

I wanted to see if I could get accurate primary phases to within about 1h just using calculations (not relying on prefetching data). The source of all sources for this type of thing is [Astronmical Algorithms](https://www.amazon.co.uk/Astronomical-Algorithms-Jean-Meeus/dp/0943396611) by Jean Meeus.

## The Equation

Chapter 49 of Astronomical Algorithms gives the equations for calculating the phase of the moon based on an input time.  I'll start off with just the coarsest version of the equation, and then add more correction terms to see how much of a difference it makes.

```js
import * as luxon from "npm:luxon";
import {violinPlot, calculateDensities} from "./components/violin.js";
```

```js
import {calculateJDEcorrected, newMoonCorrections, calculateCorrectionInputs, planetaryCorrections, jdeToTimestamp, simplePhaseChar, simpleLunForDate, MEAN_LUNATION} from './components/moonCalculator.js';
```

```js echo
// 49.1: JDE Julian Ephemeris Days (in Dynamical Time).
// k is an integer corresponding to the new moon.
// adding .25, 0.5, 0.75 gives the primary phases.
function calculateJDE(k) {
  const T = calculateT(k);
  const JDE = 2451550.09766 + 29.530588861 * k
            + 0.00015437 * Math.pow(T, 2)
            - 0.000000150 * Math.pow(T, 3)
            + 0.00000000073 * Math.pow(T, 4);
  
  return JDE;
}

// 49.2: k=0 corresponds to the new moon of 2000-01-06
function nearestK(luxonDate) {
  const fractionalYear = luxonDate.year + (
    luxonDate.diff(luxonDate.startOf('year'), 'year')
  ).years
  return Math.round((fractionalYear - 2000) * 12.3685);
}

// 49.3: T is time in Julian centuries since epoch 2000
function calculateT(k) {
    return k / 1236.85;
}
```


Putting that all together, we can get the first new moon in 2023 and compare to USNO.

```js echo
// Start from the end of jan since we'll round backwards
const jan2023 = luxon.DateTime.fromISO("2023-01-31");
const jan2023k = nearestK(jan2023);
const jde = calculateJDE(jan2023k);
const est2023newMoonTimestamp = jdeToTimestamp(jde);
display(est2023newMoonTimestamp.toJSDate());
```

Now we can compare that timestamp to what the USNO data shows:
```js
const usnoPhasesRaw = await FileAttachment("./data/usno_massaged.json").json()

const usnoPhases = usnoPhasesRaw.map(d => {
    const phases = d.phases.map(p => {
        return {
            ...p,
            date: luxon.DateTime.fromISO(p.date),
            interval: luxon.Interval.fromISO(p.interval),
        }
    });
    return {
        ...d,
        phases,
        start: phases[0].date,
    }
})

const usno2023 = usnoPhases.filter(d => d.start.year === 2023)
const actual2023newMoon = usno2023[0].start;
```

```js echo
display(usno2023[0].start.toJSDate());
display(usno2023[0].start.diff(est2023newMoonTimestamp).as('hours'))
```


Not bad! Now let's check how both this new one and the simple one compare against the USNO data as in the previous post.
The new data is in black, and the simple data is in blue. 

```js
const meeus1_2023PhaseDates = d3.range(11).map(i => {
    const k = jan2023k + i;
    const newMoonDate = jdeToTimestamp(calculateJDE(k));
    return {
        // lunLength: meanLunation,
        date: newMoonDate,
        phases: ['🌑', '🌓', '🌕',  '🌗'].map((e, j) => {
            return {
                date: jdeToTimestamp(calculateJDE(k+j*0.25)),
                k: k+j*0.25,
                jde: calculateJDE(k+j*0.25),
                emoji: e,
                // nstart: p.interval.start.diff(g[0].date).as("days") / lunLength,
                // nmid: p.date.diff(g[0].date).as("days") / lunLength,
                // nend: p.interval.end.diff(g[0].date).as("days") / lunLength,
            }
        })
    }
})


// Also try the old way so we can see how they compare.
// Get the first lunation in 2023 according to our simple model
// First get the lunation on Jan 1
const jan1_2023 = luxon.DateTime.fromISO("2023-01-01T00:00:00.000Z");
const jan2023_lun = simpleLunForDate(jan1_2023.toJSDate());
// Now add 1 - that lun to get the new moon exact time:
const first2023newMoonEst = jan1_2023.plus({days: (1 - jan2023_lun)*MEAN_LUNATION});

// Now create phases from that for 11 lunations
const simple2023PhaseDates = d3.range(11).map(i => {
    const newMoonDate = first2023newMoonEst.plus({days: i*MEAN_LUNATION});
    return {
        lunLength: MEAN_LUNATION,
        date: newMoonDate,
        phases: ['🌑', '🌓', '🌕',  '🌗'].map((e, j) => {
          const dt = newMoonDate.plus({days: (j*0.25)*MEAN_LUNATION})

            return {
                date: dt,
                emoji: e,
            }
        })
    }
})

const comparisons = (() => {
    const fa = usno2023.map(d => d.phases).flat();
    const fe = meeus1_2023PhaseDates.map(d => d.phases).flat();

    return d3.zip(fa, fe).map(([a, b]) => {
        return {
            actual: a.date.toISODate(),
            estimated: b.date.toISODate(),
            diff: a.date.diff(b.date).as("hours"),
            sameDay: a.date.day === b.date.day,
            emoji: a.emoji,
            a, b
        }
    })
})()
const grouped = comparisons.reduce((acc, c, i) => { acc[i%4].points.push(c.diff); return acc; }, ['🌑', '🌓', '🌕',  '🌗'].map(e => ({label: e, points: []})));


const comparisonsSimple = (() => {
    const fa = usno2023.map(d => d.phases).flat();
    const fe = simple2023PhaseDates.map(d => d.phases).flat();

    return d3.zip(fa, fe).map(([a, b], i) => {
        return {
            actual: a.date.toISODate(),
            estimated: b.date.toISODate(),
            diff: a.date.diff(b.date).as("hours"),
            sameDay: a.date.day === b.date.day,
            emoji: a.emoji,
            a, b
        }
    })
})()
const groupedSimple = comparisonsSimple.reduce((acc, c, i) => { acc[i%4].points.push(c.diff); return acc; }, ['🌑', '🌓', '🌕',  '🌗'].map(e => ({label: e, points: []})));



// display(JSON.stringify(comparisons));
// display(violinPlot(grouped));
```

```js

const dens1 = calculateDensities(grouped);
const dens2 = calculateDensities(groupedSimple);

const doubleViolinPlot = (d1, d2, {gap = 0, bandwidth = 0} = {}) => {
    // const densities = calculateDensities(data, {bandwidth});
    const r = gap;
    return Plot.plot({
        // grid: true,
        marks: [
          Plot.ruleY([0], { strokeOpacity: 0.6 }),
          Plot.areaX(d1, {
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
          Plot.lineX(d1, {
            x: d => d.x + r * d.i,
            z: "i",
            y: "y",
            fx: "label",

          }),
          Plot.areaX(d1, {
            x: d => -d.x + r * d.i,
            x1: d => r * d.i,
            y: "y",
            z: "i",
            fx: "label",

            fillOpacity: 0.2
          }),
          Plot.lineX(d1, {
            x: d => -d.x + r * d.i,
            z: "i",
            fx: "label",

            y: "y"
          }),
          Plot.dot(
            d1,
            Plot.selectFirst({
              y: d => d.m,
              stroke: "#000",
              x: d => r * d.i,
              z: "i",
              fx: "label",
            })
          ),

        // Secondary
        Plot.areaX(d2, {
            x: d => d.x + r * d.i,
            x1: d => r * d.i,
            // x1: d => d.label,
            z: 0,
            y: "y",
            fx: "label",
            fillOpacity: 0.1,
            fill: "blue",
          }),
        //   Plot.dot(densities, {
        //     x: d => d.x + r * d.i,
        //     y: "y",
        //     z: "i",
        //     strokeOpacity: showSamples ? 1 : 0
        //   }),
          Plot.lineX(d2, {
            x: d => d.x + r * d.i,
            z: 0,
            y: "y",
            fx: "label",
            stroke: "blue",


          }),
          Plot.areaX(d2, {
            x: d => -d.x + r * d.i,
            x1: d => r * d.i,
            y: "y",
            z: 0,
            fx: "label",
            fill: "blue",

            fillOpacity: 0.1
          }),
          Plot.lineX(d2, {
            x: d => -d.x + r * d.i,
            z: 0,
            fx: "label",
            stroke: "blue",
            y: "y"
          }),
          Plot.dot(
            d2,
            Plot.selectFirst({
              y: d => d.m,
              stroke: "blue",
              x: d => r * d.i,
              z: 0,
              fx: "label",
            })
          )
        ]
      });
}

// TODO: this could be de-duped a decent amount if I do this again.
display(doubleViolinPlot(dens1, dens2));
```

It actually looks fairly similar to before, so not a great improvement. So, let's add some more terms!

Here's the answer we get if we add the 2 batches of correction terms.

```js echo
const jde2 = calculateJDEcorrected(jan2023k);
const est2023newMoonTimestamp2 = jdeToTimestamp(jde2);

display(est2023newMoonTimestamp2.toJSDate());
display(usno2023[0].start.diff(est2023newMoonTimestamp2).as('minutes'))
```

In that one, we're off by minutes!  Let's see if that works across 2023 (this y axis will be minutes instead of hours):

```js
const meeus2_2023PhaseDates = d3.range(11).map(i => {
    const k = jan2023k + i;
    const newMoonDate = jdeToTimestamp(calculateJDEcorrected(k));
    return {
        // lunLength: meanLunation,
        date: newMoonDate,
        phases: ['🌑', '🌓', '🌕',  '🌗'].map((e, j) => {
            let jde = calculateJDEcorrected(k+j*0.25);
            let date = jdeToTimestamp(jde);
            return {
                date,
                emoji: e,
                k: k+j*0.25,
                jde,
                unix: (jde - 2440587.5) * 86400000,
                unixPost: date.toMillis(),
                // nstart: p.interval.start.diff(g[0].date).as("days") / lunLength,
                // nmid: p.date.diff(g[0].date).as("days") / lunLength,
                // nend: p.interval.end.diff(g[0].date).as("days") / lunLength,
            }
        })
    }
})

const comparisons2 = (() => {
    const fa = usno2023.map(d => d.phases).flat();
    const fe = meeus2_2023PhaseDates.map(d => d.phases).flat();

    return d3.zip(fa, fe).map(([a, b]) => {
        return {
            actual: a.date.toJSDate(),
            estimated: b.date,
            zone: b.date.zone.name,
            diff: a.date.diff(b.date).as("minutes"),
            sameDay: a.date.day === b.date.day,
            emoji: a.emoji,
            a, b
        }
    })
})()
const grouped2 = comparisons2.reduce((acc, c, i) => { acc[i%4].points.push(c.diff); return acc; }, ['🌑', '🌓', '🌕',  '🌗'].map(e => ({label: e, points: []})));


// display(JSON.stringify(comparisons));
display(violinPlot(grouped2));

```

It does!  This new model is super close to the USNO data. In fact it's off by minutes instead of off by hours.  Doing our same day truncation, we get 100% accuracy:

```js
display(Plot.plot({
  color: { legend: true, scheme: "BuRd" },
  y: {axis: null},
  marks: [
    Plot.frame({ strokeOpacity: 0.1 }),
    Plot.barX(
      comparisons2,
      Plot.groupY(
        { x: "count" },
        { y: "sameDay", fill: "sameDay", tip: true }
      )
    ),
    Plot.ruleX([0])
  ]
}))
```

## Conclusion

For a little bit more code (~300 lines vs. ~30) we get a much more accurate moon phase calculation.

What I'm most curious about next is digging deeper into the correction terms to learn which ones matter the most. I'll tackle that in the next post.

# Bonus

Here's a couple other things I came across along the way.

## Checking against the test terms

My very first attempt at using the Meeus algorithm gave me a _less_ accurate number. Fortunately, he includes a few reference exmaples at the end, so I was able to pin point which functions had issues.  The ones I found were:

* I wasn't doing a `mod360` operation to bring things back into 0-360 degrees
* Related: I wasn't converting degrees to radians properly
* A few of my coefficients were off. (sidenote: I used Claude to do the initial conversion from screenshot->JS and it worked really well! Minus these few places where it swapped a sign or used a `k` instead of a `T`).

```js echo
const ex49a = {
  k: -283,
  T: -0.22881,
  E: 1.0005753,
  M: -8234.2625,
  Mprime: -108984.6278,
  F: -110399.0416,
  Omega: 567.3176,
  jde: {parts: [2443192.94102, -0.28916, -.00068], final: 2443192.65118},
};

const ex49a_cinputs = calculateCorrectionInputs(ex49a.k);
const ex49a_jde_parts = [calculateJDE(ex49a.k), newMoonCorrections(ex49a_cinputs), planetaryCorrections(ex49a.k)];
const ex49a_got = {
    correctionInputs: ex49a_cinputs,
    jde: {
        parts: ex49a_jde_parts,
        final: calculateJDEcorrected(ex49a.k),
    }
}

display(ex49a_got);
// Fixed some k's and T mix-ups, mod360, and deg2rad
```

## Daylight Savings

When I first implemented the meeus algorithms I hit a weird issue which was that I was either off by very little, or off by 1 hour.  This stank of daylight savings, but I wasn't sure where it was sneaking in since I was intending to use UTC everywhere.

Before I fixed it, the graph looked like this:
```js

const usnoPhasesOriginal = await FileAttachment("./data/usno_moon_phases.json").json()


const usnoBuggy =  usnoPhasesOriginal.map(d => d.phasedata).flat().map(d => {
    let [hour, minute] = d.time.split(":").map(d => parseInt(d));
    
    let dt = luxon.DateTime.fromObject({
        year: d.year,
        day: d.day,
        month: d.month,
        hour: hour,
        minute: minute,
        // USNO gives times in UTC: https://aa.usno.navy.mil/data/MoonPhases
        zone: luxon.Zone.UTC, // <-- this is the bug
    },
    // should be this
    // {
    //     zone: "utc",
    // }
    );

    return {      
      date: dt,
      datejs: dt.toJSDate(),
      phase: d.phase,
    //   emoji: eLookup[d.phase],

    } 
});

const comparisons3 = (() => {
    // hacky slice to line it up on lunations
    const fa = usnoBuggy.filter(d => d.date.year === 2023).slice(2);
    const fe = meeus2_2023PhaseDates.map(d => d.phases).flat();

    return d3.zip(fa, fe).map(([a, b]) => {
        return {
            actual: a.date,
            estimated: b.date,
            zone: a.date.toObject(),
            diff: a.date.diff(b.date).as("minutes"),
            sameDay: a.date.day === b.date.day,
            // emoji: a.emoji,
            a, b
        }
    })
})()

display(comparisons3)
display(Plot.plot({
  height: 200,
//   x: {tickFormat: "", interval: 1},
  marks: [
    // Plot.gridX({interval: 1, stroke: "white", strokeOpacity: 0.5}),
    Plot.frame({ strokeOpacity: 0.1 }),
    Plot.dot(
      comparisons3,
      {
        x: "actual",
        y: "diff",
        tip: true,
      },
    ),
    Plot.ruleY([0])
  ]
}))
```

The issue was this with luxon:

```js echo

// How I was constructing the date
const ex_d1 = luxon.DateTime.fromObject({
    year: 2023,
    day: 1,
    month: 1,
    zone: luxon.Zone.UTC
})
display(ex_d1.zone.name); // gives "Europe/London"
// This is undefined, so I didn't realize that it was silently not doing anything
display(luxon.Zone.UTC)
```

```js echo
// How you actually need to do it:
const ex_d2 = luxon.DateTime.fromObject({ year: 2023, day: 1, month: 1, hour: 0, minute: 0}, {zone: "utc" });

display(ex_d2.zone.name); // gives "utc"



```
