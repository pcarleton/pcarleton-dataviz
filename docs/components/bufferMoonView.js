
import * as luxon from "npm:luxon";
import * as d3 from "npm:d3";

const meanLunationDays = 29.530588; 

const getDayStr = (bf) => {
  const days = (bf*2)/24;
  const secDays = (meanLunationDays/4) - days;
  return {primary: toDStr(days), secondary: toDStr(secDays)};
}

const toDStr = (durDays) => luxon.Duration.fromObject({days: durDays, hours: 0}).toFormat("d'd' h'h'")


export function bufferMoonView(bufferHours) {
    const bufferDeg = (bufferHours / 24 / meanLunationDays) * 360;
    const dayStr = getDayStr(bufferHours);
    const svg = d3.create("svg")
      .attr("viewBox", "0 0 200 200")
      .style("max-width", "50%")
      .style("background-color", "black")
      .style("height", "auto");
  
    const circle = svg.append("circle")
      .attr("cx", 100)
      .attr("cy", 100)
      .attr("r", 80)
      .attr("fill", "none")
      .attr("stroke", "#333")
      .attr("stroke-width", 1);
  
        svg.append("text")
        .attr("x", 160)
        .attr("y", 100)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "goldenrod")
        .style("font-size", "6pt")
        // .style("opacity", 0.5)
        .text(dayStr.primary);
  
      let primaryArcRadius = 75;
        svg.append("path")
          .attr("d", 
              d3.arc().innerRadius(primaryArcRadius).outerRadius(primaryArcRadius)
                  .startAngle((90-bufferDeg) * (Math.PI/180))
                  .endAngle((90+bufferDeg) * (Math.PI/180)))
          .attr("transform", "translate(100,100)")
          .attr("stroke", "goldenrod")
          .attr("stroke-dasharray", "2 3")
          .style("opacity", 1);
  
  
      let secondaryArcRaduis = 78;
      svg.append("path")
          .attr("d", 
              d3.arc().innerRadius(secondaryArcRaduis).outerRadius(secondaryArcRaduis)
                  .startAngle((bufferDeg) * (Math.PI/180))
                  .endAngle((90-bufferDeg) * (Math.PI/180)))
          .attr("transform", "translate(100,100)")
          .attr("stroke", "#999")
          .attr("stroke-dasharray",  "5 2")
          .style("opacity", 1);
  
  
      svg.append("text")
        .attr("x", 140)
        .attr("y", 60)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "#999")
        .style("font-size", "6pt")
        // .style("opacity", 0.5)
        .text(dayStr.secondary);
  
  const phases = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
  
  function calculatePhasePositions(cx, cy, r) {
      const positions = [];
      const totalPhases = phases.length;
      for (let i = 0; i < totalPhases; i++) {
          // Calculate the angle in radians for each phase
          const angle = 2 * Math.PI * (i / totalPhases);
  
          // Calculate the x and y position
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
  
          // Add the position to the array
          positions.push([x, y]);
      }
      return positions;
  }
  
  // Example usage:
  const cx = 100; // Center x-coordinate
  const cy = 100; // Center y-coordinate
  const r = 80;   // Radius
  const positions = calculatePhasePositions(cx, cy, r);
  
  
  
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
  
    const makeArc = (theta) => {
        return d3.arc()
        .innerRadius(0)
        .outerRadius(80)
        .startAngle((theta - bufferDeg) * (Math.PI/180)) // convert degrees to radians
        .endAngle((theta + bufferDeg) * (Math.PI/180)); // convert degrees to radians
    }
  
    thetas.forEach(t => {
        svg.append("path")
      .attr("d", makeArc(t))
      .attr("transform", "translate(100,100)")
      // .attr("stroke", "red")
      .style("opacity", 0.2)
      .style("fill", "goldenrod");
    });
  
  
  
    return svg.node();
  }