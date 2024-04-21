---
title: Moon Phases with Meeus
---

In the last post, I was investigating how my super simple moon phase calculation was getting things wrong. The good news it was off by 1 day max, and with enough buffer is "good enough" in that what day you call the actual primary phase is a bit subjective (is it the calendar day period that contains the moment when the moon crossed that threshold? Or is it more specific, like the time leading up to the next moon rise during which the visible moon looks _most_ like the primary phase?).

However, if I want to agree with the "conventional" way of doing things, it seems like getting accurate primary phases to within about 1h would be a good target. To do that though, I'd either need to just include the actual primary phase data (honestly not that big of a data set, so totally reasonable: ~12 lunations * 4 phases = 48 timestamps per year), or improve the accuracy of my calculation.

In this post, I want to see whether using how close using a slightly more complicated calculation gets us. To do that, we'll refer to the name everyone refers to: Jean Meeus. Meeus wrote a book called Astronomical Algorithms with equations for all kinds of Astronomical calculations varying from simple (kind of like my first cut at moon phases), to complex with lots of correction terms.

## The Equation

Chapter 49 of Meeus gives us the following intro equation, and then even more involved correction terms based on planets and the sun.

```js
import * as luxon from "npm:luxon";
import {violinPlot} from "./components/violin.js";
```

```js
import {calculateJDEcorrected, newMoonCorrections, calculateCorrectionInputs, planetaryCorrections, jdeToTimestamp} from './components/moonCalculator.js';
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
display(usno2023[0].start.toJSDate());
display(usno2023[0].start.diff(est2023newMoonTimestamp).as('hours'))
```


Not bad! Now let's do a similar comparison as in the super simple approach

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


// display(JSON.stringify(comparisons));
display(violinPlot(grouped));
```

That's better than before, but still not great. What would be interesting is to see where it seems to be better, but it's a little difficult to tell.  My main complaint with the Meeus formula is that it gives the correction terms, but not a huge amount of detail for what they're correcting for. That might be my naive brain wanting to be able to understand it intuitively, but in reality, it being such a complex system, that I'm not appreciating the summarization Meeus has done to make it simple enough for the average person to implement.

Anyway, let's add some more terms!



```js echo
const jde2 = calculateJDEcorrected(jan2023k);
const est2023newMoonTimestamp2 = jdeToTimestamp(jde2);

display(est2023newMoonTimestamp2.toJSDate());
display(usno2023[0].start.diff(est2023newMoonTimestamp2).as('minutes'))
```


Hmm that is worse!  Let's check the calculation against the example.

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


Okay now we're close on 1 example, let's get the distribution.


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

That looks a little suspicious, and I wonder if daylight savings is at play...
(Annoyingly, my violin plot which I hoped would be good at showing bimodal things doesn't show this...)

```js

display(comparisons2)
display(Plot.plot({
  height: 200,
//   x: {tickFormat: "", interval: 1},
  marks: [
    // Plot.gridX({interval: 1, stroke: "white", strokeOpacity: 0.5}),
    Plot.frame({ strokeOpacity: 0.1 }),
    Plot.dot(
      comparisons2,
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

Okay so where is DST killing me? It's either in the USNO data (which is in UT...) or in the timestamps I'm creating. I'm assuming it's mine since Luxon does some nice DST things for me, and USNO is giving me things in UTC (which presumably ignores DST). 

Some other ways to confirm would be to see the date it cuts over and see if it's the US DST date or the UK one.

The drop off happens 3-29, which is supiciously UK based since UK switches 3-26 where US switches 3-12 (in 2023).

So. That means somewhere my timestamps are getting "fixed" by offsetting an hour, but where?

Turned out to be in my conversion of USNO to luxon, I was passing zone in the wrong place. It didn't throw an error because I was setting it as undefined previously.


What's next? 

- Clean up the functions so they're useful for "what's the phase today" or "gimme a phase calendar".