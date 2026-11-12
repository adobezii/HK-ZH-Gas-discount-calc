export function springFromApple({
  dampingRatio,
  response,
}: {
  dampingRatio: number;
  response: number;
}) {
  return {
    stiffness: (2 * Math.PI / response) ** 2,
    damping: (4 * Math.PI * dampingRatio) / response,
    mass: 1,
  };
}
