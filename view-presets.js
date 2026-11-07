// Fixed orthographic views of the project. Project axes: X — width, Y — up, Z — towards the viewer
// (a cabinet with rotation 0° faces +Z). "offset" points from the target to the camera.

export const viewPresets = {
  front: { label: "Спереди", offset: [0, 0, 1], up: [0, 1, 0], axes: [0, 1] },
  top: { label: "Сверху", offset: [0, 1, 0], up: [0, 0, -1], axes: [0, 2] },
  left: { label: "Слева", offset: [-1, 0, 0], up: [0, 1, 0], axes: [2, 1] },
};

// Half-width and half-height of the orthographic frustum that shows the box size with a margin
// and keeps the screen aspect ratio.
export function viewFrustum(name, size, aspect, margin = 1.15) {
  const [horizontal, vertical] = viewPresets[name].axes.map((axis) => Math.max(size[axis], 0.001));
  const halfHeight = Math.max(vertical / 2, horizontal / 2 / aspect) * margin;
  return { halfWidth: halfHeight * aspect, halfHeight };
}

export function viewCameraPosition(name, center, size) {
  const distance = Math.max(...size, 1) * 3;
  return center.map((value, axis) => value + viewPresets[name].offset[axis] * distance);
}
