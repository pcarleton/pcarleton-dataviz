
import * as luxon from "npm:luxon";

// 49.1: JDE Julian Ephemeris Days (in Dynamical Time).
// k is an integer corresponding to the new moon.
// adding .25, 0.5, 0.75 gives the primary phases.
export function calculateJDEcorrected(k) {
    const T = calculateT(k);
    let JDE = 2451550.09766 + 29.530588861 * k
              + 0.00015437 * Math.pow(T, 2)
              - 0.000000150 * Math.pow(T, 3)
              + 0.00000000073 * Math.pow(T, 4);

    // Only do new moon at the moment
    const correctionInputs = calculateCorrectionInputs(k);
    const phaseNum = Math.floor((k % 1)*4);
    if (phaseNum === 0) { // new moon
      const correction = newMoonCorrections(correctionInputs);
      JDE += correction;
    } else if (phaseNum == 2) { // full moon
      const correction = fullMoonCorrections(correctionInputs);
      JDE += correction;
    } else if (phaseNum == 1) { // first quarter
      const correction = quarterCorrections(correctionInputs);
      const quarterOnly = quarterSpecific(correctionInputs);
      JDE += correction + quarterOnly;
    } else if (phaseNum == 3) { // last quarter
      const correction = quarterCorrections(correctionInputs);
      const quarterOnly = quarterSpecific(correctionInputs);
      JDE += correction - quarterOnly;
    }
    
    return JDE + planetaryCorrections(k);
  }
  
  // 49.2: k=0 corresponds to the new moon of 2000-01-06
  function nearestK(luxonDate) {
    const fractionalYear = luxonDate.year + (
      luxonDate.diff(luxonDate.startOf('year'), 'year')
    ).years
    return Math.round((fractionalYear - 2000) * 12.3685);
  }
  
  
  export function jdeToTimestamp(jde) {
    const unixTime = (jde - 2440587.5) * 86400000;
    const dt =  luxon.DateTime.fromMillis(unixTime, { zone: "utc"});
    return dt;
    // const timestamp = new Date(unixTime);
    // return luxon.DateTime.fromJSDate(timestamp);
  }


// 49.3: T is time in Julian centuries since epoch 2000
function calculateT(k) {
    return k / 1236.85;
}

export const calculateCorrectionInputs = (k) => {
    const T = calculateT(k);
    // E -- note: E is not an angle like the rest of these, it's an eccentricity.
    const E = 1- 0.002516* T- 0.0000074*Math.pow(T, 2);

    // Sun mean anomaly
    const M = 2.5534 + 29.10535670 * k
                - 0.0000014 * Math.pow(T, 2)
                - 0.00000011 * Math.pow(T, 3);
      
    // Moon mean anomaly
    const Mprime = 201.5643 + 385.81693528 * k
                    + 0.0107582 * Math.pow(T, 2)
                    + 0.00001238 * Math.pow(T, 3)
                    - 0.000000058 * Math.pow(T, 4);
    
    // Moon's argument of latitude
    const F = 160.7108 + 390.67050284 * k
                  - 0.0016118 * Math.pow(T, 2)
                  - 0.00000227 * Math.pow(T, 3)
                  + 0.000000011 * Math.pow(T, 4);

    // Longitude of the ascending node of the lunar orbit
    const Omega = 124.7746 - 1.56375588 * k
                      + 0.0020672 * Math.pow(T, 2)
                      + 0.00000215 * Math.pow(T, 3);

    const raw = {
        M,
        Mprime,
        F,
        Omega,
        E,
        T
    }

    const deg2rad = Math.PI / 180.0;
    const mod360 = (n) => {
      let v = n % 360;
      if (v < 0) {
        v += 360;
      }
      return v;
    }

    const corrected = {
        M: mod360(raw.M)*deg2rad,
        Mprime: mod360(raw.Mprime) * deg2rad,
        F: mod360(raw.F) * deg2rad,
        Omega: mod360(raw.Omega) * deg2rad,
        E: raw.E
    }

    return {...corrected, raw};
}

export const newMoonCorrections = ({M, Mprime, F, Omega, E}) => {
    const corrections = [
    -0.40720 * Math.sin(Mprime),
    +0.17241 * E * Math.sin(M),
    +0.01608 * Math.sin(2 * Mprime),
    +0.01039 * Math.sin(2 * F),
    +0.00739 * E * Math.sin(Mprime - M),
    -0.00514 * E * Math.sin(Mprime + M),
    +0.00208 * E * E * Math.sin(2 * M),
    -0.00111 * Math.sin(Mprime - 2 * F),
    -0.00057 * Math.sin(Mprime + 2 * F),
    +0.00056 * E * Math.sin(2 * Mprime + M),
    -0.00042 * Math.sin(3 * Mprime),
    +0.00042 * E * Math.sin(M + 2 * F),
    +0.00038 * E * Math.sin(M - 2 * F),
    -0.00024 * E * Math.sin(2 * Mprime - M),
    -0.00017 * Math.sin(Omega),
    -0.00007 * Math.sin(Mprime + 2 * M),
    +0.00004 * Math.sin(2 * Mprime - 2 * F),
    +0.00004 * Math.sin(3 * M),
    +0.00003 * Math.sin(Mprime + M - 2 * F),
    +0.00003 * Math.sin(2 * Mprime + 2 * F),
    -0.00003 * Math.sin(Mprime + M + 2 * F),
    +0.00003 * Math.sin(Mprime - M + 2 * F),
    -0.00002 * Math.sin(Mprime - M - 2 * F),
    -0.00002 * Math.sin(3 * Mprime + M),
    +0.00002 * Math.sin(4 * Mprime)
    ];

    return corrections.reduce((a, b) => a + b);
}

// FUll moon

const fullMoonCorrections = ({M, Mprime, F, Omega, E}) => {
    const cs = [
        -0.40614 * Math.sin(Mprime),
        +0.17302 * E * Math.sin(M),
        +0.01614 * Math.sin(2 * Mprime),
        +0.01043 * Math.sin(2 * F),
        +0.00734 * E * Math.sin(Mprime - M),
        -0.00515 * E * Math.sin(Mprime + M),
        +0.00209 * E * E * Math.sin(2 * M),
        -0.00111 * Math.sin(Mprime - 2 * F),
        -0.00057 * Math.sin(Mprime + 2 * F),
        +0.00056 * E * Math.sin(2 * Mprime + M),
        -0.00042 * Math.sin(3 * Mprime),
        +0.00042 * E * Math.sin(M + 2 * F),
        +0.00038 * E * Math.sin(M - 2 * F),
        -0.00024 * E * Math.sin(2 * Mprime - M),
        -0.00017 * Math.sin(Omega),
        -0.00007 * Math.sin(Mprime + 2 * M),
        +0.00004 * Math.sin(2 * Mprime - 2 * F),
        +0.00004 * Math.sin(3 * M),
        +0.00003 * Math.sin(Mprime + M - 2 * F),
        +0.00003 * Math.sin(2 * Mprime + 2 * F),
        -0.00003 * Math.sin(Mprime + M + 2 * F),
        +0.00003 * Math.sin(Mprime - M + 2 * F),
        -0.00002 * Math.sin(Mprime - M - 2 * F),
        -0.00002 * Math.sin(3 * Mprime + M),
        +0.00002 * Math.sin(4 * Mprime)
      ];

      return cs.reduce((a, b) => a + b);
}


const quarterSpecific = ({M, Mprime, F, Omega, E}) => {
  return 0.00306 
    - 0.00038 * E * Math.cos(M)
    + 0.00026 * Math.cos(Mprime)
    - 0.00002 * Math.cos(Mprime - M)
    + 0.00002 * Math.cos(Mprime + M)
    + 0.00002 * Math.cos(2*F);
}

const quarterCorrections = ({M, Mprime, F, Omega, E}) => {
    const cs = [
      -0.62801 * Math.sin(Mprime),
      +0.17172 * E * Math.sin(M),
      -0.01183 * E * Math.sin(Mprime + M),
      +0.00862 * Math.sin(2*Mprime),
      +0.00804 * Math.sin(2*F),
      +0.00454 * E * Math.sin(Mprime - M),
      +0.00204 * E*E * Math.sin(2*M),
      -0.00180 * Math.sin(Mprime - 2*F),
      -0.00070 * Math.sin(Mprime + 2*F),
      -0.00040 * Math.sin(3*Mprime),
      -0.00034 * E * Math.sin(2*Mprime - M),
      +0.00032 * E * Math.sin(M + 2*F),
      +0.00032 * E * Math.sin(M - 2*F),
      -0.00028 * E*E * Math.sin(Mprime + 2*M),
      +0.00027 * E * Math.sin(2*Mprime + M),
      -0.00017 * Math.sin(Omega),
      -0.00005 * Math.sin(Mprime - M - 2*F),
      +0.00004 * Math.sin(2*Mprime + 2*F),
      -0.00004 * Math.sin(Mprime + M + 2*F),
      +0.00004 * Math.sin(Mprime - 2*M),
      +0.00003 * Math.sin(Mprime + M - 2*F),
      +0.00003 * Math.sin(3*M),
      +0.00002 * Math.sin(2*Mprime - 2*F),
      +0.00002 * Math.sin(Mprime - M + 2*F),
      -0.00002 * Math.sin(3*Mprime + M),
    ];

    return cs.reduce((a, b) => a + b);
}


export const planetaryCorrections = (k) => {
  const T = calculateT(k);

  let A1 = 299.77 + 0.107408 * k - 0.009173 * T * T;
  let A2 = 251.88 + 0.016321 * k;
  let A3 = 251.83 + 26.651886 * k;
  let A4 = 349.42 + 36.412478 * k;
  let A5 = 84.66 + 18.206239 * k;
  let A6 = 141.74 + 53.303771 * k;
  let A7 = 207.14 + 2.453732 * k;
  let A8 = 154.84 + 7.306860 * k;
  let A9 = 34.52 + 27.261239 * k;

  let A10 = 207.19 + 0.121824 * k;
  let A11 = 291.34 + 1.844379 * k;
  let A12 = 161.72 + 24.198154 * k;
  let A13 = 239.56 + 25.513099 * k;
  let A14 = 331.55 + 3.592518 * k;


  const deg2rad = Math.PI / 180;
  let additionalCorrections = 
    + 0.000325 * Math.sin(deg2rad*A1)
    + 0.000165 * Math.sin(deg2rad*A2)
    + 0.000164 * Math.sin(deg2rad*A3)
    + 0.000126 * Math.sin(deg2rad*A4)
    + 0.000110 * Math.sin(deg2rad*A5)
    + 0.000062 * Math.sin(deg2rad*A6)
    + 0.000060 * Math.sin(deg2rad*A7)
    + 0.000056 * Math.sin(deg2rad*A8)
    + 0.000047 * Math.sin(deg2rad*A9)
    + 0.000042 * Math.sin(deg2rad*A10)
    + 0.000040 * Math.sin(deg2rad*A11)
    + 0.000037 * Math.sin(deg2rad*A12)
    + 0.000035 * Math.sin(deg2rad*A13)
    + 0.000023 * Math.sin(deg2rad*A14);

  return additionalCorrections;
}