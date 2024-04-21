import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import * as luxon from "luxon";
import  _ from "lodash";

const usnoPhasesRaw = await readFile(fileURLToPath(import.meta.resolve("./usno_moon_phases.json")), "utf-8");

const usnoPhases = (() => {
  const eLookup = {
    "New Moon": '🌑',
    "Full Moon": '🌕',
    "First Quarter": '🌓',
    "Last Quarter": '🌗',
  }
  
  return JSON.parse(usnoPhasesRaw).map(d => d.phasedata).flat().map(d => {
    let [hour, minute] = d.time.split(":").map(d => parseInt(d));
    
    let dt = luxon.DateTime.fromObject({
        year: d.year,
        day: d.day,
        month: d.month,
        hour: hour,
        minute: minute,
      }, {
        // USNO gives times in UTC: https://aa.usno.navy.mil/data/MoonPhases
        zone: "utc"
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
                interval: p.interval.toISO(),
            }
        }).slice(0, 4)
    }
  })

  return luns3;
})()


process.stdout.write(JSON.stringify(lunPhases));
