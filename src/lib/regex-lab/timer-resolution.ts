// Estimate the typical positive tick using the same clock as the measurement.
// Bound the probe even when the clock is frozen or deliberately coarse.
export function estimateTimerResolution(
  clock: () => number = () => performance.now(),
) {
  let previous = clock();
  const ticks: number[] = [];
  for (let attempt = 0; attempt < 65_536 && ticks.length < 7; attempt++) {
    const current = clock();
    if (current <= previous) continue;
    ticks.push(current - previous);
    previous = current;
  }
  return ticks.length >= 3
    ? ticks.sort((left, right) => left - right)[Math.floor(ticks.length / 2)]
    : undefined;
}
