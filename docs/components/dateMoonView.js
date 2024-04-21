
import * as luxon from "npm:luxon";
import * as d3 from "npm:d3";

const meanLunationDays = 29.530588; 

const getDayStr = (bf) => {
  const days = (bf*2)/24;
  const secDays = (meanLunationDays/4) - days;
  return {primary: toDStr(days), secondary: toDStr(secDays)};
}

const toDStr = (durDays) => luxon.Duration.fromObject({days: durDays, hours: 0}).toFormat("d'd' h'h'")



export function dateMoonView(lunation) {
    // input is a list of dates, then we need to figure out the starts and stops in terms
    // of lunations (so if new moon is )

    const svg = d3.create("svg")
      .attr("viewBox", "0 0 200 200")
      .style("max-width", "50%")
      .style("background-color", "black")
      .style("height", "auto");
  
    svg.append("circle")
      .attr("cx", 100)
      .attr("cy", 100)
      .attr("r", 80)
      .attr("fill", "none")
      .attr("stroke", "#333")
      .attr("stroke-width", 1);
  
  // const phases = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
  
  function calculatePhasePositions(cx, cy, r) {
      const positions = [];
      const totalPhases = lunation.phases.length;
      for (let i = 0; i < totalPhases; i++) {
          // Calculate the angle in radians for each phase
          const angle = 2 * Math.PI * (lunation.phases[i].nmid);
  
          // Calculate the x and y position
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
  
          // Add the position to the array
          positions.push([x, y]);
      }
      return positions;
  }
  
  const cx = 100; // Center x-coordinate
  const cy = 100; // Center y-coordinate
  const r = 80;   // Radius
  const positions = calculatePhasePositions(cx, cy, r);
  const phases = ["🌑",  "🌓", "🌕", "🌗"];

    phases.forEach((phase, i) => {
      svg.append("text")
        .attr("x", positions[i][0])
        .attr("y", positions[i][1])
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "white")
        .style("font-size", "16px")
        .style("opacity", 0.5)
        .text(phase);
    });
  
      svg.append("text")
        .attr("x", 100)
        .attr("y", 100)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "white")
        .style("font-size", "16px")
        .text("🌍");
  
      const thetas = [0, 90, 180, 270];
  
      // svg.append("text")
      //   .attr("x", 100 + 80*Math.cos(moonPos))
      //   .attr("y", 100 + 80*Math.sin(moonPos))
      //   .attr("text-anchor", "middle")
      //   .attr("dominant-baseline", "middle")
      //   .attr("fill", "white")
      //   .style("font-size", "16px")
      //   .text(decideEmoji());
  
    const makeArc = (p) => {
        return d3.arc()
        .innerRadius(0)
        .outerRadius(80)
        // 0 is at the top, so we add PI/2 to rotate to the right 1 quarter of the circle
        .startAngle(p.nstart * (Math.PI*2) + Math.PI/2) 
        .endAngle(p.nend * (Math.PI*2) + Math.PI/2);
    }
  
    lunation.phases.forEach(p => {
        svg.append("path")
      .attr("d", makeArc(p))
      .attr("transform", "translate(100,100)")
      // .attr("stroke", "red")
      .style("opacity", 0.2)
      .style("fill", "goldenrod");
    });
  
  
  
    return svg.node();
  }