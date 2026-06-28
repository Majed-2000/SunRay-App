/** Width breakpoints for responsive (phone / tablet / large tablet). */
export const breakpoints = {
  phone: 0,
  tablet: 600, // iPad portrait & most Android tablets
  largeTablet: 900, // iPad landscape / large tablets
} as const;

export type DeviceClass = 'phone' | 'tablet' | 'largeTablet';

export function deviceClassForWidth(width: number): DeviceClass {
  if (width >= breakpoints.largeTablet) return 'largeTablet';
  if (width >= breakpoints.tablet) return 'tablet';
  return 'phone';
}
