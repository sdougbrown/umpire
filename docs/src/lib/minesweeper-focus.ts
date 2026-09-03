export type FocusDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "home"
  | "end";

export function moveFocus(
  direction: FocusDirection,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (direction === "right") {
    return { x: x === width - 1 ? 0 : x + 1, y };
  }

  if (direction === "left") {
    return { x: x === 0 ? width - 1 : x - 1, y };
  }

  if (direction === "up") {
    return { x, y: y === 0 ? height - 1 : y - 1 };
  }

  if (direction === "down") {
    return { x, y: y === height - 1 ? 0 : y + 1 };
  }

  if (direction === "home") {
    return { x: 0, y };
  }

  if (direction === "end") {
    return { x: width - 1, y };
  }

  return { x, y };
}
