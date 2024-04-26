---
title: Moon Phases Part 1, Limits of a simple approach
---

# Moon Phases Part 1, Limits of a simple approach

I've made several "moon phase emoji" mini projects, starting with a [moon CLI tool](https://blog.pcarleton.com/post/cli-for-the-moon/), then [a favicon](https://garden.pcarleton.com/post/garden-fun/#emoji-favicon), and the most recently [a copy-pastable version](https://blog.pcarleton.com/post/current-phase-of-the-moon-emoji/) for [The Password Game](https://neal.fun/password-game/). It's a simple problem to get a passable answer which makes it a quick fun project in a new language or a new context. On the other hand, it's very complex to get an extremely accurate answer.

There's three approaches I've found:
1. Anchoring on a known new moon and extrapolating based on mean lunation (29.52 days)
2. Fetching source-of-truth data from an API (either live, or prefetching some window)
3. Calculating a more complex approximation using [Astronmical Algorithms](https://www.amazon.co.uk/Astronomical-Algorithms-Jean-Meeus/dp/0943396611) (See [next post](/moon-phases-with-meeus))

For the most recent application for the Password Game, I wanted to produce the same emoji as the game expected.  This motivated me to check just how close my simple model (approach #1) was to the real deal (USNO data i.e. approach #2).

## The Code

Here's approach #1. It uses the average length of a lunation (i.e. time between new moons), and a reference new moon date to do some modulo arithmetic and spit out a moon phase emoji.  There's a "buffer" window surrounding the instantaneous phase. 
```js
import * as luxon from "npm:luxon";
```

```js echo
function getPhaseChar(cur_lun = lunForDate(), buffer = 0.025) {
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
The tricky thing about moon phases is that the primary phases (🌑, 🌗, 🌕, 🌗) are instantaneous. They correspond to a particular point on the Moon's orbit, meaning the Moon occupies that space for an instant, and then is on to a secondary phase (🌒,🌖,🌖,🌘). For example, First Quarter (🌗) corresponds to when the moon's geocentric longitude is 90° (roughly when the angle from Sun->Earth->Moon is 90°), which will only happen for a split second, after which it will be 90.0001° longitude, and before it will be 89.9999°.  If I were to only count that instant as the primary phase, I'd never see the primary phase emoji since the odds that I check at exactly the moment of the primary phase are really small.

Additionally, since we're using the average lunation length, our estimate is going to not line up with reality, so even if I did ask at the exact right moment, it will have some significant error bars. It's like using the wrong number of significant digits in a science experiment.

To make sure we get to see the primary phase emoji, and have the emoji more closely line up with what we can distinguish with our eyes, I want to add some leeway or buffer around the primary phases.

There are a few ways to approach this:
* Some fixed "buffer" window before and after the primary phase that we still count it as the primary phase (my initial approach, I went with roughly ${tex`\pm 24 \text{ hours}`})
* Truncating on day boundaries so that on whatever 24h period the primary phase occurs, we call it the primary phase

Let's see how those look.  I'll draw a circle that represents the full lunation (~29.53 days), and mark the primary phases along that circle, and highlight the buffer window where we'd return the primary phase emoji (e.g. full moon) vs. the secondary phase (e.g. waning gibbous).

#### Buffer window

```js
const bufferHoursInput = view(Inputs.range([1, 44], {label: "Hours of buffer (before and after) to still call primary phase", step: 1, value: 5}));
```

```js
import {bufferMoonView} from "./components/bufferMoonView.js";
```

```js
display(bufferMoonView(bufferHoursInput));
```

The nice thing about the buffer approach is that it gives a wide window for seeing the primary phase emoji, up to 48 hours, and therefore doesn't matter so much if our estimation is off.

The not-as-nice thing about it is if we want to agree with another source about what the phase of the moon is, we would need to agree on the buffering strategy and window. 

### Truncating on date

Truncating by date means finding the date on which the primary phase occurs, and considering any timestamp on that date to be the primary phase. This is handy for things like "Moon Phase Calendar" such as moonphases.co.uk where people ask "What phase is the moon this week?" and the answer is picking 1 phase per day. (Footnote: there are some interesting other ways to look at this such as if I'm asking and the moon hasn't risen yet, should I return the phase the moon _will_ be when it rises?).

Truncation behaves weirdly around midnight. A full moon at 12:01 am on March 21st implies that March 20th is a waxing gibbous, and March 21st is the full moon. Observationally, I'd consider March 20th a full moon. This could be based on the illumination, but also on the rise/set times which are close to sunrise/sunset for a full moon.

The midnight issue makes truncation more sensitive to drift in our calculation of the moment of the primary phase. With the buffer window, we're always a little wrong, so we make it wide enough to be practical. But with a fixed 24h window, and the "anchor point" not centered, it means if we're off by 8 hours, and then truncate, we're even worse than a 12:01am full moon.

Here's how truncation looks:

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
          const dt = newMoonDate.plus({days: (j*0.25)*meanLunation})
          let dayStart = dt
            .startOf("day")
            .set({ hour: 0, minute: 0, second: 0, millisecond: 0 });

          let dayEnd = dt
              .startOf("day")
              .plus({ days: 1 })
              .set({ hour: 0, minute: 0, second: 0, millisecond: 0 });

            let interval = luxon.Interval.fromDateTimes(dayStart, dayEnd);
            const nstart = interval.start.diff(newMoonDate).as("days") / meanLunation;
            const nmid = j*0.25; //interval.start.diff(newMoonDate).as("days") / meanLunation,
            const nend = interval.end.diff(newMoonDate).as("days") / meanLunation;

            return {
                date: dt,
                emoji: e,
                start: dayStart,
                end: dayEnd,
                nstart, nmid, nend
            }
        })
    }
})

```

```js
import {dateMoonView} from "./components/dateMoonView.js";
```

```js
const lunationPicker = view(Inputs.range([0, estimated2023PhaseDates.length-1], {label: "Which lunation to view in 2023", step: 1, value: 5}));
```

```js
display(dateMoonView(estimated2023PhaseDates[lunationPicker]));
```

<!-- ```js
display(lunPhases[lunationPicker]);
``` -->
# How close are we anyway?


## USNO Data

The US Naval Observatory (USNO) provides [an api](https://aa.usno.navy.mil/data/MoonPhases) for the specific times of primary phases in UTC using a much more sophisticated model that's accurate with in seconds (citation needed). I can check the accuracy of the super simple model, and see how far off I am. First I'll look at how much the phases vary from my "idealized" lunation portions. As in, I assume a full moon is halfway between 2 new moons, but how true is that in practice?

Below I compare the USNO reported length of lunations to the mean (29.54), and then also compare the time between new moon and full moon to half of the mean lunation (14.76).


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
import {calculateDensities, violinPlot} from "./components/violin.js";
```

```js
const meanLunation = 29.530588;
const lunLengths = lunPhases.map(d => (d.lunLength - meanLunation)*24);

const fullMoon = lunPhases.map(d => d.phases[2].date.diff(d.phases[0].date).as("hours"));
const fullMoonMean =  24 * meanLunation / 2;// fullMoon.reduce((a, b) => a + b, 0) / fullMoon.length
const fullMoonDiffs = fullMoon.map(d => d - fullMoonMean);

const vdata = [{label: "lunation", points: lunLengths}, {label: "fullmoon", points: fullMoonDiffs}];
const densities = calculateDensities(vdata);
display(violinPlot(vdata));
display(fullMoonMean/24)

// display(fullMoon);
```
From this plot, I'd expect that determining new moons should be relatively accurate since the true data doesn't vary that much ( ${tex`\pm 5 \text{ hours}`} ), but getting the right intermediate phases is going to be tricky for both the the variation above ( ${tex`\pm 20 \text{ hours}`} ) and the date truncation issue.


## Absolute accuracy for 2023

Let's first go through all of our "primary" phases based on our simplistic 25% of mean lunation length and see how far off we are from the  (in hours)

```js

const actual2023 = lunPhases.filter(d => d.phases[0].date.get('year') === 2023);

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
            sameDay: (a.date.day === b.date.day) ? "match" : "mismatch",
            emoji: a.emoji,
        }
    })
})()
const grouped = comparisons.reduce((acc, c, i) => { acc[i%4].points.push(c.diff); return acc; }, ['🌑', '🌓', '🌕',  '🌗'].map(e => ({label: e, points: []})));

// display(JSON.stringify(comparisons));
display(violinPlot(grouped));

```

The negative numbers mean we are "behind" in that the actual date was later than the date we had predicted.  This means that the skew towards negative we see on new moons means we're predicting new moons to happen before they actually do more than we're predicting them late.

## Truncation accuracy

Let's see how this works out on picking the right "truncation" date. Here are our "truncation" choices compared with doing the same truncation on the USNO data, broken down by phase:

<!-- ```js
display(+lunPhases.filter(d => d.phases[0].date.get('year') === 2022)[0].phases[0].date);
``` -->

```js
display(Plot.plot({
  color: { legend: true, scheme: "BuRd" },
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
We're pretty good at new moon and first quarter, and fairly bad at the other ones.


Here's the same data, but ignoring phase, and we get about 70% correct.
```js
display(Plot.plot({
  color: { legend: true, scheme: "BuRd" },
  y: {axis: null},
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

This data covers the day we'd pick for the primary phases, but ignores the correct answer we'll get on all the intermediate days which make up the majority of the year.  For the full year, we'd roughly look like this:

```js
display(Plot.plot({
  color: { legend: true, scheme: "BuRd" },
  y: {axis: null},
  marks: [
    Plot.frame({ strokeOpacity: 0.1 }),
    Plot.barX(
      comparisons.concat(d3.range(0, 365 - comparisons.length).map(c => ({...c, sameDay: "match"}))),
      Plot.groupY(
        { x: "count" },
        { y: "sameDay", fill: "sameDay", tip: true }
      )
    ),
    Plot.ruleX([0]),
    Plot.ruleX([365*0.9], {stroke: "red", strokeDasharray: "5, 5"}),
    Plot.text(["90%"], {x:d => 365*0.9, y: d => "mismatch", dx: 13, fill: "red"}),


  ]
}))
```

So with our simplistic model, we can get above 90% accuracy with date truncation, which is pretty good!  And the errors we have would be off-by-1 on phase, and by a loose interpretation still within reason.

This validates that the simplistic model is a good fit for most cosmetic use cases, but highlights that either a more accurate model or querying an external source is needed if I want to be above 90% matching or to be more certain I'll line up with other sources.

I love our Moon. Being able to see it every day makes it feel somewhat commonplace, but every time I dig a little more into it, I learn something new.

In the next post, I'll see how accurate we can get by using a more sophisticated model, but simple enought to implement, offered by Jean Meeus.


# Bonus 

## Truncated view on actual data

An interesting view is how does the "actual" data look with date truncation, since it highlights what we saw in the variation: the primary phase times don't always fall the same proportion of the time from the new moon.  In the below plot, the full "circle" represents the time to return back to a new moon, and the primary phase emoji's location around the circle corresponds to how far along the full "lunation" the phase happens.

This is not an actual geometric view, and it's a bit weird to show the full circle as time rather than distance, but it highlights how much variation there is in moon's relative motion to the earth.


```js
const lunationPicker2 = view(Inputs.range([0, actual2023.length-1], {label: "Which lunation to view in 2023", step: 1, value: 5}));
```

```js
display(dateMoonView(actual2023[lunationPicker2]));
```

There are a bunch of factors that cause this relative motion to change so much that I'll explore more in the next post! One of these is eccentricity of the moon's orbit as it interacts with its [synodic period](https://en.wikipedia.org/wiki/Orbital_period#Synodic_period), and  [this article](https://eclipse.gsfc.nasa.gov/SEhelp/moonorbit.html) has a deep dive on some of the other factors.


### Drift based on anchor new moon.
In my simple model, I "anchored" on a new moon in 2000, which means there might be some accumulated drift since then.

If I update this to be one in 2022, what happens? It adjusts the means so that new moons are more accurate and the rest are slightly off.  It actually makes our accuracy _worse_ overall on the somewhat contrived "sameday" metric (70% -> 64%) for the primary phases.  Thanks to the mean being relatively stable, we don't accumulate a huge amount of drift in 20 years, so changing the anchor doesn't have much effect.


### Midnight and the Last Quarter

The "rise" time for Last Quarter 🌗 is typically close to midnight. This might mean that it's more typical for a Last Quarter time to happen around midnight, and be an explanation for why our "same day" metric is worst for that phase. But that conflates "rise/set" time with the actual phase moment which don't follow the same distribution:

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

We can see from the USNO data that the hour of Last Quarter is fairly evenly distributed, so that does not explain why we're particularly bad at getting the right day for last quarter.