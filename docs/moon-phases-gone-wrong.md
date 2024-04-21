---
title: Moon Phases Gone Wrong
---

I wrote a very short blog post providing a simple place to copy-paste the current phase of the moon as an emoji. This was after I saw my moon phase emoji posts showing up in search results for a query like "current phase of the moon emoji", trying the query, and seeing that it was for people playing the Password Game (which I recently realized is the same guy as [Infinite Craft]()! Love his stuff.).

I pulled the post up a month or so later, to see what folks get when they first visit my blog, and I had a crushing realization: the phase of the moon was wrong! It didn't match what was on moon phases site.  And not just a small error that can happen with [how wide you want your "instantaneous phases" to be](https://observablehq.com/d/46b3d87e4951b0d0). This was a gibbous when it should have been a crescent.

So what went wrong?

First let's get the code in here:

```js
import * as luxon from "npm:luxon";
```

```js echo
function getPhaseChar(cur_lun = lunForDate(), buffer = 0.03) {
  // We could min/max here, but more likely passing in a different value means a bug somewhere else in the code.
  if (cur_lun > 1 || cur_lun < 0) { throw new Error("Lunation progress must be between 0 and 1") }
  // drop the lowest range to line 0 up with new moon, and since we're already clipping our range at 0.
  const ranges = [0, 0.25, 0.5, 0.75, 1].map(val => [val - buffer, val + buffer]).flat().slice(1);
  const emojis = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌑'];

  return emojis[ranges.findIndex(range => cur_lun < range)];
}

function lunForDate(d = new Date()) {
  // Take difference (in days) between target and 2000/01/06 18:14 UTC (an arbitrary new moon time),
  // then divide the difference by the average number of days for a full lunation.
  // The fractional part is how far along the current lunation the target date is.
  const lun0 = new Date(947182440000);
//   const lun0 = new Date(1641148380000);
  const diffDays = (d - lun0) / 86400000;
  const meanLunation = 29.530588;
  return (diffDays / meanLunation) % 1;
};
```

And here we get the value for today's date:

```js
html`${getPhaseChar()}`
```

### What phase is it anyway?
The tricky thing about moon phases is that the primary phases correspond to a particular point on the Moon's orbit, meaning the Moon occupies that space for an instant, and then is on to a secondary phase. For example, First Quarter corresponds to when the moon is 50% illuminated, which will only happen for a split second, after which it will be 50.0001% illuminated, and before it will be 49.9999% illuminated.  That doesn't match up with what we experience since our eyes can't differentiate that small of a percentage. To make it more human friendly, and useful for marking time, we can consider some leeway.

There are a few ways to approach this:
* Some fixed "buffer" before and after the primary phase that we still count it as the primary phase (my initial approach)
* Truncating on day boundaries so that on whatever 24h period the primary phase occurs, we call it the primary phase (the more typical approach)

Let's see how those look.  First with the buffer approach:

```js
const bufferHoursInput = view(Inputs.range([1, 44], {label: "Hours of buffer (before and after) to still call primary phase", step: 1, value: 5}));
```

```js
import {bufferMoonView} from "./components/bufferMoonView.js";
```

```js
display(bufferMoonView(bufferHoursInput));
```

### Truncating on date

To take a more typical approach, I'll start with data from USNO which gives the specific times of primary phases in UTC, then truncate on day boundaries, and show how that differs from the buffer approach on the same diagram.

```js
const usnoPhasesRaw = await FileAttachment("./data/usno_moon_phases.json").json()
const usnoPhases = (() => {
  const eLookup = {
    "New Moon": '🌑',
    "Full Moon": '🌕',
    "First Quarter": '🌓',
    "Last Quarter": '🌗',
  }
  
  return usnoPhasesRaw.map(d => d.phasedata).flat().map(d => {
    let [hour, minute] = d.time.split(":").map(d => parseInt(d));
    
    let dt = luxon.DateTime.fromObject({
        year: d.year,
        day: d.day,
        month: d.month,
        hour: hour,
        minute: minute,
        // USNO gives times in UTC: https://aa.usno.navy.mil/data/MoonPhases
        zone: luxon.Zone.UTC,
      });

    // TODO: Set the timezone before doing this, so this should be dynamic
    let start = dt
        .startOf("day")
        .set({ hour: 0, minute: 0, second: 0, millisecond: 0 });

    let end = dt
        .startOf("day")
        .plus({ days: 1 })
        .set({ hour: 0, minute: 0, second: 0, millisecond: 0 });

    let interval = luxon.Interval.fromDateTimes(start, end);
    return {      
      date: dt,
      datejs: dt.toJSDate(),
      phase: d.phase,
      emoji: eLookup[d.phase],
      interval,
    } 
  });
})();
```

```js
const lunPhases = (() => {
  const nmIdx = usnoPhases.findIndex(d => d.phase == "New Moon");
  const chopped = usnoPhases.slice(nmIdx);
  const luns1 =  _.chunk(chopped, 4);

  const luns2 = luns1.map((g, i) => {
    if (i+1 < luns1.length) {
      return [...g, luns1[i+1][0]];
    }
  }).filter(d => d);

  const luns3 = luns2.map(g => {
    let lunLength = g[4].date.diff(g[0].date).as("days");

    return {
        lunLength,
        phases: g.map(p => {

            return {
                ...p,
                nstart: p.interval.start.diff(g[0].date).as("days") / lunLength,
                nmid: p.date.diff(g[0].date).as("days") / lunLength,
                nend: p.interval.end.diff(g[0].date).as("days") / lunLength,
            }
        }).slice(0, 4)
    }
  })

  return luns3;
})()

// display(lunPhases)
```

```js
import {dateMoonView} from "./components/dateMoonView.js";
```

```js
const lunationPicker = view(Inputs.range([0, lunPhases.length-1], {label: "Which lunation to view in 2023", step: 1, value: 5}));
```

```js
display(dateMoonView(lunPhases[lunationPicker]));
```


<!-- ```js
display(lunPhases[lunationPicker]);
``` -->


Looking at the "actual" data vs. our idealized / averaged view of the phases, it highlights the most likely place things can go wrong.  Throughout 2023, the length of lunation oscillates between -0.2 and 0.2 days from the mean.  The full moon however, oscillates up to 0.8 days in either direction.

The reason for this oscillation is a number of factors, but most significantly, the eccentricity of the moon's orbit as it interacts with its [synodic period](https://en.wikipedia.org/wiki/Orbital_period#Synodic_period). (see [this article](https://eclipse.gsfc.nasa.gov/SEhelp/moonorbit.html) for a deep dive into the other factors affecting lunation length).

```js
import {calculateDensities, violinPlot} from "./components/violin.js";
```

```js
const meanLunation = 29.530588;
const lunLengths = lunPhases.map(d => d.lunLength - meanLunation);

const fullMoon = lunPhases.map(d => d.phases[2].nmid*d.lunLength);
const fullMoonMean = fullMoon.reduce((a, b) => a + b, 0) / fullMoon.length
const fullMoonDiffs = fullMoon.map(d => d - fullMoonMean);

const vdata = [{label: "lunation", points: lunLengths}, {label: "fullmoon", points: fullMoonDiffs}];
const densities = calculateDensities(vdata);
display(violinPlot(vdata));

// display(fullMoon);
```


In practice, this difference means that our simplistic model will need a pretty wide buffer in order to match the values we see here.

## How close are we anyway?

Now that we have the "real" data from NASA, we can check the accuracy of the super simple model, and see how far off we are. 

From what we saw above, I'd expect that determining new moons should be relatively accurate ( ${tex`\pm 0.2 \text{ days}`} ), but getting the right intermediate phases is going to be tricky for both the variation we see above and the date truncation issue.

Let's first go through all of our "primary" phases based on our simplistic 25% of mean lunation length and see how far off we are (in hours)

```js

// Get the first lunation in 2023 according to our simple model
// First get the lunation on Jan 1
const jan1_2023 = luxon.DateTime.fromISO("2023-01-01T00:00:00.000Z");
const jan2023_lun = lunForDate(jan1_2023.toJSDate());

// Now add 1 - that lun to get the new moon exact time:
const first2023newMoonEst = jan1_2023.plus({days: (1 - jan2023_lun)*meanLunation});

// Now create phases from that for 11 lunations
const estimated2023PhaseDates = d3.range(11).map(i => {
    const newMoonDate = first2023newMoonEst.plus({days: i*meanLunation});
    return {
        lunLength: meanLunation,
        date: newMoonDate,
        phases: ['🌑', '🌓', '🌕',  '🌗'].map((e, j) => {
            return {
                date: newMoonDate.plus({days: (j*0.25)*meanLunation}),
                emoji: e,
                // nstart: p.interval.start.diff(g[0].date).as("days") / lunLength,
                // nmid: p.date.diff(g[0].date).as("days") / lunLength,
                // nend: p.interval.end.diff(g[0].date).as("days") / lunLength,
            }
        })
    }
})

// display(estimated2023PhaseDates);

const actual2023 = lunPhases.filter(d => d.phases[0].date.get('year') === 2023);

// display(actual2023[0]);

```

```js
const comparisons = (() => {
    const fa = actual2023.map(d => d.phases).flat();
    const fe = estimated2023PhaseDates.map(d => d.phases).flat();

    return d3.zip(fa, fe).map(([a, b]) => {
        return {
            actual: a.date.toISODate(),
            estimated: b.date.toISODate(),
            diff: a.date.diff(b.date).as("hours"),
            sameDay: a.date.day === b.date.day,
            emoji: a.emoji,
        }
    })
})()
const grouped = comparisons.reduce((acc, c, i) => { acc[i%4].points.push(c.diff); return acc; }, ['🌑', '🌓', '🌕',  '🌗'].map(e => ({label: e, points: []})));

// display(JSON.stringify(comparisons));
display(violinPlot(grouped));


```

Okay, so about what we expected based on how much we see the actual data vary from the mean.  The negative numbers mean we are "behind" in that the actual date was later than the date we had predicted.
This means that the skew towards negative we see on new moons means we're predicting new moons to happen before they actually do more than we're predicting them late.

This might be some accumulated drift since the new moon we started with was in the year 2000.

If we update this to be one in 2022, what can we see? It just adjusts the means so that new moons are more accurate and the rest are slightly off.  It actually makes our accuracy _worse_ overall on the somewhat contrived "sameday" metric (70% -> 64%) for the primary phases.

<!-- ```js
display(+lunPhases.filter(d => d.phases[0].date.get('year') === 2022)[0].phases[0].date);
``` -->

```js
display(Plot.plot({
  color: { legend: true, scheme: "RdBu" },
  marks: [
    Plot.frame({ strokeOpacity: 0.1 }),
    Plot.barY(
      comparisons,
      Plot.groupX(
        { y: "count" },
        { fx: "emoji", x: "sameDay", fill: "sameDay", tip: true }
      )
    ),
    Plot.ruleY([0])
  ]
}))
```

```js
display(Plot.plot({
  color: { legend: true, scheme: "RdBu" },
  marks: [
    Plot.frame({ strokeOpacity: 0.1 }),
    Plot.barX(
      comparisons,
      Plot.groupY(
        { x: "count" },
        { y: "sameDay", fill: "sameDay", tip: true }
      )
    ),
    Plot.ruleX([0])
  ]
}))
```

An interesting note on this is that the "rise" time for Last Quarter 🌗 is typically close to midnight. This might mean that it's more typical for a Last Quarter time to happen around midnight. But actually I suspect they're fairly evenly distributed. Let's check.

```js
display(Plot.plot({
  height: 100,
  marks: [
    Plot.frame({ strokeOpacity: 0.1 }),
    Plot.barY(
      lunPhases.map(d => d.phases[3].date.hour),
      Plot.groupX(
        { y: "count" },
        {tip: true, fill: "darkblue" }
      )
    ),
    Plot.ruleY([0])
  ]
}))
```

It's fairly evenly distributed, so that does not explain why we're particularly bad at getting the right day for last quarter.

## Where do we go from here?

Based on this information, ignoring "buffering", if we just go by the "same day" metric, we'll be consistent with the typical notion of "moon phase" for 70% of the primary phases. Out of 365 days, that's pretty good, at about 92% accuracy (get this by seeing we're wrong 13 days, meaning we'll say wrong things on the day of the phase and a day adjacent to it, so (365 - 13*2)/365).

Our 2 avenues for improving this are: making our calculation more accurate, or just embedding the data calculated by someone else.  Until I have time to do the former, I'll do the latter.